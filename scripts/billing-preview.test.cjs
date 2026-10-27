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
const billingSql = fs.readFileSync(path.join(root, 'supabase/billing.sql'), 'utf8')
assert.deepEqual(BILLING_PLANS.map(plan => plan.id), ['free', 'trial', 'gift', 'monthly', 'annual'])
assert.deepEqual(BILLING_PLANS.map(plan => plan.price), ['€0', '€0', '€5.99', '€8.99', '€89.99'])
assert.equal(BILLING_PLANS[1].name, 'Muse Plus — 1 month free')
assert.ok(BILLING_PLANS[1].features.some(feature => feature.includes('10 story creations')))
assert.ok(BILLING_PLANS[1].features.some(feature => feature.includes('120 AI interactions')))
assert.ok(BILLING_PLANS[1].features.some(feature => feature.includes('No payment details collected')))
assert.equal(BILLING_PLANS[2].name, 'One-off Long Gift')
assert.ok(BILLING_PLANS[2].features.some(feature => feature.includes('20-minute gift story, with 9 prepared scenes')))
assert.ok(BILLING_PLANS[2].features.some(feature => feature.includes('60 AI interactions, all available in one playthrough')))
assert.equal((8.99 * 12 - 89.99).toFixed(2), '17.89')
const monthly = BILLING_PLANS.find(plan => plan.id === 'monthly')
assert.ok(monthly.features.includes('120 AI interactions per billing month, shared across stories'))
assert.ok(monthly.features.some(feature => feature.includes('Optional story puzzles with hints')))
assert.ok(monthly.features.some(feature => feature.includes('Turn-taking stories for two on one device')))
assert.ok(BILLING_PLANS[2].features.some(feature => feature.includes('60 AI interactions, all available in one playthrough')))
for (const plan of BILLING_PLANS) {
  assert.ok(plan.features.some(feature => feature.includes('immersive soundscapes')), `${plan.name} includes immersive soundscapes`)
}
for (const requirement of [
  "now() + interval '1 month'", "muse_initialize_billing_trial", 'stories_used = stories_used + 1',
  'interactions_used = interactions_used + 1', 'storyLimit', 'interactionLimit'
]) {
  assert.ok(billingSql.includes(requirement), 'Billing migration must implement ' + requirement)
}
const html = renderToStaticMarkup(React.createElement(load('src/pages/billing.tsx').default))
for (const text of ['Try Muse Plus free for 30 days—no card and no automatic charge.', 'The trial starts when you create your account.', 'No card · no automatic renewal', 'up to 10 creations and 120 interactions', '20-minute, 9-scene story', 'up to 60 live AI interactions in one playthrough', '60-action limit is not yet enforced', 'prototype allows up to 12 actions per playthrough', 'Muse Plus includes 120 interactions', '10 story creations', 'Allowances refresh monthly', 'Premium cloud AI narration is not included', 'not implemented yet', 'same-device turn-taking', 'local immersive ambience', 'All packages include the same local', 'no automatic expiry', 'applicable tax presentation', 'Receiving a gift never requires a paid plan']) {
  assert.ok(html.includes(text), 'Missing disclosure: ' + text)
}
assert.equal((html.match(/Not available to purchase/g) || []).length, 2)
assert.equal(/<(form|input|button|iframe)\b/.test(html), false, 'No purchase controls or payment collection')
assert.ok(html.includes('href="/demo"'))
assert.ok(html.includes('href="/"'))
const footer = renderToStaticMarkup(React.createElement(load('src/components/SiteFooter.tsx').default))
assert.ok(footer.includes('href="/billing"'))
assert.ok(footer.includes('Plans (coming soon)'))
console.log('PASS billing plan prices, allowances, annual savings and explicit preview disclosures')
console.log('PASS billing page renders without requests, purchase controls or payment inputs')
console.log('PASS shared footer links to billing with clear coming-soon status')
