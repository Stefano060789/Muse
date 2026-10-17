const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
function load(relative) {
  const result = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
  new Function('module', 'exports', 'require', code)(result, result.exports, id => {
    if (id === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (id.endsWith('.css')) return {}
    if (id.endsWith('/AppInstallSupport')) return { __esModule: true, default: () => null }
    if (id.startsWith('.')) {
      const target = path.join(path.dirname(relative), id)
      return load(fs.existsSync(path.join(root, target + '.tsx')) ? target + '.tsx' : target + '.ts')
    }
    return require(id)
  })
  return result.exports
}
const Navigation = load('src/components/SiteNavigation.tsx').default
const App = load('src/pages/_app.tsx').default
const render = element => renderToStaticMarkup(element)
const expected = ['Home', 'Create a story', 'Create a gift', 'Saved stories']
for (const [pathname, selected] of [
  ['/', 'Home'], ['/story', 'Create a story'], ['/myself', 'Create a story'],
  ['/shared', 'Create a gift'], ['/couples', 'Create a gift'], ['/library', 'Saved stories'],
  ['/demo', null], ['/billing', null], ['/privacy', null], ['/creator', null]
]) {
  const html = render(React.createElement(Navigation, { pathname }))
  const nav = html.match(/<nav[^>]*>(.*?)<\/nav>/)[1]
  assert.deepEqual([...nav.matchAll(/<a[^>]*>(.*?)<\/a>/g)].map(match => match[1]), expected)
  const active = [...nav.matchAll(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map(match => match[1])
  assert.deepEqual(active, selected ? [selected] : [], pathname)
  assert.ok(!/creator|operations|myself/.test(nav), 'Private tools and optional settings are not primary destinations')
}
const recipient = render(React.createElement(Navigation, { pathname: '/shared', recipient: true }))
assert.ok(recipient.includes('Muse home'))
assert.ok(!recipient.includes('<nav'), 'Recipients have a quiet brand-only header')
let created = 0, prevented = 0
const tree = Navigation({ pathname: '/shared', onCreateGift: () => created++ })
const giftLink = tree.props.children.props.children[1].props.children.find(link => link.props.href === '/shared#new')
giftLink.props.onClick({ preventDefault() { prevented++ } })
assert.equal(created, 1, 'Gift management delegates new-story action rather than only changing the hash')
assert.equal(prevented, 1)
for (const pathname of ['/', '/story', '/library', '/billing', '/privacy', '/creator', '/demo']) {
  const html = render(React.createElement(App, {
    Component: () => React.createElement('main', null, 'Page content'),
    pageProps: {}, router: { pathname }
  }))
  assert.equal((html.match(/aria-label="Main navigation"/g) || []).length, 1, pathname)
  assert.ok(html.indexOf('<header') < html.indexOf('<main'), 'Navigation precedes page content')
  if (pathname !== '/') assert.ok(html.indexOf('<header') < html.indexOf('<img'), 'Navigation precedes decoration')
}
for (const pathname of ['/shared', '/couples']) {
  const html = render(React.createElement(App, {
    Component: () => React.createElement(Navigation, { pathname }),
    pageProps: {}, router: { pathname }
  }))
  assert.equal((html.match(/aria-label="Main navigation"/g) || []).length, 1, 'Gift routes must not get duplicate menus')
}
console.log('PASS consistent four-item navigation, selected routes, private exclusions, recipient simplicity and app-shell placement')
