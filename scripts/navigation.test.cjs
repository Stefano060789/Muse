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
const StoriesPage = load('src/pages/stories.tsx').default
const render = element => renderToStaticMarkup(element)
const expected = ['Home', 'Myself', 'Stories', 'Archive', 'Pricing', 'Settings']
for (const [pathname, selected] of [
  ['/', 'Home'], ['/story', 'Stories'], ['/my-stories', 'Stories'], ['/myself', 'Myself'],
  ['/stories', 'Stories'], ['/shared', 'Stories'], ['/couples', 'Stories'], ['/library', 'Archive'],
  ['/demo', null], ['/billing', 'Pricing'], ['/account', 'Settings'], ['/privacy', null], ['/creator', null]
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
const italianNavigation = render(React.createElement(Navigation, { pathname: '/', interfaceLanguage: 'it-IT' }))
assert.ok(italianNavigation.includes('Impostazioni'), 'Interface language updates navigation labels')
assert.ok(italianNavigation.includes('Prezzi'), 'Plans are visible in the localized primary navigation')
assert.ok(italianNavigation.includes('Storie'), 'Stories is the localized hub destination')
const storiesHub = render(React.createElement(StoriesPage))
const hubLinks = [...storiesHub.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)]
assert.ok(hubLinks.some(([, href, label]) => href === '/my-stories' && label.includes('Open My stories')), 'My Story opens the personal story collection')
assert.ok(hubLinks.some(([, href, label]) => href === '/shared#new' && label.includes('Create a Shared Story')), 'Shared Story opens the shared-story creation flow')
assert.equal(hubLinks.length, 2, 'The Stories hub contains only My Story and Shared Story')
assert.ok(!storiesHub.includes('Gift Story'), 'No separate Gift Story offer is shown')
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
