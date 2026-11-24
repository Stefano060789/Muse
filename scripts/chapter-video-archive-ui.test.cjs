const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function flatten(node) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [node]
}
const text = node => flatten(node.props.children).filter(value => typeof value === 'string').join('')
async function main() {
  const slots = [], effects = [], calls = []
  let cursor = 0, tree, deleted = false, listener, shares = 0
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } },
    useEffect(effect) { const i = cursor++; if (!slots[i]) { slots[i] = true; effects.push(effect) } }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const video = { id: 'synthetic', chapterId: 'chapter-a', storyId: 'story-a', chapterNumber: 2,
    status: 'ready', expiresAt: new Date(Date.now() + 23 * 3600000).toISOString() }
  const accountFetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body)
    if (body.action === 'archive-list') return Response.json({ enabled: true, videos: deleted ? [] : [video] })
    if (body.action === 'archive-delete') { deleted = true; return Response.json({ deleted: true }) }
    if (body.action === 'archive-video') return new Response('synthetic-video', { headers: { 'Content-Type': 'video/mp4' } })
    throw new Error('Unexpected request')
  }
  const supabase = { auth: {
    getSession: async () => ({ data: { session: { access_token: 'synthetic' } }, error: null }),
    onAuthStateChange: fn => { listener = fn; return { data: { subscription: { unsubscribe() {} } } } }
  } }
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'ChapterVideoArchive.tsx'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mod = { exports: {} }
  const browser = { setInterval: () => 1, clearInterval() {}, confirm: () => true }
  const navigator = { canShare: () => true, share: async () => { shares++ } }
  new Function('module', 'exports', 'require', 'window', 'navigator', code)(mod, mod.exports, name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name === '../lib/accountClient') return { accountFetch, supabase }
    if (name === '../lib/chapterVideoClient') return { videoBlob: response => response.blob() }
    throw new Error(`Unexpected dependency ${name}`)
  }, browser, navigator)
  async function flush() {
    for (let i = 0; i < 4; i++) {
      cursor = 0
      tree = mod.exports.default({ language: 'en-US', titles: { 'chapter-a': 'The Lantern' } })
      for (const effect of effects.splice(0)) effect()
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  const nodes = () => flatten(tree).filter(node => node && typeof node === 'object')
  await flush()
  assert.ok(nodes().some(node => node.type === 'h3' && text(node).includes('The Lantern') && text(node).includes('Chapter')))
  assert.ok(nodes().some(node => node.props.role === 'status' && text(node).includes('expires within 24 hours')))
  assert.ok(nodes().some(node => node.type === 'p' && text(node).includes('Time remaining:')))
  nodes().find(node => node.type === 'button' && text(node) === 'Prepare to share').props.onClick()
  await flush()
  assert.equal(shares, 0, 'Downloading does not automatically open the social share sheet')
  nodes().find(node => node.type === 'button' && text(node) === 'Share').props.onClick()
  assert.equal(shares, 1, 'The share sheet opens directly from the user gesture')
  nodes().find(node => node.type === 'button' && text(node) === 'Delete video').props.onClick()
  await flush()
  assert.equal(calls.filter(item => item.action === 'archive-delete').length, 1)
  assert.ok(nodes().some(node => node.type === 'p' && text(node).includes('No videos available')))
  listener('SIGNED_OUT', null)
  await flush()
  assert.equal(tree, null, 'Signing out clears the private archive')
  console.log('PASS chapter-linked archive, final-day warning, countdown, deletion and sign-out clearing')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
