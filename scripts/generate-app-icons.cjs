const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const header = Buffer.alloc(4), checksum = Buffer.alloc(4)
  header.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([header, body, checksum])
}
function png(size) {
  const pixels = Buffer.alloc(size * (size * 3 + 1))
  const lines = [[0.29, 0.69, 0.29, 0.31], [0.29, 0.31, 0.5, 0.55], [0.5, 0.55, 0.71, 0.31], [0.71, 0.31, 0.71, 0.69]]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + 0.5) / size, py = (y + 0.5) / size
    const ink = lines.some(([x1, y1, x2, y2]) => {
      const dx = x2 - x1, dy = y2 - y1
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
      return Math.hypot(px - x1 - t * dx, py - y1 - t * dy) < 0.027
    })
    const offset = y * (size * 3 + 1) + 1 + x * 3
    pixels.set(ink ? [247, 243, 237] : [45, 41, 38], offset)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}
const output = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(output, { recursive: true })
for (const size of [180, 192, 512]) fs.writeFileSync(path.join(output, `muse-${size}.png`), png(size))
fs.writeFileSync(path.join(output, 'muse-maskable-512.png'), png(512))
console.log('Generated original Muse app icons')
