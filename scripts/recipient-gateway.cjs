const http = require('node:http')

const PLAYER_ACTIONS = new Set(['open', 'next', 'guess', 'hint', 'skip', 'adventure', 'media', 'voice', 'reply'])

function createRecipientGateway(target = 'http://127.0.0.1:3102') {
  const upstream = new URL(target)
  if (upstream.protocol !== 'http:' || upstream.hostname !== '127.0.0.1') {
    throw new Error('The recipient gateway must target a loopback HTTP server.')
  }
  return http.createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    const fail = (status, error) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ error }))
    }
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    let url
    try {
      url = new URL(req.url, 'http://gateway.invalid')
    } catch {
      return fail(400, 'Invalid URL.')
    }
    const asset = /^\/_next\/static\/[A-Za-z0-9_./-]+$/.test(url.pathname) &&
      !url.pathname.split('/').includes('..')
    const api = req.method === 'POST' && url.pathname === '/api/shared-story' && !url.search
    const appAsset = ['/manifest.webmanifest', '/sw.js', '/icons/muse-180.png', '/icons/muse-192.png', '/icons/muse-512.png', '/icons/muse-maskable-512.png'].includes(url.pathname) && !url.search
    if (!api && !(req.method === 'GET' && (url.pathname === '/shared' || asset || appAsset || url.pathname === '/favicon.ico'))) {
      return fail(403, 'This address permits recipient playback only. Creation and management stay on the local Muse address.')
    }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) return fail(403, 'Cross-origin requests are not allowed.')
      } catch {
        return fail(403, 'Invalid origin.')
      }
    }
    let body
    if (api) {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return fail(415, 'Use a JSON story request.')
      const chunks = []
      let size = 0
      try {
        for await (const chunk of req) {
          size += chunk.length
          if (size > 20480) {
            fail(413, 'Story request is too large.')
            return
          }
          chunks.push(chunk)
        }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (!value || Array.isArray(value) || typeof value !== 'object' || !PLAYER_ACTIONS.has(value.action)) {
          return fail(403, 'Only open, next, guess, hint, skip, adventure, voice, reply and authorized media actions are public.')
        }
        body = JSON.stringify(value)
      } catch {
        return fail(400, 'Invalid JSON story request.')
      }
    }
    const headers = { Host: upstream.host, Accept: req.headers.accept || '*/*' }
    if (api) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(body)
      headers.Origin = upstream.origin
    }
    const proxy = http.request(new URL(url.pathname + url.search, upstream), {
      method: req.method, headers, timeout: 20000
    }, response => {
      res.statusCode = response.statusCode
      for (const name of ['content-type', 'content-length', 'cache-control', 'content-security-policy', 'cross-origin-resource-policy', 'content-disposition', 'service-worker-allowed']) {
        if (response.headers[name]) res.setHeader(name, response.headers[name])
      }
      response.on('error', () => res.destroy())
      response.pipe(res)
    })
    proxy.on('timeout', () => proxy.destroy(new Error('Upstream timed out')))
    proxy.on('error', error => {
      console.error('Recipient gateway upstream error:', error.code || error.name)
      if (!res.headersSent) fail(502, 'Local Muse is unavailable. Ask the creator to check that it is running.')
      else res.destroy()
    })
    res.on('close', () => proxy.destroy())
    proxy.end(body)
  })
}

if (require.main === module) {
  const port = Number(process.env.MUSE_GATEWAY_PORT || 3104)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid gateway port.')
  const server = createRecipientGateway(process.env.MUSE_GATEWAY_TARGET)
  server.on('error', error => { console.error('Recipient gateway failed:', error.message); process.exitCode = 1 })
  server.listen(port, '127.0.0.1', () => console.log(`Recipient-only gateway listening at http://127.0.0.1:${port}`))
}

module.exports = { createRecipientGateway }
