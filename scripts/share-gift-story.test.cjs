const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const savedGiftFixture = require('./saved-gift-fixture.cjs')

function transpile(relative) {
  return ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
}
function flatten(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (typeof node !== 'object') return [node]
  return [node, ...flatten(node.props?.children)]
}
function label(node) { return flatten(node.props?.children).filter(value => typeof value === 'string' || typeof value === 'number').join('') }
const jsx = (type, props) => ({ type, props: props || {} })

function mountShare(props, browserNavigator) {
  const slots = []
  let cursor = 0, tree
  const react = {
    useId() { return `share-${cursor++}` },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    }
  }
  const exported = { exports: {} }
  const requireMock = id => {
    if (id === 'react') return react
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === './GiftCard') return { __esModule: true, default: 'gift-card' }
    if (id === '../lib/storyLanguage') return { recipientCopy: () => ({
      madeForYou: 'A story made for you', forYou: name => `For ${name}`, from: name => `From ${name}`,
      duration: minutes => `${minutes} minutes`, storyFrom: (sender, recipient) => `A story from ${sender} for ${recipient}`
    }) }
    throw new Error(`Unexpected component dependency: ${id}`)
  }
  new Function('module', 'exports', 'require', 'navigator', transpile('src/components/ShareGiftStory.tsx'))(
    exported, exported.exports, requireMock, browserNavigator
  )
  const render = () => {
    cursor = 0
    tree = exported.exports.default(props)
    return tree
  }
  const nodes = () => flatten(tree).filter(value => value && typeof value === 'object')
  const button = text => {
    const node = nodes().find(item => item.type === 'button' && label(item) === text)
    assert.ok(node, `Missing button: ${text}`)
    return node
  }
  render()
  return { button, nodes, render }
}

async function main() {
  const calls = []
  let shareStarts = 0
  const browserNavigator = {
    share: async value => { calls.push(value) },
    clipboard: { writeText: async value => { calls.push({ copied: value }) } }
  }
  const props = {
    recipientUrl: 'https://muse.example/shared#play=recipient-token',
    shareText: 'A story for you',
    expiresAt: null,
    whatsappUrl: 'https://wa.me/?text=share',
    beforeShare: () => true,
    onShareStart: () => { shareStarts++ },
    previewContent: jsx('p', { children: 'Prepared story scene, no progress' })
  }
  const share = mountShare(props, browserNavigator)
  assert.equal(calls.length, 0, 'Web Share is not called while rendering')
  share.button('Share gift story').props.onClick()
  share.render()
  assert.equal(share.button('Share gift story').props['aria-expanded'], true)
  assert.ok(share.nodes().some(node => node.type === 'gift-card'), 'Printable QR uses the existing GiftCard')
  assert.ok(share.nodes().some(node => node.type === 'summary' && label(node) === 'Preview what recipient sees'))
  assert.ok(!share.nodes().some(node => node.type === 'a' && node.props.href === props.recipientUrl), 'Preview does not navigate to the progress-recording recipient route')
  await share.button('Share with another app').props.onClick()
  share.render()
  assert.deepEqual(calls[0], { title: 'A Muse story for you', text: props.shareText, url: props.recipientUrl })
  assert.equal(shareStarts, 1)
  assert.ok(share.nodes().some(node => node.props.role === 'status' && label(node).includes('handed to your device')))
  await share.button('Copy recipient link').props.onClick()
  share.render()
  assert.deepEqual(calls[1], { copied: props.recipientUrl })
  assert.equal(share.nodes().some(node => node.props.role === 'status' && label(node).startsWith('Recipient link copied')), true)
  console.log('PASS sharing is click-triggered, copies only the recipient URL, reuses GiftCard, and previews without recipient navigation')

  const cancelled = mountShare(props, {
    share: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }) },
    clipboard: browserNavigator.clipboard
  })
  cancelled.button('Share gift story').props.onClick()
  cancelled.render()
  await cancelled.button('Share with another app').props.onClick()
  cancelled.render()
  assert.ok(cancelled.nodes().some(node => node.props.role === 'status' && label(node).includes('Sharing cancelled')))

  const blocked = mountShare({ ...props, beforeShare: () => false }, browserNavigator)
  blocked.button('Share gift story').props.onClick()
  blocked.render()
  await blocked.button('Copy recipient link').props.onClick()
  await blocked.button('Share with another app').props.onClick()
  assert.equal(calls.length, 2, 'Blocked sender actions do not copy or invoke Web Share')
  console.log('PASS sender pre-share safeguards gate both copy and native sharing')

  const unavailable = mountShare(props, { clipboard: { writeText: async () => { throw new Error('denied') } } })
  unavailable.button('Share gift story').props.onClick()
  unavailable.render()
  assert.ok(!unavailable.nodes().some(node => label(node) === 'Share with another app'))
  await unavailable.button('Copy recipient link').props.onClick()
  unavailable.render()
  assert.ok(unavailable.nodes().some(node => node.props.role === 'alert' && label(node).includes('Select and copy it from the field below')))
  assert.ok(unavailable.nodes().some(node => node.type === 'input' && node.props.value === props.recipientUrl))
  console.log('PASS unsupported or unavailable sharing falls back to a selectable link and reports clipboard errors')

  const local = mountShare({ ...props, localOnly: true }, browserNavigator)
  local.button('Share gift story').props.onClick()
  local.render()
  assert.ok(!local.nodes().some(node => label(node) === 'Share with another app'))
  assert.ok(!local.nodes().some(node => node.type === 'gift-card'))
  assert.ok(!local.nodes().some(node => node.type === 'a' && label(node) === 'Share on WhatsApp'))
  await local.button('Copy recipient link').props.onClick()
  local.render()
  assert.ok(local.nodes().some(node => node.props.role === 'status' && label(node).includes('local-only address')))
  console.log('PASS local-only links remain copyable but cannot be externally shared or printed as QR')

  const previewModule = { exports: {} }
  new Function('module', 'exports', 'require', transpile('src/components/GiftStoryPreview.tsx'))(
    previewModule, previewModule.exports, id => requireMockStory(id)
  )
  function requireMockStory(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (id === '../lib/storyLanguage') return { recipientCopy: () => ({
      madeForYou: 'A story made for you', forYou: name => `For ${name}`, from: name => `From ${name}`,
      duration: minutes => `${minutes} minutes`, storyFrom: (sender, recipient) => `A story from ${sender} for ${recipient}`
    }) }
    throw new Error(`Unexpected preview dependency: ${id}`)
  }
  const storyPreview = previewModule.exports.default({
    brief: savedGiftFixture.brief,
    content: savedGiftFixture.content
  })
  const previewNodes = flatten(storyPreview)
  const previewText = previewNodes.map(node => typeof node === 'string' ? node : label(node)).join(' ')
  assert.ok(previewText.includes('does not open the recipient link'))
  assert.ok(previewText.includes(savedGiftFixture.brief.recipientName))
  assert.ok(previewText.includes(savedGiftFixture.brief.gift.dedication))
  assert.ok(previewText.includes(savedGiftFixture.content.scenes[0].body))
  assert.ok(previewText.includes(savedGiftFixture.content.scenes[0].clue))
  for (const privateText of [savedGiftFixture.brief.solution, savedGiftFixture.brief.message, savedGiftFixture.brief.recipientHints]) {
    assert.ok(!previewText.includes(privateText))
  }
  const fixturePreviewShare = mountShare({
    recipientUrl: `https://muse.example/shared#play=${savedGiftFixture.playToken}`,
    shareText: `${savedGiftFixture.content.title} is ready for ${savedGiftFixture.brief.recipientName}.`,
    expiresAt: savedGiftFixture.expiresAt,
    previewContent: storyPreview
  }, {})
  fixturePreviewShare.button('Share gift story').props.onClick()
  fixturePreviewShare.render()
  assert.ok(fixturePreviewShare.nodes().some(node => node.type === 'gift-card'))
  assert.ok(fixturePreviewShare.nodes().some(node => node.type === 'section' && node.props['aria-label'] === 'Recipient presentation preview'))
  console.log('PASS synthetic saved gift fixture renders share panel and safe recipient preview without backend calls')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
