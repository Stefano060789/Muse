const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const qr = require('qrcode')
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'giftCard.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const result = { exports: {} }
new Function('module', 'exports', compiled)(result, result.exports)
const { giftCardHtml, validateGiftCardLink } = result.exports
async function checkPrintableControls(link) {
  const state = [], pending = []
  let cursor = 0, tree, prints = 0
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], value => { state[index] = value }]
    },
    useRef(initial) { const index = cursor++; return state[index] ||= { current: initial } },
    useEffect(effect, deps) {
      const index = cursor++, previous = state[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) pending.push(() => {
        previous?.cleanup?.()
        state[index].cleanup = effect()
      })
      state[index] = { deps, cleanup: previous?.cleanup }
    }
  }
  const ui = { exports: {} }
  const compiledUi = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'GiftCard.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const retention = { exports: {} }
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'storyRetention.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText)(retention, retention.exports)
  assert.equal(retention.exports.publicStoryExpiry('infinity'), null)
  assert.equal(retention.exports.storyHasAccess(null, Date.parse('2200-01-01')), true)
  assert.equal(retention.exports.storyHasAccess('invalid'), false)
  assert.throws(() => retention.exports.publicStoryExpiry('invalid'), /invalid/)
  new Function('module', 'exports', 'require', compiledUi)(ui, ui.exports, name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name === '../lib/giftCard') return result.exports
    if (name === '../lib/storyRetention') return retention.exports
    if (name === 'qrcode') return qr
    throw new Error('Unexpected QR dependency: ' + name)
  })
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
  const label = node => flatten(node.props?.children).filter(value => typeof value === 'string').join('')
  const props = { recipientUrl: link, expiresAt: null }
  const render = () => {
    cursor = 0; tree = ui.exports.default(props)
    for (const node of flatten(tree)) {
      if (node?.type === 'dialog') node.props.ref.current = { showModal() {} }
      if (node?.type === 'iframe') node.props.ref.current = { contentWindow: { focus() {}, print() { prints++ } } }
    }
    for (const effect of pending.splice(0)) effect()
  }
  const button = text => flatten(tree).find(node => node?.type === 'button' && label(node) === text)
  render()
  assert.equal(button('Create printable QR code').props.disabled, false)
  button('Create printable QR code').props.onClick()
  render()
  for (let i = 0; i < 15; i++) { await new Promise(resolve => setTimeout(resolve, 10)); render() }
  const preview = flatten(tree).find(node => node?.type === 'iframe')
  assert.ok(preview, 'Opening the option creates a printable QR preview')
  const html = await (await fetch(preview.props.src)).text()
  assert.ok(html.includes(link) && html.includes('No automatic expiry.'))
  assert.ok(html.includes('data:image/png;base64,'))
  assert.equal(button('Print / Save card as PDF').props.disabled, true, 'Print waits for the frame to load')
  preview.props.onLoad(); render()
  assert.equal(button('Print / Save card as PDF').props.disabled, false)
  button('Print / Save card as PDF').props.onClick()
  assert.equal(prints, 1)
  props.disabled = true; render()
  assert.equal(button('Print / Save card as PDF').props.disabled, true)
  button('Back to story').props.onClick(); render()
  assert.ok(!flatten(tree).some(node => node?.type === 'dialog'))
  state.forEach(slot => slot?.cleanup?.())
}
async function main() {
  const link = 'https://muse.example/shared#play=synthetic-fixture.123456'
  assert.equal(validateGiftCardLink(link), link)
  for (const invalid of ['https://muse.example/shared#manage=secret', 'http://muse.example/shared#play=fixture', 'https://localhost/shared#play=fixture', 'https://muse.example/shared?owner=secret#play=fixture', 'https://user:password@muse.example/shared#play=fixture', 'https://muse.example/shared#play=fixture&manage=secret']) {
    assert.throws(() => validateGiftCardLink(invalid))
  }
  const png = await qr.toDataURL(link, { width: 360, margin: 4, errorCorrectionLevel: 'M' })
  assert.match(png, /^data:image\/png;base64,/)
  assert.equal(Buffer.from(png.split(',')[1], 'base64').subarray(1, 4).toString(), 'PNG')
  const html = giftCardHtml(link, '2099-01-01T00:00:00Z', '<script>alert("hello")</script>', png)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes(link))
  assert.ok(html.includes('Printing does not extend access'))
  assert.ok(html.includes('default-src \'none\''))
  assert.ok(!html.includes('#manage='))
  const permanent = giftCardHtml(link, null, 'A story to keep', png)
  assert.ok(permanent.includes('No automatic expiry.'))
  assert.ok(permanent.includes('replacing its recipient link disables this QR code'))
  assert.ok(!permanent.includes('Link expires'))
  assert.ok(!permanent.includes('Invalid Date'))
  assert.throws(() => giftCardHtml(link, 'invalid', 'Hello', png))
  assert.throws(() => giftCardHtml(link, '2099-01-01', 'x'.repeat(241), png))
  assert.throws(() => giftCardHtml(link, '2099-01-01', 'Hello', 'https://external.example/qr'))
  await checkPrintableControls(link)
  console.log('PASS gift card validates recipient-only HTTPS links, creates real local PNG QR, escapes greetings and discloses expiry without private content')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
