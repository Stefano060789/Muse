const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { test } = require('node:test')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/legalContact.ts'), 'utf8')
const legal = {}
new Function('exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText)(legal)

test('approved support mailbox is shared by default without inventing an operator', () => {
  for (const value of [undefined, '', '  ']) {
    const config = legal.getPublicContactConfig(undefined, value)
    assert.deepEqual(config.supportEmail, { value: 'hellogodwit@gmail.com', status: 'configured' })
    assert.equal(config.operator.status, 'missing')
  }
})

test('explicit deployment overrides remain validated, not silently replaced', () => {
  assert.equal(legal.getPublicContactConfig(undefined, ' help@example.com ').supportEmail.value, 'help@example.com')
  assert.equal(legal.getPublicContactConfig(undefined, 'invalid').supportEmail.status, 'invalid')
})
