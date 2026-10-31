const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const locales = ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']
let activeLanguage = 'en-US'
const element = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children }
})
const react = {
  __esModule: true,
  Fragment: Symbol('Fragment'),
  createElement: element
}
global.React = react
const cache = new Map()

function load(relative) {
  const absolute = path.resolve(root, relative)
  if (cache.has(absolute)) return cache.get(absolute)
  const module = { exports: {} }
  cache.set(absolute, module.exports)
  const source = fs.readFileSync(absolute, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true
    }
  }).outputText
  const resolve = id => {
    if (id === 'react') return react
    if (id === 'next/head') return function Head(props) { return props.children }
    if (id.endsWith('/LegalPage')) return load('src/components/LegalPage.tsx')
    if (id.endsWith('/legalContact')) return load('src/lib/legalContact.ts')
    if (id.endsWith('/interfaceLanguage')) {
      return { useInterfaceLanguage: () => activeLanguage }
    }
    if (id.endsWith('/publicLegalCopy')) return load('src/lib/publicLegalCopy.ts')
    if (id.endsWith('/shareConsentCopy')) return load('src/lib/shareConsentCopy.ts')
    throw new Error(`Unexpected dependency ${id} in ${relative}`)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, resolve)
  cache.set(absolute, module.exports)
  return module.exports
}

function textContent(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(textContent).join(' ')
  return textContent(value.props?.children)
}

function elements(value) {
  if (Array.isArray(value)) return value.flatMap(elements)
  if (!value || typeof value !== 'object') return []
  return [value, ...elements(value.props?.children)]
}

function renderPage(pathname, locale) {
  activeLanguage = locale
  return expand(load(`src/pages/${pathname}.tsx`).default())
}

function expand(value) {
  if (Array.isArray(value)) return value.map(expand)
  if (!value || typeof value !== 'object') return value
  if (typeof value.type === 'function') return expand(value.type(value.props))
  return { ...value, props: { ...value.props, children: expand(value.props?.children) } }
}

const copy = load('src/lib/publicLegalCopy.ts')
for (const locale of locales) {
  const localized = copy.publicLegalCopy(locale)
  assert.ok(localized.eyebrow, `${locale} has the shared LegalPage eyebrow`)
  for (const pageName of ['privacy', 'terms', 'support']) {
    const page = localized[pageName]
    assert.ok(page.title && page.documentTitle && page.description, `${locale} has ${pageName} page metadata`)
  }
  for (const section of Object.values(localized.privacy.sections)) {
    assert.ok(section.heading, `${locale} has every privacy heading`)
    for (const paragraph of section.paragraphs) assert.ok(paragraph.trim(), `${locale} has no empty privacy paragraphs`)
  }
  for (const section of Object.values(localized.terms.sections)) {
    assert.ok(section.heading, `${locale} has every terms heading`)
    for (const paragraph of section.paragraphs) assert.ok(paragraph.trim(), `${locale} has no empty terms paragraphs`)
  }
  assert.ok(localized.privacy.notReady, `${locale} retains the privacy launch blocker`)
  assert.ok(localized.terms.sections.status.paragraphs[0], `${locale} retains draft/legal-review terms status`)
  assert.ok(localized.support.warning, `${locale} retains the support launch blocker`)
  for (const status of ['configured', 'missing', 'invalid']) {
    assert.ok(copy.publicContactStatus(status, locale), `${locale} has the ${status} contact status`)
  }
}

for (const pageName of ['privacy', 'terms', 'support']) {
  const rendered = new Map(locales.map(locale => [locale, renderPage(pageName, locale)]))
  for (const locale of locales) {
    const tree = rendered.get(locale)
    const nodes = elements(tree)
    const text = textContent(tree)
    const localized = copy.publicLegalCopy(locale)[pageName]
    assert.ok(text.length > 100, `${pageName} renders ${locale} content`)
    assert.ok(text.includes(localized.title),
      `${pageName} renders its ${locale} heading`)
    assert.ok(nodes.some(node => node.type === 'title' &&
      textContent(node.props.children) === localized.documentTitle),
    `${pageName} renders its ${locale} document title`)
    assert.ok(nodes.some(node => node.type === 'meta' &&
      node.props.name === 'description' && node.props.content === localized.description),
    `${pageName} renders its ${locale} metadata description`)
    assert.ok(nodes.some(node => node.type === 'main' && node.props.lang === locale),
      `${pageName} sets the document language to ${locale}`)
    assert.ok(text.includes(copy.publicLegalCopy(locale).eyebrow),
      `${pageName} renders its ${locale} shared eyebrow`)
  }
  assert.notEqual(textContent(rendered.get('en-US')), textContent(rendered.get('it-IT')),
    `${pageName} responds to an interface-language change`)
}

const arabicPrivacy = textContent(renderPage('privacy', 'ar-SA'))
assert.match(arabicPrivacy, /الخصوصية/)
assert.match(arabicPrivacy, /30/)
assert.match(textContent(renderPage('support', 'zh-CN')), /未配置/)

process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL = 'help@example.test'
assert.match(textContent(renderPage('support', 'en-US')), /help@example\.test/)
assert.match(textContent(renderPage('support', 'en-US')), /Email support/)
delete process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
assert.match(textContent(renderPage('support', 'en-US')), /none has been invented/)

console.log('PASS public legal pages render complete localized copy for all seven interface languages')
