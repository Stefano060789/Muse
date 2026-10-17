const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const qr = require('qrcode')
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'giftCard.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const result = { exports: {} }
new Function('module', 'exports', compiled)(result, result.exports)
const { giftCardHtml, validateGiftCardLink } = result.exports
async function main() {
  const link = 'https://muse.example/shared#play=synthetic-fixture.123456'
  assert.equal(validateGiftCardLink(link), link)
  for (const invalid of ['https://muse.example/shared#manage=secret', 'http://muse.example/shared#play=fixture', 'https://localhost/shared#play=fixture', 'https://muse.example/shared?owner=secret#play=fixture', 'https://user:password@muse.example/shared#play=fixture', 'https://muse.example/shared#play=fixture&manage=secret']) {
    assert.throws(() => validateGiftCardLink(invalid))
  }
  const png = await qr.toDataURL(link, { width: 360, margin: 4, errorCorrectionLevel: 'M' })
  assert.match(png, /^data:image\/png;base64,/)
  assert.equal(Buffer.from(png.split(',')[1], 'base64').subarray(1, 4).toString(), 'PNG')
  const html = giftCardHtml(link, '2099-01-01T00:00:00Z', '<script>alert("hello")</script>', png)
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes(link))
  assert.ok(html.includes('Printing does not extend access'))
  assert.ok(html.includes('default-src \'none\''))
  assert.ok(!html.includes('#manage='))
  assert.throws(() => giftCardHtml(link, 'invalid', 'Hello', png))
  assert.throws(() => giftCardHtml(link, '2099-01-01', 'x'.repeat(241), png))
  assert.throws(() => giftCardHtml(link, '2099-01-01', 'Hello', 'https://external.example/qr'))
  console.log('PASS gift card validates recipient-only HTTPS links, creates real local PNG QR, escapes greetings and discloses expiry without private content')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
