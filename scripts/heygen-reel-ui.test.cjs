const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const label = node => flatten(node.props.children).filter(value => typeof value === 'string').join('')
async function main() {
  let cursor = 0, tree, referenceMode = false
  const slots = [], effects = [], calls = []
  const storage = new Map()
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i]
      if (!previous || deps.some((value, index) => value !== previous.deps[index])) {
        effects.push(() => {
          previous?.cleanup?.()
          slots[i] = { deps, cleanup: fn() }
        })
      }
      if (!previous) slots[i] = { deps }
    }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const fetchAccount = async (_url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body)
    if (body.action === 'availability') return Response.json({
      available: true, archive: referenceMode, referenceReservation: referenceMode ? 72 : null
    })
    if (body.action === 'create') return Response.json({ token: 'synthetic-signed-reference', status: 'pending' })
    if (body.action === 'status') return Response.json({ status: 'completed' })
    if (body.action === 'video') return new Response('synthetic video', { headers: { 'Content-Type': 'video/mp4' } })
    throw new Error('Unexpected request')
  }
  const source = fs.readFileSync(path.join(root, 'src/components/HeygenStoryReel.tsx'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  const sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const window = { setTimeout, clearTimeout }
  const document = { createElement: name => {
    if (name !== 'canvas') throw new Error('Unexpected element')
    return {
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: callback => callback(new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
    }
  } }
  class FileReader {
    readAsDataURL(blob) { void blob.arrayBuffer().then(bytes => { this.result = `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`; this.onload() }) }
  }
  const createImageBitmap = async () => ({ width: 2000, height: 1000, close() {} })
  const fixture = { id: 'synthetic', title: 'The Lantern', currentStep: 1,
    journey: { status: 'concluded', pending: false, capability: 'a'.repeat(64) },
    responses: ['Follow the fox', 'Unseen choice'],
    scenes: [{ body: 'A lantern glows beside a quiet forest path.' },
      { body: 'A fox guides the traveler toward an ancient bridge.' },
      { body: 'An unseen final scene.' }] }
  const composer = { exports: {} }
  const composerCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/components/StoryReelComposer.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
  const Heygen = () => null
  new Function('module', 'exports', 'require', composerCode)(composer, composer.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === './HeygenStoryReel') return { __esModule: true, default: Heygen }
    throw new Error(`Unexpected composer dependency ${id}`)
  })
  const composerTree = composer.exports.default({ story: fixture, interfaceLanguage: 'it-IT' })
  assert.equal(composerTree.type, Heygen, 'Only the HeyGen video creation remains')
  assert.equal(composerTree.props.story, fixture)
  assert.equal(composerTree.props.canCreate, true)
  for (const [status, pending] of [['active', false], ['exhausted', false], ['concluded', true]]) {
    const story = { ...fixture, journey: { ...fixture.journey, status, pending } }
    assert.equal(composer.exports.default({ story, interfaceLanguage: 'it-IT' }).props.canCreate, false)
  }
  assert.equal(composer.exports.default({ story: { ...fixture, journey: undefined }, interfaceLanguage: 'it-IT' }).props.canCreate, false)
  new Function('module', 'exports', 'require', 'sessionStorage', 'window', 'document', 'FileReader', 'createImageBitmap', code)(module, module.exports, id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === '../lib/accountClient') return { accountFetch: fetchAccount }
    if (id === '../lib/chapterVideoClient') return { videoBlob: response => response.blob() }
    throw new Error(`Unexpected dependency ${id}`)
  }, sessionStorage, window, document, FileReader, createImageBitmap)
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      cursor = 0; tree = module.exports.default({ story: fixture, interfaceLanguage: 'en-US', canCreate: true })
      for (const effect of effects.splice(0)) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => node && typeof node === 'object')
  const button = text => nodes().find(node => node.type === 'button' && label(node) === text)
  await flush()
  button('Create video').props.onClick()
  await flush()
  assert.equal(calls.filter(item => item.action === 'create').length, 0, 'Opening the panel does not create a paid reel')
  assert.equal(button('Generate video').props.disabled, true)
  const prompt = nodes().find(node => node.type === 'textarea').props.value
  assert.match(prompt, /Follow the fox/)
  assert.match(prompt, /fox guides the traveler/)
  assert.doesNotMatch(prompt, /Unseen choice|unseen final scene/i, 'Unvisited scenes and choices are not sent')
  const longPrompt = module.exports.storyReelPrompt({
    ...fixture, currentStep: 40,
    scenes: Array.from({ length: 41 }, () => ({ body: '🌳'.repeat(100) })),
    responses: Array.from({ length: 40 }, () => 'a'.repeat(100))
  })
  assert.ok(longPrompt.length <= 4000)
  assert.match(longPrompt, /Some later story moments were omitted/)
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(longPrompt),
    'Truncation preserves valid surrogate pairs')
  const checkbox = nodes().find(node => node.type === 'input' && node.props.type === 'checkbox')
  checkbox.props.onChange({ target: { checked: true } })
  await flush()
  assert.equal(button('Generate video').props.disabled, false)
  const selects = nodes().filter(node => node.type === 'select')
  const model = selects.find(node => node.props.defaultValue === 'heygen-video-1')
  assert.ok(model, 'Video 1 is the only selectable video model')
  assert.equal(model.props.children[1].props.value, 'video-agent')
  assert.equal(model.props.children[1].props.disabled, true, 'Video Agent is not implemented')
  const duration = selects.find(node => node.props.value === 10)
  assert.deepEqual(duration.props.children.map(option => option.props.value), [10, 30, 60, 120, 180])
  for (const seconds of [30, 60, 120, 180]) {
    duration.props.onChange({ target: { value: String(seconds) } })
    await flush()
    assert.ok(nodes().some(node => node.props.role === 'status' && label(node).includes('Longer videos are not available yet')))
    assert.equal(button('Generate video').props.disabled, true)
    button('Generate video').props.onClick()
    await flush()
    assert.equal(calls.filter(item => item.action === 'create').length, 0)
  }
  duration.props.onChange({ target: { value: '10' } })
  await flush()
  assert.equal(button('Generate video').props.disabled, true, 'Changing duration requires fresh consent')
  nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await flush()
  nodes().find(node => node.type === 'textarea').props.onChange({ target: { value: `${prompt} ` } })
  await flush()
  assert.equal(button('Generate video').props.disabled, true, 'Editing the disclosed text requires fresh approval')
  nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await flush()
  button('Generate video').props.onClick()
  await flush()
  assert.deepEqual(calls.map(item => item.action), ['availability', 'create', 'status', 'video'])
  assert.equal(calls[1].approved, true)
  assert.equal(calls[1].storyId, fixture.id)
  assert.equal(calls[1].storyCapability, fixture.journey.capability)
  assert.match(calls[1].prompt, /lantern/i)
  assert.match(calls[1].prompt, /Follow the fox/)
  assert.equal(storage.get('muse-heygen-reel:synthetic'), 'synthetic-signed-reference')
  assert.equal(button('Download MP4').props.disabled, true, 'Preview is required before download')
  assert.equal(button('Share reel').props.disabled, true, 'Preview is required before sharing')
  nodes().find(node => node.type === 'video').props.onPlay()
  await flush()
  assert.equal(button('Download MP4').props.disabled, false)
  assert.equal(button('Share reel').props.disabled, false)
  button('Prepare another reel').props.onClick()
  await flush()
  assert.equal(storage.has('muse-heygen-reel:synthetic'), false)
  assert.equal(button('Generate video').props.disabled, true, 'Another paid reel needs fresh approval')
  slots.length = 0
  effects.length = 0
  storage.set('muse-heygen-reel:synthetic', 'synthetic-signed-reference')
  for (let i = 0; i < 2; i++) {
    cursor = 0
    tree = module.exports.default({ story: fixture, interfaceLanguage: 'en-US', canCreate: false })
    for (const effect of effects.splice(0)) effect()
  }
  assert.ok(button('Check existing video'), 'An existing video remains accessible before chapter completion')
  assert.ok(!button('Create video'), 'An unfinished chapter cannot start a new video')
  slots.length = 0; effects.length = 0; storage.clear(); calls.length = 0; referenceMode = true
  await flush()
  button('Create video').props.onClick()
  await flush()
  assert.ok(nodes().some(node => node.type === 'p' && label(node).includes('HeyGen creates public URLs')))
  const photo = new File([new Uint8Array(2 * 1024 * 1024)], 'portrait.jpg', { type: 'image/jpeg' })
  const input = nodes().find(node => node.type === 'input' && node.props.type === 'file')
  input.props.onChange({ target: { files: [{ type: 'image/jpeg', size: 21 * 1024 * 1024 }], value: 'files' } })
  await flush()
  assert.ok(nodes().some(node => node.props.role === 'alert' && label(node).includes('at most 20 MB')))
  input.props.onChange({ target: { files: [photo], value: 'files' } })
  await flush()
  assert.equal(button('Generate video').props.disabled, true)
  nodes().find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await flush()
  button('Generate video').props.onClick()
  await flush()
  const submission = calls.find(item => item.action === 'create')
  assert.equal(submission.photoApproved, true)
  assert.equal(submission.photos.length, 1)
  assert.equal(submission.photos[0].mime, 'image/jpeg')
  assert.equal(submission.photos[0].role, 'protagonist')
  assert.equal(submission.photos[0].data, Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64'))
  assert.ok([...storage.values()].every(value => !value.includes(submission.photos[0].data)), 'Photo bytes are not saved in session storage')
  console.log('PASS HeyGen reel requires consent, creates once, previews MP4 and supports another approved reel')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
