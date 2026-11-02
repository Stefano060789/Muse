const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id =>
    id in mocks ? mocks[id] : id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts'), mocks) : require(id))
  return module.exports
}
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
async function main() {
  const slots = []
  let cursor = 0, accepted = false, calls = [], clipboard = '', sent
  const jsx = (type, props) => ({ type, props })
  const component = load('src/components/PersonalStoryShareCard.tsx', {
    react: { useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '../lib/providerConsent': { PROVIDER_CONSENT_VERSION: 'fixture' },
    '../lib/accountClient': { async accountFetch(_url, options) {
      calls.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ teaser: 'A new beginning invites a little courage.' }) }
    } },
    '../lib/useShareConsent': { useShareConsent: () => ({ accepted, ready: true, saving: false, verify: async () => accepted }) },
    '../lib/useAccountPermissions': { useAccountPermissions: () => ({ managed: false, ready: true }) }
  }).default
  const story = {
    title: 'The Garden', mood: 'relaxed', currentStep: 0, responses: [], language: 'en-US',
    scenes: [
      { title: 'A quiet gate', body: 'I chose to open the gate and try again.' },
      { title: 'Future scene', body: 'THIS FUTURE TEXT MUST NOT BE AVAILABLE' }
    ],
    journey: { status: 'active' }, chapter: { number: 2 }
  }
  let nodes
  const render = () => { cursor = 0; nodes = flatten(component({ story, interfaceLanguage: 'en-US' })); return nodes }
  const button = name => nodes.find(node => node?.type === 'button' && node.props.children === name)
  const preview = () => decodeURIComponent(nodes.find(node => node?.type === 'img').props.src.split(',').slice(1).join(','))
  render()
  assert.equal(nodes.filter(node => node?.type === 'button').length, 1)
  button('Share your story').props.onClick(); render()
  assert.match(preview(), /My story so far/)
  assert.match(preview(), /Chapter 2/)
  assert.doesNotMatch(preview(), /I chose|FUTURE/)
  assert.equal(nodes.filter(node => node?.type === 'option').length, 2, 'Only visited scenes are selectable')
  nodes.find(node => node?.type === 'select').props.onChange({ target: { value: '0' } }); render()
  assert.match(preview(), /I chose to open/)
  const fields = nodes.filter(node => node?.type === 'textarea')
  fields[1].props.onChange({ target: { value: 'Small steps count.' } }); render()
  assert.match(preview(), /Small steps count/)
  button('First light').props.onClick()
  button('Story · 9:16').props.onClick(); render()
  assert.match(preview(), /height="1920"/)
  assert.match(preview(), /#f7ddd1/)
  assert.equal(calls.length, 0, 'Local editing and preview never call AI')
  assert.equal(button('Create share teaser').props.disabled, true)
  assert.equal(button('Download share card'), undefined, 'Export requires opening the preview first')
  assert.equal(button('Share with another app'), undefined)
  assert.equal(button('Copy share text'), undefined)
  const oldNavigator = Object.getOwnPropertyDescriptor(global, 'navigator')
  const oldWindow = global.window
  const oldDocument = global.document
  const oldImage = global.Image
  try {
    let exported, canvas, renderFailure = false
    global.window = { location: { origin: 'https://muse.example' }, setTimeout: callback => callback() }
    global.Image = class {
      set src(value) { this.source = value; queueMicrotask(() => this.onload()) }
    }
    global.document = {
      body: { append() {} },
      createElement(tag) {
        if (tag === 'canvas') {
          canvas = {
            getContext: () => renderFailure ? null : { drawImage(image) { assert.ok(image.source.startsWith('blob:')) } },
            toBlob(callback, type) { callback(new Blob(['test image'], { type })) }
          }
          return canvas
        }
        assert.equal(tag, 'a')
        return { click() { exported = { filename: this.download, width: canvas.width, height: canvas.height } }, remove() {} }
      }
    }
    Object.defineProperty(global, 'navigator', { configurable: true, value: {
      clipboard: { async writeText(text) { clipboard = text } },
      async share(data) { sent = data }
    } })
    const editingSvg = preview()
    button('Preview before sharing').props.onClick(); render()
    assert.equal(preview(), editingSvg, 'Review shows exactly the card composed in the editor')
    assert.equal(calls.length, 0, 'Opening preview does not call AI')
    assert.equal(sent, undefined, 'Opening preview does not trigger native sharing')
    assert.equal(clipboard, '', 'Opening preview does not copy anything')
    assert.equal(exported, undefined, 'Opening preview does not download anything')
    assert.equal(button('Download share card').props.disabled, false, 'Preview and local export need no AI consent')
    assert.equal(nodes.filter(node => node?.type === 'textarea').length, 0, 'Review is separate from editing')
    const caption = nodes.find(node => node?.props?.className === 'share-studio-caption').props.children
    await button('Copy share text').props.onClick()
    assert.equal(clipboard, caption, 'The entire shared caption is visible before sharing')
    assert.match(clipboard, /Small steps count/)
    assert.match(clipboard, /I chose to open/)
    assert.doesNotMatch(clipboard, /FUTURE/)
    await button('Share with another app').props.onClick()
    assert.equal(sent.text, clipboard)
    for (const [label, height] of [['Feed · 4:5', 1350], ['Story · 9:16', 1920], ['Square · 1:1', 1080]]) {
      button('Back to editing').props.onClick(); render()
      assert.equal(button('Share with another app'), undefined, 'Editing requires a fresh review')
      assert.match(preview(), /Small steps count/, 'Returning to edit preserves the reflection')
      button(label).props.onClick(); render()
      button('Preview before sharing').props.onClick(); render()
      button('Download share card').props.onClick()
      await new Promise(resolve => setImmediate(resolve)); render()
      assert.deepEqual(exported, { filename: 'muse-story-share.png', width: 1080, height })
      assert.ok(nodes.some(node => node?.props?.role === 'status' && /Image downloaded/.test(node.props.children)))
    }
    assert.equal(calls.length, 0, 'PNG export never calls AI')
    renderFailure = true
    button('Download share card').props.onClick()
    await new Promise(resolve => setImmediate(resolve)); render()
    assert.ok(nodes.some(node => node?.props?.role === 'alert'), 'Rendering failures must be visible')
    assert.equal(button('Download share card').props.disabled, false, 'Failed exports release the busy state')
    button('Back to editing').props.onClick()
    accepted = true; render()
    button('Create share teaser').props.onClick()
    await new Promise(resolve => setImmediate(resolve)); render()
    assert.equal(calls.length, 1)
    assert.deepEqual(Object.keys(calls[0]).sort(), ['action', 'consentVersion', 'language', 'mood', 'title'])
    assert.doesNotMatch(JSON.stringify(calls), /Small steps|I chose/)
    button('Use this caption on my card').props.onClick(); render()
    assert.match(preview(), /A new beginning/)
    story.journey.status = 'exhausted'; render()
    assert.match(preview(), /My story so far/)
    assert.doesNotMatch(preview(), /Chapter complete/)
    story.journey.status = 'concluded'; render()
    assert.match(preview(), /Chapter complete/)
    button('Preview before sharing').props.onClick(); render()
    button('Share your story').props.onClick(); render()
    button('Share your story').props.onClick(); render()
    assert.ok(button('Preview before sharing'), 'Reopening the studio returns to editing, not stale approval')
    assert.equal(button('Share with another app'), undefined)
  } finally {
    global.window = oldWindow
    global.document = oldDocument
    global.Image = oldImage
    if (oldNavigator) Object.defineProperty(global, 'navigator', oldNavigator)
    else delete global.navigator
  }
  console.log('PASS local moment composer, visited-scene privacy, themes, formats, captions, sharing and separate AI permission')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
