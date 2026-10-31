const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const locales = ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']
let language = 'en-US'
let react = React
let accountFetch = () => { throw new Error('Rendering the pricing page must not send requests') }

function load(relative) {
  const result = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText
  new Function('module', 'exports', 'require', code)(result, result.exports, id => {
    if (id === 'react') return react
    if (id === 'next/head') return { __esModule: true, default: props => React.createElement('div', { 'data-head': true }, props.children) }
    if (id === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (id.endsWith('/interfaceLanguage')) return { useInterfaceLanguage: () => language }
    if (id.endsWith('/accountClient')) return { accountFetch: (...args) => accountFetch(...args) }
    if (id.startsWith('.')) return load(path.join(path.dirname(relative), id + '.ts'))
    return require(id)
  })
  return result.exports
}

const { BILLING_PLANS, localizedBillingPlans } = load('src/lib/billingPlans.ts')
const { billingCopy } = load('src/lib/billingCopy.ts')
const { publicNavigationCopy } = load('src/lib/publicNavigationCopy.ts')
const BillingPage = load('src/pages/billing.tsx').default
const SiteFooter = load('src/components/SiteFooter.tsx').default
const textMarkup = text => renderToStaticMarkup(React.createElement('span', null, text)).replace(/^<span>|<\/span>$/g, '')
assert.deepEqual(BILLING_PLANS.map(plan => plan.id), ['free', 'trial', 'gift', 'monthly', 'annual'])
assert.deepEqual(BILLING_PLANS.map(plan => plan.amount), [0, 0, 5.99, 8.99, 89.99])
assert.equal((8.99 * 12 - 89.99).toFixed(2), '17.89')
for (const locale of locales) {
  language = locale
  const copy = billingCopy(locale)
  const navigation = publicNavigationCopy(locale)
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(billingCopy('en-US')).sort())
  assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.trim()))
  const plans = localizedBillingPlans(locale)
  assert.deepEqual(plans.map(plan => plan.amount), [0, 0, 5.99, 8.99, 89.99])
  const html = renderToStaticMarkup(React.createElement(BillingPage))
  assert.ok(html.includes(textMarkup(copy.title)))
  for (const plan of plans) {
    assert.ok(html.includes(textMarkup(plan.name)))
    assert.ok(html.includes(textMarkup(plan.price)))
    assert.ok(html.includes(textMarkup(plan.period)))
    for (const feature of plan.features) assert.ok(html.includes(textMarkup(feature)))
    assert.ok(plan.features.includes(copy.audioFeature))
  }
  for (const key of ['trialIntro', 'trialHelp', 'noCard', 'checkoutHelp', 'priceNotice', 'allowanceDefinition', 'freeActions', 'limits', 'plannedHelp', 'storageHelp']) {
    assert.ok(html.includes(textMarkup(copy[key])), `${locale} must show ${key}`)
  }
  assert.equal(/<(form|input|button|iframe)\b/.test(html), false, 'No signed-out purchase controls')
  assert.equal((html.match(new RegExp(textMarkup(copy.planned).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2)
  const footer = renderToStaticMarkup(React.createElement(SiteFooter))
  for (const [href, key] of [['demo', 'sample'], ['billing', 'plans'], ['support', 'support'], ['privacy', 'privacy'], ['terms', 'terms']]) {
    assert.ok(footer.includes(`href="/${href}"`))
    assert.ok(footer.includes(textMarkup(navigation[key])))
  }
  assert.ok(footer.includes(textMarkup(navigation.contactPending)))
  assert.doesNotMatch(footer, /coming soon|Not configured|Public beta readiness is blocked/)
  if (locale !== 'en-US') {
    assert.notEqual(copy.title, billingCopy('en-US').title)
    assert.notEqual(navigation.plans, publicNavigationCopy('en-US').plans)
  }
}
const savedOperator = process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME
const savedEmail = process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
try {
  delete process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME
  delete process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  language = 'ar-SA'
  const missing = renderToStaticMarkup(React.createElement(SiteFooter))
  assert.ok(missing.includes(textMarkup(publicNavigationCopy(language).contactPending)))
  language = 'it-IT'
  process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME = 'Muse Studio'
  process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL = 'help@example.com'
  let footer = renderToStaticMarkup(React.createElement(SiteFooter))
  assert.ok(footer.includes('Gestore: Muse Studio'))
  assert.ok(footer.includes('mailto:help@example.com'))
  assert.ok(!footer.includes(textMarkup(publicNavigationCopy(language).contactPending)))
  process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL = 'invalid'
  footer = renderToStaticMarkup(React.createElement(SiteFooter))
  assert.ok(footer.includes(textMarkup(publicNavigationCopy(language).contactPending)))
  assert.ok(!footer.includes('mailto:invalid'))
} finally {
  if (savedOperator === undefined) delete process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME
  else process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME = savedOperator
  if (savedEmail === undefined) delete process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  else process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL = savedEmail
}
const billingSql = fs.readFileSync(path.join(root, 'supabase', 'billing.sql'), 'utf8')
for (const requirement of ["now() + interval '1 month'", 'muse_initialize_billing_trial', 'stories_used = stories_used + 1', 'interactions_used = interactions_used + 1', 'storyLimit', 'interactionLimit']) {
  assert.ok(billingSql.includes(requirement), 'Billing migration must implement ' + requirement)
}
console.log('PASS prices, benefits, planned availability and compact footer in all seven languages')
console.log('PASS dynamic contact details retain truthful pending status and valid mail links')

function mount() {
  const states = [], effects = []
  let index = 0
  react = {
    ...React,
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useEffect(effect) { const slot = index++; if (!(slot in states)) { states[slot] = true; effects.push(effect) } }
  }
  const Page = load('src/pages/billing.tsx').default
  const render = () => { index = 0; return Page() }
  render()
  const cleanups = effects.map(effect => effect())
  return {
    render,
    html: () => renderToStaticMarkup(render()),
    dispose() { cleanups.forEach(cleanup => cleanup?.()); react = React }
  }
}
function findButton(node) {
  if (!node || typeof node !== 'object') return undefined
  if (node.type === 'button') return node
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = findButton(child)
    if (found) return found
  }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

async function main() {
  language = 'en-US'
  accountFetch = async () => new Response('{}', { status: 401 })
  let hook = mount()
  try {
    await tick()
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).signInHelp)))
    assert.equal(findButton(hook.render()), undefined)
    language = 'uk-UA'
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).signInHelp)), 'mounted page follows language changes')
  } finally { hook.dispose() }

  const status = {
    tier: 'plus', status: 'trialing', trialEndsAt: '2026-12-15T00:00:00Z',
    storiesUsed: 10, storyLimit: 10, interactionsUsed: 120, interactionLimit: 120
  }
  const requests = []
  accountFetch = async (url, init) => {
    requests.push([url, init])
    return init?.method === 'POST'
      ? new Response('{"error":"not configured"}', { status: 503 })
      : new Response(JSON.stringify({ billing: status }))
  }
  hook = mount()
  const savedWindow = global.window
  try {
    await tick()
    assert.ok(hook.html().includes('10/10'))
    assert.ok(hook.html().includes('120/120'))
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).limit)))
    findButton(hook.render()).props.onClick()
    await tick()
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).unavailable)))
    language = 'it-IT'
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).unavailable)), 'errors update with interface language')
    assert.ok(hook.html().includes(new Date(status.trialEndsAt).toLocaleDateString(language)))
    assert.equal(JSON.parse(requests.find(([, init]) => init?.method === 'POST')[1].body).action, 'subscribe')

    let redirected
    global.window = { location: { assign: value => { redirected = value } } }
    accountFetch = async () => new Response('{"url":"https://checkout.stripe.com/test"}')
    findButton(hook.render()).props.onClick()
    await tick()
    assert.equal(redirected, 'https://checkout.stripe.com/test')
  } finally { global.window = savedWindow; hook.dispose() }

  accountFetch = async (url, init) => init?.method === 'POST'
    ? new Response('{"url":"https://untrusted.example/checkout"}')
    : new Response(JSON.stringify({ billing: status }))
  hook = mount()
  try {
    await tick()
    let redirected = false
    global.window = { location: { assign: () => { redirected = true } } }
    findButton(hook.render()).props.onClick()
    await tick()
    assert.equal(redirected, false, 'invalid checkout URLs must never redirect')
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).checkoutError)))
    assert.equal(findButton(hook.render()).props.disabled, false, 'failed checkout permits retry')
  } finally { global.window = savedWindow; hook.dispose() }

  accountFetch = async () => new Response('{"error":"provider failure"}', { status: 503 })
  hook = mount()
  try {
    await tick()
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).loadError)))
    assert.ok(hook.html().includes(textMarkup(billingCopy(language).monthlyStories)), 'prices and benefits remain visible when account lookup fails')
  } finally { hook.dispose() }

  accountFetch = async () => new Response(JSON.stringify({ billing: { ...status, status: 'active' } }))
  hook = mount()
  try {
    await tick()
    assert.equal(findButton(hook.render()), undefined, 'active subscribers cannot subscribe twice')
  } finally { hook.dispose() }
  console.log('PASS plan loading, trial usage, language changes, localized errors and secure checkout behavior')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
