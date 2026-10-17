export function validateGiftCardLink(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/shared' || url.search ||
    !/^#play=[a-zA-Z0-9%._-]+$/.test(url.hash) || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    url.hostname === '[::1]' || /^127\./.test(url.hostname)) {
    throw new Error('Print only a public HTTPS recipient link, never a private management link.')
  }
  return url.href
}

export function giftCardHtml(recipientUrl: string, expiresAt: string, greeting: string, qr: string): string {
  validateGiftCardLink(recipientUrl)
  if (!Number.isFinite(Date.parse(expiresAt))) throw new Error('The gift expiry is invalid.')
  if (greeting.length > 240) throw new Error('Keep the printed greeting within 240 characters.')
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr)) throw new Error('The QR image is invalid.')
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Muse gift card</title><style>@page{margin:18mm}body{font-family:Georgia,serif;color:#202c42;text-align:center;padding:28px;background:#fffdf9;overflow-wrap:anywhere}article{border:1px solid #ac8450;padding:24px;border-radius:20px}h1{font-size:32px;font-weight:normal}p{line-height:1.7}img{width:200px;max-width:100%;height:auto}.link{font:12px sans-serif}small{font:12px sans-serif}</style></head><body><article><p>MUSE</p><h1>A story is waiting for you.</h1><p>${escape(greeting)}</p><img src="${qr}" alt="QR code for the recipient story link"><p>Scan with your phone camera to open your story.</p><p class="link">${escape(recipientUrl)}</p><small>Link expires ${escape(new Date(expiresAt).toLocaleString())}. Internet required. Anyone with this card can access the gift, subject to its content notice. Printing does not extend access.</small></article></body></html>`
}
