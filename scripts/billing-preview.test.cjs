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
  new Function('module', 'exports', 'require', 'fetch', code)(result, result.exports, id => {
    if (id === 'next/head') return { __esModule: true, default: () => null }
    if (id === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (id.endsWith('/InstallApp')) return { __esModule: true, default: () => null }
    if (id.startsWith('.')) return load(path.join(path.dirname(relative), id + '.ts'))
    return require(id)
  }, () => { throw new Error('Billing preview must not make requests') })
  return result.exports
}
const { BILLING_PLANS } = load('src/lib/billingPlans.ts')
assert.deepEqual(BILLING_PLANS.map(plan => plan.id), ['free', 'gift', 'monthly', 'annual'])
assert.deepEqual(BILLING_PLANS.map(plan => plan.price), ['€0', '€3.99', '€8.99', '€89.99'])
assert.equal((8.99 * 12 - 89.99).toFixed(2), '17.89')
assert.ok(BILLING_PLANS.find(plan => plan.id === 'monthly').features.includes('120 AI interactions per billing month, shared across stories'))
const html = renderToStaticMarkup(React.createElement(load('src/pages/billing.tsx').default))
for (const text of ['Coming soon - no payments or subscriptions yet.', 'Your current prototype access is unchanged', '10 new stories', '120 AI interactions', '12 AI actions total across recipients', 'Allowances refresh monthly', 'Premium cloud AI narration is not included', 'up to 30 days', 'applicable tax presentation', 'Receiving a gift never requires a paid plan']) {
  assert.ok(html.includes(text), 'Missing disclosure: ' + text)
}
assert.equal((html.match(/Not available to purchase/g) || []).length, 4)
assert.equal(/<(form|input|button|iframe)\b/.test(html), false, 'No purchase controls or payment collection')
assert.ok(html.includes('href="/demo"'))
assert.ok(html.includes('href="/"'))
const footer = renderToStaticMarkup(React.createElement(load('src/components/SiteFooter.tsx').default))
assert.ok(footer.includes('href="/billing"'))
assert.ok(footer.includes('Plans (coming soon)'))
console.log('PASS billing plan prices, allowances, annual savings and explicit preview disclosures')
console.log('PASS billing page renders without requests, purchase controls or payment inputs')
console.log('PASS shared footer links to billing with clear coming-soon status')
