const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(name) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', name + '.ts'), 'utf8')
  new Function('module', 'exports', 'require', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText)(module, module.exports, id => load(id.replace('./', '')))
  return module.exports
}
const { createShareClip, shareVideoType, SHARE_CLIP_SECONDS } = load('storyShareMotion')
const artwork = load('storyShareArtwork')

async function main() {
  const keys = ['MediaRecorder', 'HTMLCanvasElement', 'Image', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'Path2D']
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(global, key)]))
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  let time = 0, id = 0, captures = [], tracksStopped = 0, draws = 0, released = 0
  let recorder, supported = ['video/mp4'], empty = false, encodeFailure = false, constructorFailure = false, stall = false, paths = []
  let imageFailure = false, imagePending = false, canvasFailure = false
  const timers = new Map(), frames = new Map(), listeners = new Map()
  const context = {
    drawImage() { draws++ }, save() {}, restore() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {},
    translate() {}, scale() {}, moveTo() {}, bezierCurveTo() {}, stroke() {}, createRadialGradient: () => ({ addColorStop() {} })
  }
  const input = signal => ({ svg: '<svg/>', format: 'story', theme: 'starlight', signal, onProgress() {} })
  const tick = async ms => {
    time += ms
    for (const [key, callback] of [...frames]) { frames.delete(key); callback(time) }
    for (const [key, timer] of [...timers]) {
      if (timer.at <= time) { timers.delete(key); timer.callback() }
    }
    await new Promise(resolve => setImmediate(resolve))
  }
  const settleImage = async () => { await new Promise(resolve => setImmediate(resolve)) }
  try {
    global.setTimeout = (callback, ms) => { timers.set(++id, { callback, at: time + ms }); return id }
    global.Path2D = class { constructor(d) { paths.push(d) } }
    global.clearTimeout = key => timers.delete(key)
    global.requestAnimationFrame = callback => { frames.set(++id, callback); return id }
    global.cancelAnimationFrame = key => frames.delete(key)
    Object.defineProperty(global, 'performance', { configurable: true, value: { now: () => time } })
    global.HTMLCanvasElement = class {
      getContext() { return canvasFailure ? null : context }
      captureStream(fps) {
        captures.push({ fps, width: this.width, height: this.height })
        return { getTracks: () => [{ stop() { tracksStopped++ } }] }
      }
    }
    global.document = {
      hidden: false, createElement: () => new HTMLCanvasElement(),
      addEventListener: (key, callback) => listeners.set(key, callback),
      removeEventListener: key => listeners.delete(key)
    }
    global.Image = class {
      set src(_value) { if (!imagePending) queueMicrotask(() => imageFailure ? this.onerror?.() : this.onload?.()) }
    }
    global.MediaRecorder = class {
      static isTypeSupported(type) { return supported.includes(type) }
      constructor(_stream, options) {
        if (constructorFailure) throw new Error('Encoder unavailable')
        this.mimeType = options.mimeType
        this.state = 'inactive'
        recorder = this
      }
      start() { this.state = 'recording'; this.onstart?.() }
      stop() {
        this.state = 'inactive'
        if (stall) return
        queueMicrotask(() => {
          if (encodeFailure) { this.onerror?.(); return }
          this.ondataavailable?.({ data: new Blob(empty ? [] : ['encoded frames']) })
          this.onstop?.()
        })
      }
    }
    URL.createObjectURL = () => 'blob:fixture'
    URL.revokeObjectURL = () => { released++ }
    assert.equal(SHARE_CLIP_SECONDS, 6)
    assert.equal(shareVideoType(), 'video/mp4')
    supported = ['video/webm;codecs=vp8']
    assert.equal(shareVideoType(), supported[0])
    supported = []
    assert.equal(shareVideoType(), null)
    await assert.rejects(createShareClip(input(new AbortController().signal)), /not supported/)
    supported = ['video/mp4']
    for (const [format, height] of [['portrait', 1350], ['story', 1920], ['square', 1080]]) {
      const progress = []
      const promise = createShareClip({ ...input(new AbortController().signal), format, onProgress: value => progress.push(value) })
      await settleImage()
      assert.equal(recorder.state, 'recording')
      await tick(3000); await tick(3000)
      const blob = await promise
      assert.equal(blob.type, 'video/mp4')
      assert.ok(blob.size)
      assert.deepEqual(captures.at(-1), { fps: 30, width: 1080, height })
      assert.equal(progress.at(-1), 100)
      assert.equal(timers.size + frames.size + listeners.size, 0)
    }
    assert.ok(draws >= 9, 'Each clip draws changing frames, not a still-image placeholder')
    assert.equal(tracksStopped, 3)
    assert.equal(released, 3)
    for (const motif of ['map', 'sword', 'doorway', 'ocean']) {
      paths = []
      const promise = createShareClip({ ...input(new AbortController().signal), motif })
      await settleImage()
      const start = paths.slice()
      await tick(1500)
      assert.notDeepEqual(paths.slice(start.length), start, `${motif} animates geometry in the exported canvas`)
      await tick(4500)
      assert.ok((await promise).size)
      assert.notDeepEqual(artwork.storyArtworkShapes(motif, 0), artwork.storyArtworkShapes(motif, 1.5))
    }
    const stoppedBeforeAbort = tracksStopped
    let controller = new AbortController()
    let promise = createShareClip(input(controller.signal))
    const abortResult = assert.rejects(promise, { name: 'AbortError' })
    await settleImage()
    controller.abort()
    await abortResult
    assert.equal(recorder.state, 'inactive')
    assert.equal(tracksStopped, stoppedBeforeAbort + 1)
    assert.equal(timers.size + frames.size + listeners.size, 0)
    imagePending = true
    controller = new AbortController()
    promise = createShareClip(input(controller.signal))
    const loadAbort = assert.rejects(promise, { name: 'AbortError' })
    controller.abort()
    await loadAbort
    imagePending = false
    imageFailure = true
    await assert.rejects(createShareClip(input(new AbortController().signal)), /render/)
    imageFailure = false
    constructorFailure = true
    await assert.rejects(createShareClip(input(new AbortController().signal)), /Encoder unavailable/)
    constructorFailure = false
    canvasFailure = true
    await assert.rejects(createShareClip(input(new AbortController().signal)), /Canvas/)
    canvasFailure = false
    for (const failure of ['empty', 'encoder', 'hidden', 'watchdog', 'early-stop']) {
      empty = failure === 'empty'
      encodeFailure = failure === 'encoder'
      stall = failure === 'watchdog'
      promise = createShareClip(input(new AbortController().signal))
      const rejected = assert.rejects(promise)
      await settleImage()
      if (failure === 'hidden') {
        document.hidden = true
        listeners.get('visibilitychange')()
        document.hidden = false
      } else if (failure === 'early-stop') recorder.stop()
      else { await tick(6000); if (stall) await tick(10000) }
      await rejected
      assert.equal(timers.size + frames.size + listeners.size, 0, `${failure} releases all handles`)
    }
    console.log('PASS animated clip formats, duration, changing frames, MP4/WebM negotiation, abort, image/encoder errors, hidden tabs, watchdog and cleanup')
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(global, key, descriptor)
      else delete global[key]
    }
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
