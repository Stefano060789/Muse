const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.join(__dirname, '..')

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'legalContact.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const legal = {}
new Function('exports', compiled)(legal)

const checks = [
  ['unchecked and missing consent cannot authorize transmission', () => {
    assert.equal(legal.hasExplicitConsent(false), false)
    assert.equal(legal.hasExplicitConsent(undefined), false)
    assert.equal(legal.hasExplicitConsent('true'), false)
  }],
  ['explicit checked consent authorizes transmission', () => {
    assert.equal(legal.hasExplicitConsent(true), true)
    assert.equal(legal.MUSE_AI_CONSENT_VERSION, '2026-10-18')
  }],
  ['missing public contact settings remain explicitly unconfigured', () => {
    assert.deepEqual(legal.getPublicContactConfig(undefined, ''), {
      operator: { value: null, status: 'missing' },
      supportEmail: { value: null, status: 'missing' }
    })
  }],
  ['operator name is trimmed and rejects unsafe values', () => {
    assert.deepEqual(legal.getPublicContactConfig('  Muse Studio  ', undefined).operator, {
      value: 'Muse Studio',
      status: 'configured'
    })
    assert.equal(legal.getPublicContactConfig('Muse\nStudio', undefined).operator.status, 'invalid')
    assert.equal(legal.getPublicContactConfig('x'.repeat(121), undefined).operator.status, 'invalid')
  }],
  ['support email validation permits normal addresses and rejects malformed values', () => {
    assert.deepEqual(legal.getPublicContactConfig(undefined, ' help+beta@example.co.uk ').supportEmail, {
      value: 'help+beta@example.co.uk',
      status: 'configured'
    })
    for (const email of ['help@example', 'help@@example.com', '.help@example.com', 'help..desk@example.com', 'help@-example.com', 'help@example..com']) {
      assert.equal(legal.getPublicContactConfig(undefined, email).supportEmail.status, 'invalid', email)
    }
  }],
  ['privacy disclosures match first-party operational telemetry and omit page-view collection', () => {
    const app = fs.readFileSync(path.join(root, 'src', 'pages', '_app.tsx'), 'utf8')
    const telemetry = fs.readFileSync(path.join(root, 'src', 'pages', 'api', 'telemetry.ts'), 'utf8')
    const privacy = fs.readFileSync(path.join(root, 'src', 'pages', 'privacy.tsx'), 'utf8')
    const terms = fs.readFileSync(path.join(root, 'src', 'pages', 'terms.tsx'), 'utf8')
    const creator = fs.readFileSync(path.join(root, 'src', 'pages', 'creator.tsx'), 'utf8')
    assert.doesNotMatch(app, /site-visit|VisitBeacon/)
    assert.doesNotMatch(telemetry, /site-visit/)
    assert.match(telemetry, /story-created/)
    assert.match(privacy, /does not record page views or website visits/)
    assert.match(privacy, /fixed event codes/)
    assert.match(privacy, /retained for up to seven days/)
    assert.match(terms, /does not collect page-view or website-visit analytics/)
    assert.doesNotMatch(creator, /bonomistefano@outlook\.it/)
  }],
  ['operations readiness blocks launch until account authentication is configured', () => {
    const operations = fs.readFileSync(path.join(root, 'src', 'lib', 'operations.ts'), 'utf8')
    assert.match(operations, /Supabase account authentication is not configured/)
    assert.match(fs.readFileSync(path.join(root, 'src', 'lib', 'accountAuth.ts'), 'utf8'), /requireAccount/)
  }]
]

for (const [name, run] of checks) {
  run()
  console.log(`PASS ${name}`)
}
