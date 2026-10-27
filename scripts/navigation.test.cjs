const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const navigations = []
const browser = { location: { assign: href => navigations.push(href) } }
function load(relative) {
  const result = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
  new Function('module', 'exports', 'require', 'window', code)(result, result.exports, id => {
    if (id === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (id.endsWith('.css')) return {}
    if (id.endsWith('/AppInstallSupport')) return { __esModule: true, default: () => null }
    if (id.startsWith('.')) {
      const target = path.join(path.dirname(relative), id)
      return load(fs.existsSync(path.join(root, target + '.tsx')) ? target + '.tsx' : target + '.ts')
    }
    return require(id)
  }, browser)
  return result.exports
}
const Navigation = load('src/components/SiteNavigation.tsx').default
const App = load('src/pages/_app.tsx').default
const render = element => renderToStaticMarkup(element)
const expected = ['Home', 'Myself', 'My stories', 'Create a gift story', 'Archive', 'Settings']
for (const [pathname, selected] of [
  ['/', 'Home'], ['/story', 'My stories'], ['/my-stories', 'My stories'], ['/myself', 'Myself'],
  ['/shared', 'Create a gift story'], ['/couples', 'Create a gift story'], ['/library', 'Archive'],
  ['/demo', null], ['/billing', null], ['/privacy', null], ['/creator', null]
]) {
  const html = render(React.createElement(Navigation, { pathname }))
  const nav = html.match(/<nav[^>]*>(.*?)<\/nav>/)[1]
  assert.deepEqual([...nav.matchAll(/<a[^>]*>(.*?)<\/a>/g)].map(match => match[1]), expected)
  const active = [...nav.matchAll(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map(match => match[1])
  assert.deepEqual(active, selected ? [selected] : [], pathname)
  assert.ok(!/creator|operations/.test(nav), 'Private tools are not primary destinations')
}
const recipient = render(React.createElement(Navigation, { pathname: '/shared', recipient: true }))
assert.ok(recipient.includes('Muse home'))
assert.ok(!recipient.includes('<nav'), 'Recipients have a quiet brand-only header')
let created = 0, prevented = 0
const tree = Navigation({ pathname: '/shared', onCreateGift: () => created++ })
const personalLink = tree.props.children.props.children[1].props.children.find(link => link.props.href === '/my-stories')
assert.ok(personalLink, 'Personal navigation opens the hub, not a blank creation flow')
assert.equal(personalLink.props.onClick, undefined, 'Normal and modified clicks use standard link navigation')
prevented = 0
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
  if (!['/', '/story'].includes(pathname)) assert.ok(html.indexOf('<header') < html.indexOf('<img'), 'Navigation precedes decoration')
  if (pathname === '/story') {
    assert.ok(!html.includes('muse-page-illustration'), 'Personal reading has no decorative banner')
    assert.ok(/<details[^>]*><summary>Help, privacy and about Muse<\/summary>/.test(html), 'Personal reading keeps the footer collapsed')
  }
}
for (const pathname of ['/shared', '/couples']) {
  const html = render(React.createElement(App, {
    Component: () => React.createElement(Navigation, { pathname }),
    pageProps: {}, router: { pathname }
  }))
  assert.equal((html.match(/aria-label="Main navigation"/g) || []).length, 1, 'Gift routes must not get duplicate menus')
  assert.ok(/<details[^>]*><summary>Help, privacy and about Muse<\/summary>/.test(html), 'Gift pages keep the full footer collapsed')
}
console.log('PASS My stories hub and Archive navigation, selected routes, private exclusions and recipient simplicity')
