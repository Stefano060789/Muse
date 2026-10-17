const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
}).outputText
const config = { exports: {} }
new Function('module', 'exports', compile('src/lib/pageIllustration.ts'))(config, config.exports)
const { ILLUSTRATION_ASSETS, pageIllustration } = config.exports
const pages = fs.readdirSync(path.join(root, 'src', 'pages')).filter(name => name.endsWith('.tsx') && !name.startsWith('_'))
for (const page of pages) {
  const route = page === 'index.tsx' ? '/' : '/' + page.replace('.tsx', '')
  assert.ok(Object.values(ILLUSTRATION_ASSETS).includes(pageIllustration(route)), route + ' must have a local illustration')
}
for (const route of ['/shared', '/couples', '/demo']) assert.equal(pageIllustration(route), ILLUSTRATION_ASSETS.garden)
for (const route of ['/library', '/privacy', '/terms', '/support', '/billing', '/operations']) assert.equal(pageIllustration(route), ILLUSTRATION_ASSETS.library)
assert.equal(pageIllustration('/story'), ILLUSTRATION_ASSETS.passage)
assert.equal(pageIllustration('/myself'), ILLUSTRATION_ASSETS.passage)
assert.equal(pageIllustration('/404'), ILLUSTRATION_ASSETS.passage)
let total = 0
for (const asset of Object.values(ILLUSTRATION_ASSETS)) {
  const svg = fs.readFileSync(path.join(root, 'public', ...asset.split('/').filter(Boolean)), 'utf8')
  total += Buffer.byteLength(svg)
  assert.ok(Buffer.byteLength(svg) < 10000, 'Each vector must stay below 10 kB')
  assert.match(svg, /viewBox="0 0 1200 400"/)
  assert.ok(!/<(?:script|foreignObject|image|animate|text)\b/i.test(svg), 'Artwork must stay static, generic and self-contained')
  assert.ok(!/(?:href=|url\(["']?https?:|onload=|onclick=)/i.test(svg))
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, new Set(ids).size, 'SVG IDs must be unique')
  for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(match[1]), 'Gradient/pattern reference must resolve')
}
const jsx = (type, props) => ({ type, props })
const component = { exports: {} }
new Function('module', 'exports', 'require', compile('src/components/PageIllustration.tsx'))(component, component.exports, id => {
  if (id === '../lib/pageIllustration') return config.exports
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
  throw new Error('Unexpected illustration dependency: ' + id)
})
const tree = component.exports.default({ pathname: '/shared' })
assert.equal(tree.props['aria-hidden'], 'true')
const image = tree.props.children.find(child => child.type === 'img')
assert.equal(image.props.alt, '')
assert.equal(image.props.src, ILLUSTRATION_ASSETS.garden)
assert.equal(image.props.width / image.props.height, 3, 'Dimensions reserve a stable aspect ratio')
console.log(`PASS all ${pages.length} pages have local artwork; decorative semantics, route motifs and self-contained SVGs verified (${total} bytes total)`)
