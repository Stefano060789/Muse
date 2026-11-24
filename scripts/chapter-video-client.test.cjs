const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'chapterVideoClient.ts'), 'utf8')
const moduleUnderTest = { exports: {} }
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('module', 'exports', code)(moduleUnderTest, moduleUnderTest.exports)
const { videoBlob } = moduleUnderTest.exports
const size = 4 * 1024 * 1024
const part = (length, total = size + 8) => new Response(new Uint8Array(length), {
  headers: { 'Content-Type': 'video/mp4', 'X-Muse-Video-Total': String(total) }
})
async function main() {
  let requested = 0
  const result = await videoBlob(part(size), async offset => { requested = offset; return part(8) }, true)
  assert.equal(requested, size)
  assert.equal(result.size, size + 8)
  await assert.rejects(videoBlob(part(size), async () => part(7), true), /incomplete/)
  await assert.rejects(videoBlob(part(size), async () => part(8, size + 9), true), /changed/)
  await assert.rejects(videoBlob(new Response('legacy'), async () => { throw new Error('unexpected') }, true), /information/)
  assert.equal((await videoBlob(new Response('legacy'), async () => { throw new Error('unexpected') }, false)).size, 6)
  console.log('PASS authenticated chunk assembly and truncated or changed video rejection')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
