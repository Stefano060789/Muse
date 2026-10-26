export type AmbientSound = 'none' | 'rain' | 'wind' | 'water' | 'crowd' | 'traffic' | 'mystery'

const FADE_SECONDS = 0.18
const boundedVolume = (volume: number): number =>
  Number.isNaN(volume) ? 0 : Math.max(0, Math.min(0.3, volume))

type Session = {
  context: AudioContext
  nodes: AudioNode[]
  sources: (AudioBufferSourceNode | OscillatorNode)[]
  gain?: GainNode
  disposed: boolean
  revision: number
  paused: boolean
  queue: Promise<void>
  cancelled: Promise<void>
  cancel: () => void
}

/**
 * Locally synthesized, softly faded ambience; no context exists until start().
 * Crowd and traffic are abstract synthetic textures; mystery is a quiet tonal bed.
 */
export class StoryAmbience {
  private session?: Session
  private volume = 0

  async start(kind: AmbientSound, volume: number): Promise<void> {
    if (!['none', 'rain', 'wind', 'water', 'crowd', 'traffic', 'mystery'].includes(kind)) {
      throw new Error(`Unsupported ambience: ${kind}`)
    }
    this.stop()
    this.volume = boundedVolume(volume)
    if (kind === 'none') return

    const browser = typeof window === 'undefined' ? undefined : window as Window & {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Context = browser?.AudioContext ?? browser?.webkitAudioContext
    if (!Context) throw new Error('Web Audio ambience is not supported in this browser')

    let cancel!: () => void
    const session: Session = {
      context: new Context(),
      nodes: [],
      sources: [],
      disposed: false,
      revision: 0,
      paused: false,
      queue: Promise.resolve(),
      cancelled: new Promise<void>(resolve => { cancel = resolve }),
      cancel: () => cancel(),
    }
    this.session = session
    try {
      this.synthesize(session, kind)
      // Unlock Web Audio inside the Play gesture, not in the queued microtask.
      const resumed = session.context.resume()
      void resumed.catch(() => undefined) // Cancellation can remove the queued observer.
      await this.enqueue(session, 0, async () => {
        await this.interruptible(session, resumed)
        if (this.current(session, 0)) this.fade(session, this.volume)
      })
    } catch (error) {
      this.release(session)
      throw error
    }
  }

  setVolume(volume: number): void {
    this.volume = boundedVolume(volume)
    const session = this.session
    if (session && !session.paused && session.context.state === 'running') {
      this.fade(session, this.volume)
    }
  }

  async pause(): Promise<void> {
    const session = this.session
    if (!session) return
    session.paused = true
    const revision = ++session.revision
    await this.enqueue(session, revision, async () => {
      if (session.context.state === 'running') {
        this.fade(session, 0)
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await this.interruptible(session, new Promise<void>(resolve => {
            timer = setTimeout(resolve, FADE_SECONDS * 1000)
          }))
        } finally {
          if (timer !== undefined) clearTimeout(timer)
        }
      }
      if (this.current(session, revision)) {
        await this.interruptible(session, session.context.suspend())
      }
    })
  }

  async resume(): Promise<void> {
    const session = this.session
    if (!session) return
    session.paused = false
    const revision = ++session.revision
    await this.enqueue(session, revision, async () => {
      await this.interruptible(session, session.context.resume())
      if (this.current(session, revision)) this.fade(session, this.volume)
    })
  }

  stop(): void {
    if (this.session) this.release(this.session)
  }

  private current(session: Session, revision: number): boolean {
    return this.session === session && !session.disposed && session.revision === revision
  }

  private async interruptible(session: Session, operation: Promise<void>): Promise<void> {
    // Promise.race also observes late rejections after cancellation.
    await Promise.race([operation, session.cancelled])
  }

  private enqueue(session: Session, revision: number, operation: () => Promise<void>): Promise<void> {
    const result = session.queue.then(async () => {
      if (!this.current(session, revision)) return
      try {
        await operation()
      } catch (error) {
        if (this.session !== session || session.disposed) return
        this.release(session)
        throw error
      }
    })
    session.queue = result.catch(() => undefined)
    return result
  }

  private fade(session: Session, volume: number): void {
    const gain = session.gain?.gain
    if (!gain || session.disposed) return
    const now = session.context.currentTime
    if (typeof gain.cancelAndHoldAtTime === 'function') {
      gain.cancelAndHoldAtTime(now)
    } else {
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(gain.value, now)
    }
    gain.linearRampToValueAtTime(volume, now + FADE_SECONDS)
  }

  private synthesize(session: Session, kind: Exclude<AmbientSound, 'none'>): void {
    const { context } = session
    const own = <T extends AudioNode>(node: T): T => {
      session.nodes.push(node)
      return node
    }
    const master = own(context.createGain())
    session.gain = master
    master.gain.value = 0
    master.connect(context.destination)

    const source = own(context.createBufferSource())
    session.sources.push(source)
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 4), context.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let index = 0; index < data.length; index++) {
      const noise = Math.random() * 2 - 1
      brown = (brown + noise * 0.02) / 1.02
      data[index] = kind === 'crowd' ? noise * 0.12
        : kind === 'traffic' ? brown * 0.12
          : kind === 'mystery' ? brown * 0.04
            : kind === 'rain' ? noise * 0.22 : brown * 0.8
    }
    if (kind === 'rain' || kind === 'wind' || kind === 'water') {
      const rms = Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length)
      if (rms > 0) {
        const scale = 0.25 / rms
        for (let index = 0; index < data.length; index++) data[index] = Math.max(-0.75, Math.min(0.75, data[index] * scale))
      }
    }
    source.buffer = buffer
    source.loop = true
    const filter = own(context.createBiquadFilter())
    // A broad speech-frequency band suggests a murmur without generating voices.
    filter.type = kind === 'rain' || kind === 'crowd' ? 'highpass' : 'lowpass'
    filter.frequency.value = kind === 'crowd' ? 300 : kind === 'rain' ? 650 : kind === 'traffic' ? 500 : kind === 'mystery' ? 260 : kind === 'wind' ? 550 : 1100
    filter.Q.value = 0.4
    const smoothing = own(context.createBiquadFilter())
    smoothing.type = 'lowpass'
    smoothing.frequency.value = kind === 'crowd' ? 2200 : kind === 'rain' ? 6500 : kind === 'traffic' ? 1400 : kind === 'mystery' ? 520 : 1800
    smoothing.Q.value = 0.4
    const texture = own(context.createGain())
    texture.gain.value = kind === 'crowd' ? 0.45 : kind === 'mystery' ? 0.18 : 0.65
    source.connect(filter)
    filter.connect(smoothing)
    smoothing.connect(texture)
    texture.connect(master)

    if (kind === 'mystery') {
      for (const frequency of [55, 82.4]) {
        const oscillator = own(context.createOscillator())
        const tone = own(context.createGain())
        session.sources.push(oscillator)
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        tone.gain.value = 0.025
        oscillator.connect(tone)
        tone.connect(master)
        oscillator.start()
      }
    } else if (kind !== 'rain') {
      const oscillator = own(context.createOscillator())
      session.sources.push(oscillator)
      oscillator.type = 'sine'
      oscillator.frequency.value = kind === 'crowd' ? 0.19 : kind === 'wind' ? 0.08 : kind === 'traffic' ? 0.045 : 0.13
      const depth = own(context.createGain())
      depth.gain.value = kind === 'crowd' ? 0.08 : kind === 'traffic' ? 0.06 : 0.12
      oscillator.connect(depth)
      depth.connect(texture.gain)
      oscillator.start()
    }
    source.start()
  }

  private release(session: Session): void {
    if (session.disposed) return
    session.disposed = true
    if (this.session === session) this.session = undefined
    session.cancel()
    for (const source of session.sources) {
      try { source.stop() } catch (error) { console.error('Ambience source cleanup failed', error) }
      try {
        if ('buffer' in source) source.buffer = null
      } catch (error) {
        console.error('Ambience buffer cleanup failed', error)
      }
    }
    for (const node of session.nodes) {
      try { node.disconnect() } catch (error) { console.error('Ambience node cleanup failed', error) }
    }
    session.sources.length = 0
    session.nodes.length = 0
    session.gain = undefined
    try {
      void session.context.close().catch(error => {
        console.error('Ambience context close failed', error)
      })
    } catch (error) {
      console.error('Ambience context close failed', error)
    }
  }
}
