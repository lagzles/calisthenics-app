/**
 * Gera os ícones PNG do PWA sem dependências externas (usa apenas zlib + fs).
 *
 * Uso: npm run icons
 * Os arquivos são gravados em public/icons.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const BG = [0x0a, 0x0f, 0x0d, 0xff]
const GLYPH = [0x2f, 0xe0, 0x6b, 0xff]

let crcTable = null
function makeCrcTable() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
}

function crc32(buf) {
  if (!crcTable) crcTable = makeCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function drawIcon(size, glyphScale) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const GW = 0.62 * size * glyphScale
  const plateW = 0.11 * size * glyphScale
  const plateH = 0.3 * size * glyphScale
  const barH = 0.085 * size * glyphScale
  const barW = GW - plateW

  const rects = [
    { x0: cx - GW / 2, x1: cx - GW / 2 + plateW, y0: cy - plateH / 2, y1: cy + plateH / 2 },
    { x0: cx + GW / 2 - plateW, x1: cx + GW / 2, y0: cy - plateH / 2, y1: cy + plateH / 2 },
    { x0: cx - barW / 2, x1: cx + barW / 2, y0: cy - barH / 2, y1: cy + barH / 2 },
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG
      for (const r of rects) {
        if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) {
          color = GLYPH
          break
        }
      }
      const i = (y * size + x) * 4
      rgba[i] = color[0]
      rgba[i + 1] = color[1]
      rgba[i + 2] = color[2]
      rgba[i + 3] = color[3]
    }
  }
  return rgba
}

const outDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const targets = [
  { name: 'pwa-192x192.png', size: 192, scale: 0.9 },
  { name: 'pwa-512x512.png', size: 512, scale: 0.9 },
  { name: 'pwa-maskable-512x512.png', size: 512, scale: 0.72 },
  { name: 'apple-touch-icon.png', size: 180, scale: 0.9 },
]

for (const t of targets) {
  const rgba = drawIcon(t.size, t.scale)
  const png = encodePng(t.size, t.size, rgba)
  fs.writeFileSync(path.join(outDir, t.name), png)
  console.log('gerado', t.name, png.length, 'bytes')
}
