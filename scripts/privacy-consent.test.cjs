const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

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
    assert.equal(legal.MUSE_AI_CONSENT_VERSION, '2026-10-14')
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
  }]
]

for (const [name, run] of checks) {
  run()
  console.log(`PASS ${name}`)
}
