const assert = require('node:assert/strict')
const http = require('node:http')
const { createRecipientGateway } = require('./recipient-gateway.cjs')

async function main() {
  const calls = []
  const upstream = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    calls.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const gateway = createRecipientGateway(`http://127.0.0.1:${upstream.address().port}`)
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${gateway.address().port}`
  const post = value => fetch(`${origin}/api/shared-story`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(value) })
  try {
    for (const path of ['/shared', '/_next/static/chunks/main-123.js', '/manifest.webmanifest', '/sw.js', '/icons/muse-180.png', '/icons/muse-192.png', '/icons/muse-512.png', '/icons/muse-maskable-512.png', '/illustrations/lantern-garden.svg']) assert.equal((await fetch(origin + path)).status, 200)
    for (const action of ['open', 'next', 'guess', 'hint', 'skip', 'adventure', 'media', 'voice', 'reply', 'studio-audio']) assert.equal((await post({ action, token: 'fixture', guess: 'test' })).status, 200)
    const before = calls.length
    for (const action of ['create', 'manage', 'share', 'delete', 'media-start', 'media-finish', 'media-cancel', 'media-delete', 'media-preview', 'voice-start', 'voice-finish', 'voice-cancel', 'voice-delete', 'voice-preview', 'studio-status', 'studio-generate', 'unknown']) assert.equal((await post({ action })).status, 403)
    assert.equal((await post({ action: 'studio-audio', preview: true })).status, 403)
    assert.equal((await post({ action: 'studio-audio', preview: false })).status, 403)
    assert.equal((await fetch(origin + '/api/shared-story-upload', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: 'x' })).status, 403)
    for (const path of ['/', '/api/tts', '/api/personal-story', '/api/profile', '/.env.local', '/data/muse-stories.sqlite', '/_next/image', '/api/shared-story?bypass=1', '/icons/unapproved.png', '/illustrations/unapproved.svg', '/illustrations/lantern-garden.svg?bypass=1', '/sw.js?bypass=1', '/_next/static/%2e%2e/%2e%2e/api/profile']) {
      assert.equal((await fetch(origin + path)).status, 403)
    }
    assert.equal((await post(null)).status, 403)
    assert.equal((await post({ action: 'open', token: 'x'.repeat(21000) })).status, 413)
    assert.equal((await fetch(origin + '/api/shared-story', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elsewhere.invalid' }, body: '{"action":"open"}' })).status, 403)
    assert.equal(calls.length, before, 'Rejected requests must never reach Muse')
    const last = calls.at(-1)
    assert.equal(last.headers.origin, `http://127.0.0.1:${upstream.address().port}`)
    assert.equal(last.headers['x-forwarded-for'], undefined)
    assert.throws(() => createRecipientGateway('https://elsewhere.invalid'), /loopback/)
    console.log('PASS recipient gateway: assets/player allowed; paid APIs, owner actions, traversal, oversized and cross-origin requests blocked before upstream')
  } finally {
    await Promise.all([new Promise(resolve => gateway.close(resolve)), new Promise(resolve => upstream.close(resolve))])
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
