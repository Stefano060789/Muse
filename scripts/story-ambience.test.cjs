const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = path.join(__dirname, `.story-ambience-tests-${process.pid}`)
const saved = { window: global.window, fetch: global.fetch, error: console.error }
const contexts = []
const sounds = ['rain', 'wind', 'water', 'crowd', 'traffic', 'mystery']
let next = {}
let passed = 0
let networkCalls = 0
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const parameter = value => ({
  value, events: [],
  cancelAndHoldAtTime(time) { this.events.push(['hold', time]) },
  cancelScheduledValues(time) { this.events.push(['cancel', time]) },
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]) },
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]) },
})
class Node {
  constructor(context, type) {
    this.type = type
    this.connections = []
    this.disconnects = 0
    this.starts = 0
    this.stops = 0
    this.gain = parameter(1)
    this.frequency = parameter(440)
    this.Q = parameter(1)
    context.nodes.push(this)
  }
  connect(node) { this.connections.push(node) }
  disconnect() { this.disconnects++; this.connections = [] }
  start() { this.starts++ }
  stop() { this.stops++ }
}
class Context {
  constructor() {
    this.options = next
    next = {}
    if (this.options.constructorError) throw new Error('constructor failed')
    this.nodes = []
    this.sampleRate = 8000
    this.currentTime = 2
    this.destination = {}
    this.state = 'suspended'
    this.resumes = 0
    this.suspends = 0
    this.closes = 0
    this.listeners = new Map()
    contexts.push(this)
  }
  createGain() { return new Node(this, 'gain') }
  createBufferSource() { const node = new Node(this, 'source'); node.buffer = null; return node }
  createBiquadFilter() {
    if (this.options.setupError) throw new Error('setup failed')
    return new Node(this, 'filter')
  }
  createOscillator() { return new Node(this, 'oscillator') }
  createBuffer(channels, length, rate) {
    assert.equal(channels, 1)
    assert.equal(rate, this.sampleRate)
    this.samples = new Float32Array(length)
    return { getChannelData: () => this.samples }
  }
  async resume() {
    this.resumes++
    if (this.options.resumeGate) await this.options.resumeGate.promise
    if (this.options.resumeError || (this.resumes > 1 && this.options.recoveryError)) throw new Error('resume failed')
    if (this.state === 'closed') throw new Error('closed context')
    this.state = 'running'
  }
  addEventListener(type, listener) { this.listeners.set(type, listener) }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type) }
  changeState(state) { this.state = state; this.listeners.get('statechange')?.() }
  async suspend() {
    this.suspends++
    if (this.options.suspendGate) await this.options.suspendGate.promise
    if (this.options.suspendError) throw new Error('suspend failed')
    if (this.state === 'closed') throw new Error('closed context')
    this.state = 'suspended'
  }
  close() {
    this.closes++
    this.state = 'closed'
    if (this.options.closeThrows) throw new Error('close threw')
    if (this.options.closeError) return Promise.reject(new Error('close failed'))
    return Promise.resolve()
  }
}
function cleaned(context) {
  assert.equal(context.closes, 1)
  assert.equal(context.state, 'closed')
  for (const node of context.nodes) {
    assert.equal(node.disconnects, 1)
    if (node.type === 'source' || node.type === 'sine') assert.equal(node.stops, 1)
    if ('buffer' in node) assert.equal(node.buffer, null)
  }
}
async function check(name, run) {
  await run()
  passed++
  console.log(`PASS ${name}`)
}

async function main() {
  fs.mkdirSync(output)
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/storyAmbience.ts', '--outDir', output, '--module', 'commonjs',
    '--target', 'es2020', '--lib', 'dom,es2020', '--strict', '--skipLibCheck', '--noEmit', 'false',
  ], { cwd: root, stdio: 'inherit' })
  global.fetch = () => { networkCalls++; throw new Error('Network forbidden') }
  global.window = { AudioContext: Context }
  const { StoryAmbience } = require(path.join(output, 'storyAmbience.js'))
  await check('import, construction and none are lazy; unsupported kinds/browsers reject', async () => {
    const engine = new StoryAmbience()
    engine.setVolume(1)
    await engine.pause()
    await engine.resume()
    await engine.start('none', 1)
    engine.stop()
    assert.equal(contexts.length, 0)
    await assert.rejects(engine.start('thunder', 1), /Unsupported ambience/)
    global.window = undefined
    await assert.rejects(engine.start('rain', 0.1), /not supported/)
    global.window = { AudioContext: Context }
  })
  await check('all six sounds synthesize bounded local audio, filtered loops and smooth gain', async () => {
    for (const kind of sounds) {
      const engine = new StoryAmbience()
      await engine.start(kind, 100)
      const context = contexts.at(-1)
      const master = context.nodes[0]
      assert.equal(master.gain.value, 0.3)
      assert.deepEqual(master.gain.events[0], ['hold', 2])
      assert.deepEqual(master.gain.events[1], ['ramp', 0.3, 2.18])
      assert.ok(context.nodes.some(node => node.loop === true && node.starts === 1))
      assert.equal(context.nodes.filter(node => ['highpass', 'lowpass'].includes(node.type)).length, 2)
      assert.ok(context.samples.some(value => value !== 0))
      assert.ok(context.samples.every(value => Number.isFinite(value) && Math.abs(value) <= 0.8))
      if (['rain', 'wind', 'water'].includes(kind)) {
        const rms = Math.sqrt(context.samples.reduce((sum, sample) => sum + sample * sample, 0) / context.samples.length)
        assert.ok(rms >= 0.2 && rms <= 0.26, `${kind} has an audible, bounded source level rather than near-silent noise`)
      }
      if (kind === 'crowd') {
        assert.ok(context.samples.every(value => Math.abs(value) <= 0.12))
        const filters = context.nodes.filter(node => ['highpass', 'lowpass'].includes(node.type))
        assert.deepEqual(filters.map(node => [node.type, node.frequency.value, node.Q.value]), [
          ['highpass', 300, 0.4], ['lowpass', 2200, 0.4],
        ])
        const oscillator = context.nodes.find(node => node.type === 'sine')
        assert.equal(oscillator.frequency.value, 0.19)
        assert.equal(oscillator.starts, 1)
        const depth = oscillator.connections[0]
        const texture = context.nodes.find(node => node.gain === depth.connections[0])
        assert.equal(depth.gain.value, 0.08)
        assert.equal(texture.gain.value, 0.45)
        assert.ok(texture.gain.value - depth.gain.value > 0)
        assert.ok((texture.gain.value + depth.gain.value) * 0.12 * 0.3 < 0.02)
      }
      if (kind === 'traffic') {
        const filters = context.nodes.filter(node => ['highpass', 'lowpass'].includes(node.type))
        assert.deepEqual(filters.map(node => [node.type, node.frequency.value]), [['lowpass', 500], ['lowpass', 1400]])
        assert.ok(context.samples.every(value => Math.abs(value) <= 0.12))
      }
      if (kind === 'mystery') {
        assert.equal(context.nodes.filter(node => node.type === 'sine').length, 2)
        assert.deepEqual(context.nodes.filter(node => node.type === 'sine').map(node => node.frequency.value), [55, 82.4])
        assert.ok(context.samples.every(value => Math.abs(value) <= 0.04))
      }
      for (const volume of [-10, 0, 0.12, 0.3, 10, NaN, Infinity, -Infinity]) {
        engine.setVolume(volume)
        assert.ok(master.gain.value >= 0 && master.gain.value <= 0.3)
      }
      engine.stop()
      engine.stop()
      cleaned(context)
    }
  })
  await check('pause suspends, remembers volume and resume fades; none releases resources', async () => {
    for (const kind of sounds) {
      const engine = new StoryAmbience()
      await engine.start(kind, 0.1)
      const context = contexts.at(-1)
      const master = context.nodes[0]
      await engine.pause()
      assert.equal(context.state, 'suspended')
      assert.equal(master.gain.value, 0)
      engine.setVolume(0.22)
      assert.equal(master.gain.value, 0)
      await engine.resume()
      assert.equal(context.state, 'running')
      assert.equal(master.gain.value, 0.22)
      await engine.start('none', 0.2)
      cleaned(context)
    }
  })
  await check('unexpected audio suspension is automatically recovered and listeners are cleaned up', async () => {
    const engine = new StoryAmbience()
    let interruptions = 0
    await engine.start('rain', 0.1, () => interruptions++)
    const context = contexts.at(-1)
    assert.equal(context.listeners.has('statechange'), true)
    context.changeState('suspended')
    await tick()
    assert.equal(context.resumes, 2)
    assert.equal(context.state, 'running')
    assert.equal(interruptions, 0)
    engine.stop()
    assert.equal(context.listeners.has('statechange'), false)
    cleaned(context)
  })
  await check('failed audio recovery reports an interruption for the retry control', async () => {
    const engine = new StoryAmbience()
    let interruptions = 0
    await engine.start('wind', 0.1, () => interruptions++)
    const context = contexts.at(-1)
    context.options.recoveryError = true
    context.changeState('suspended')
    await tick()
    await tick()
    assert.equal(context.resumes, 2)
    assert.equal(interruptions, 1)
    engine.stop()
    cleaned(context)
  })
  await check('start cancelled while resuming settles promptly and cannot revive or fade old context', async () => {
    const gate = deferred()
    next = { resumeGate: gate }
    const engine = new StoryAmbience()
    const starting = engine.start('crowd', 0.2)
    const old = contexts.at(-1)
    const master = old.nodes[0]
    await tick()
    engine.stop()
    await starting
    cleaned(old)
    await engine.start('rain', 0.1)
    gate.resolve()
    await tick()
    assert.equal(old.resumes, 1)
    assert.equal(master.gain.events.length, 0)
    assert.equal(contexts.at(-1).state, 'running')
    engine.stop()
  })
  await check('start unlocks audio synchronously; replacing it before fade keeps only the latest sound', async () => {
    const engine = new StoryAmbience()
    const first = engine.start('rain', 0.1)
    const old = contexts.at(-1)
    assert.equal(old.resumes, 1, 'Web Audio resume must run in the Play gesture')
    const second = engine.start('water', 0.2)
    await Promise.all([first, second])
    assert.equal(old.resumes, 1)
    assert.equal(old.nodes[0].gain.events.length, 0, 'Replaced startup never fades in')
    cleaned(old)
    engine.stop()
  })
  await check('pending resume is cancelled by stop; late rejection is observed', async () => {
    const engine = new StoryAmbience()
    await engine.start('water', 0.2)
    const context = contexts.at(-1)
    await engine.pause()
    const gate = deferred()
    context.options.resumeGate = gate
    const resuming = engine.resume()
    await tick()
    const count = context.nodes[0].gain.events.length
    engine.stop()
    await resuming
    gate.reject(new Error('late resume failed'))
    await tick()
    assert.equal(context.nodes[0].gain.events.length, count)
    cleaned(context)
  })
  await check('stop cancels pause fade without suspending a closed context', async () => {
    const engine = new StoryAmbience()
    await engine.start('wind', 0.2)
    const context = contexts.at(-1)
    const pausing = engine.pause()
    await tick()
    engine.stop()
    await pausing
    assert.equal(context.suspends, 0)
    cleaned(context)
  })
  await check('stop cancels pending suspension and queued resume without restarting context', async () => {
    const engine = new StoryAmbience()
    await engine.start('rain', 0.2)
    const context = contexts.at(-1)
    const gate = deferred()
    context.options.suspendGate = gate
    const pausing = engine.pause()
    await new Promise(resolve => setTimeout(resolve, 210))
    assert.equal(context.suspends, 1)
    const resuming = engine.resume()
    engine.stop()
    await Promise.all([pausing, resuming])
    gate.reject(new Error('late suspend failed'))
    await tick()
    assert.equal(context.resumes, 1)
    cleaned(context)
  })
  await check('pause/resume serialize pending suspension and latest intent wins', async () => {
    const engine = new StoryAmbience()
    await engine.start('rain', 0.2)
    const context = contexts.at(-1)
    const gate = deferred()
    context.options.suspendGate = gate
    const pausing = engine.pause()
    await new Promise(resolve => setTimeout(resolve, 210))
    assert.equal(context.suspends, 1)
    const resuming = engine.resume()
    engine.setVolume(0.15)
    assert.equal(context.resumes, 1)
    gate.resolve()
    await Promise.all([pausing, resuming])
    assert.equal(context.state, 'running')
    assert.equal(context.nodes[0].gain.value, 0.15)
    const staleResume = engine.resume()
    const latestPause = engine.pause()
    await Promise.all([staleResume, latestPause])
    assert.equal(context.state, 'suspended')
    engine.stop()
    cleaned(context)
  })
  await check('construction/setup/start/resume/pause errors reject and release resources', async () => {
    const engine = new StoryAmbience()
    next = { constructorError: true }
    await assert.rejects(engine.start('rain', 0.2), /constructor failed/)
    for (const options of [{ setupError: true }, { resumeError: true }]) {
      next = options
      await assert.rejects(engine.start('water', 0.2), /failed/)
      cleaned(contexts.at(-1))
    }
    for (const operation of ['resume', 'pause']) {
      await engine.start('wind', 0.2)
      const context = contexts.at(-1)
      context.options[operation === 'resume' ? 'resumeError' : 'suspendError'] = true
      await assert.rejects(engine[operation](), /failed/)
      cleaned(context)
    }
  })
  await check('close errors are logged, never unhandled; fallback automation and legacy context work', async () => {
    const errors = []
    console.error = (...args) => errors.push(args)
    global.window = { webkitAudioContext: Context }
    for (const option of ['closeError', 'closeThrows']) {
      next = { [option]: true }
      const engine = new StoryAmbience()
      await engine.start('rain', 0.1)
      const context = contexts.at(-1)
      context.nodes[0].gain.cancelAndHoldAtTime = undefined
      engine.setVolume(0.2)
      assert.ok(context.nodes[0].gain.events.some(event => event[0] === 'cancel'))
      engine.stop()
      engine.stop()
      await tick()
      cleaned(context)
    }
    assert.equal(errors.length, 2)
    console.error = saved.error
    global.window = { AudioContext: Context }
  })
  await check('engine has no network, assets or external dependencies', () => {
    const source = fs.readFileSync(path.join(root, 'src', 'lib', 'storyAmbience.ts'), 'utf8')
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|import|require|AudioWorklet)\b|https?:\/\//)
    assert.equal(networkCalls, 0)
    contexts.forEach(cleaned)
  })
  console.log(`${passed} story ambience tests passed`)
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
  global.window = saved.window
  global.fetch = saved.fetch
  console.error = saved.error
  fs.rmSync(output, { recursive: true, force: true })
})
