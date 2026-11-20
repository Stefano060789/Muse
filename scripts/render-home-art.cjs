// Renders Muse's original Home artwork ("The Garden of Stories") to WebP.
// Inspired by Leonardo's palette and sfumato, not a reproduction of any painting.
// Usage: node scripts/render-home-art.cjs
const path = require('path')
const sharp = require('sharp')

const W = 2000
const H = 1160
let seed = 1472
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const between = (min, max) => min + rand() * (max - min)
const pick = list => list[Math.floor(rand() * list.length)]
const f = n => Math.round(n * 10) / 10

function ridge(y0, amplitude, step, peaks = []) {
  let d = `M0 ${H} L0 ${y0}`
  for (let x = 0; x <= W; x += step) {
    let y = y0 + between(-amplitude, amplitude) * 0.35
    for (const [px, height, width] of peaks) y -= height * Math.exp(-(((x - px) / width) ** 2))
    d += ` L${x} ${f(y)}`
  }
  return `${d} L${W} ${H} Z`
}

function cypress(x, base, height, width) {
  const top = base - height
  return `<path d="M${x} ${top} C${f(x + width * 0.35)} ${f(top + height * 0.18)} ${f(x + width * 0.55)} ${f(base - height * 0.45)} ${f(x + width * 0.42)} ${base} L${f(x - width * 0.42)} ${base} C${f(x - width * 0.55)} ${f(base - height * 0.45)} ${f(x - width * 0.35)} ${f(top + height * 0.18)} ${x} ${top}Z"/>`
}

function pine(x, base, height, width) {
  const crown = base - height
  let canopy = ''
  for (let i = 0; i < 5; i++) {
    canopy += `<ellipse cx="${f(x + between(-width * 0.35, width * 0.35))}" cy="${f(crown + between(-10, 14))}" rx="${f(width * between(0.28, 0.42))}" ry="${f(between(14, 24))}"/>`
  }
  return `<path d="M${x - 3} ${base} L${x - 1} ${crown + 8} L${x + 2} ${crown + 8} L${x + 4} ${base}Z"/>${canopy}`
}

function meadow() {
  let grass = ''
  for (let i = 0; i < 1300; i++) {
    const y = between(790, H)
    const depth = (y - 790) / (H - 790)
    const x = between(0, W)
    const h = 6 + depth * 26
    grass += `<path d="M${f(x)} ${f(y)} q${f(between(-4, 4))} ${f(-h / 2)} ${f(between(-6, 6))} ${f(-h)}" stroke="${pick(['#53643a', '#3e4d2b', '#66763f', '#2f3b22'])}" stroke-width="${f(0.8 + depth * 1.6)}"/>`
  }
  let flowers = ''
  for (let i = 0; i < 950; i++) {
    const y = between(785, H)
    const depth = (y - 785) / (H - 785)
    const r = 0.9 + depth * 3.6
    flowers += `<circle cx="${f(between(0, W))}" cy="${f(y)}" r="${f(r)}" fill="${pick(['#f3ead2', '#f3ead2', '#e7c56f', '#c2573e', '#9fb4c8', '#efe0b0', '#d98a6a'])}" opacity="${f(0.55 + depth * 0.4)}"/>`
  }
  return `<g fill="none" stroke-linecap="round">${grass}</g><g>${flowers}</g>`
}

function lily(x, base, height, lean) {
  const tipX = x + lean
  const tipY = base - height
  let blooms = ''
  for (let i = 0; i < 3; i++) {
    const t = 0.15 + i * 0.22
    const bx = x + lean * (1 - t)
    const by = tipY + height * t
    const side = i % 2 ? 1 : -1
    blooms += `<g transform="translate(${f(bx)} ${f(by)}) rotate(${side * 38})">
      <path d="M0 0 C-9 -14 -15 -30 -7 -46 C-3 -32 3 -32 7 -46 C15 -30 9 -14 0 0Z" fill="url(#petal)"/>
      <path d="M0 -6 C-12 -22 -26 -32 -30 -44 C-18 -42 -8 -30 0 -6Z M0 -6 C12 -22 26 -32 30 -44 C18 -42 8 -30 0 -6Z" fill="#f7efdc" opacity="0.92"/>
      <path d="M0 -8 L-4 -38 M0 -8 L4 -38" stroke="#c99a3c" stroke-width="1.4"/>
    </g>`
  }
  let leaves = ''
  for (let i = 0; i < 6; i++) {
    const t = 0.35 + i * 0.1
    const lx = x + lean * (1 - t)
    const ly = tipY + height * t
    const side = i % 2 ? 1 : -1
    leaves += `<path d="M${f(lx)} ${f(ly)} q${side * 16} -8 ${side * 30} -30 q${-side * 18} 10 ${-side * 30} 30Z" fill="#4f6a3a"/>`
  }
  return `<g><path d="M${x} ${base} Q${f(x + lean * 0.2)} ${f(base - height * 0.5)} ${f(tipX)} ${f(tipY)}" stroke="#4a6236" stroke-width="3" fill="none"/>${leaves}${blooms}</g>`
}

function quoins(x, top, bottom) {
  let blocks = ''
  let y = top
  let wide = true
  while (y < bottom) {
    const h = 46
    const w = wide ? 92 : 58
    blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h - 4}" rx="2" fill="url(#pietra)"/><rect x="${x}" y="${y + h - 6}" width="${w}" height="3" fill="#5f625c" opacity="0.5"/>`
    y += h
    wide = !wide
  }
  return blocks
}

function swallows() {
  let birds = ''
  const flock = [[1400, 640, 1], [1330, 560, 0.9], [1260, 470, 0.8], [1190, 390, 0.7], [1080, 330, 0.62], [960, 260, 0.55], [1110, 230, 0.5], [860, 300, 0.48], [1230, 300, 0.55]]
  for (const [x, y, s] of flock) {
    birds += `<path transform="translate(${x} ${y}) scale(${s}) rotate(${f(between(-18, 10))})" d="M0 0 C-10 -12 -26 -14 -40 -8 C-26 -6 -14 -2 -4 6 L0 10 L4 6 C14 -2 26 -6 40 -8 C26 -14 10 -12 0 0Z"/>`
  }
  return birds
}

function buildSvg() {
  const cypresses = [[118, 720, 330, 54], [196, 724, 268, 46], [1010, 712, 300, 50], [1082, 716, 360, 58], [1160, 716, 250, 44], [1618, 718, 210, 40]]
    .map(args => cypress(...args)).join('')
  const pines = [[320, 716, 150, 120], [520, 712, 120, 96], [760, 712, 140, 110], [880, 714, 92, 76], [1260, 716, 130, 104]]
    .map(args => pine(...args)).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7f9a96"/><stop offset="0.35" stop-color="#b8c6b6"/>
    <stop offset="0.62" stop-color="#e9e2c6"/><stop offset="0.72" stop-color="#f6ecd0"/>
  </linearGradient>
  <radialGradient id="dawn" cx="0.5" cy="0.58" r="0.42">
    <stop offset="0" stop-color="#fff6dc" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e4e3cf"/><stop offset="1" stop-color="#a9b8ad"/>
  </linearGradient>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9cba8"/><stop offset="1" stop-color="#a99673"/>
  </linearGradient>
  <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#55653a"/><stop offset="0.5" stop-color="#3d4b29"/><stop offset="1" stop-color="#26301b"/>
  </linearGradient>
  <linearGradient id="plaster" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#d9ccb3"/><stop offset="1" stop-color="#ece3cf"/>
  </linearGradient>
  <linearGradient id="pietra" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a9aaa1"/><stop offset="1" stop-color="#7c7f78"/>
  </linearGradient>
  <linearGradient id="marble" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#cfc8b6"/><stop offset="0.45" stop-color="#f1ecdf"/><stop offset="1" stop-color="#b3ac9a"/>
  </linearGradient>
  <linearGradient id="paving" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d8c39b"/><stop offset="1" stop-color="#b79c70"/>
  </linearGradient>
  <linearGradient id="petal" x1="0" y1="0" x2="0" y2="-1">
    <stop offset="0" stop-color="#e8dcc0"/><stop offset="1" stop-color="#fffaf0"/>
  </linearGradient>
  <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c25a3c"/><stop offset="0.55" stop-color="#8e3427"/><stop offset="1" stop-color="#5e2119"/>
  </linearGradient>
  <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4f6c95"/><stop offset="1" stop-color="#22344f"/>
  </linearGradient>
  <radialGradient id="bookGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fff3c6" stop-opacity="0.95"/><stop offset="0.4" stop-color="#f0cf7a" stop-opacity="0.45"/><stop offset="1" stop-color="#f0cf7a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.55" cy="0.5" r="0.75">
    <stop offset="0.6" stop-color="#2a2316" stop-opacity="0"/><stop offset="1" stop-color="#2a2316" stop-opacity="0.45"/>
  </radialGradient>
  <filter id="sfumato3" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="sfumato6" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="foliage" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7"/>
    <feDisplacementMap in="SourceGraphic" scale="9"/>
    <feGaussianBlur stdDeviation="0.8"/>
  </filter>
  <filter id="canvas" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.55 -0.12"/>
  </filter>
  <filter id="brush" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="3" seed="11" result="strokes"/>
    <feColorMatrix in="strokes" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.85  0 0 0 0.5 -0.18"/>
  </filter>
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<ellipse cx="1000" cy="640" rx="980" ry="420" fill="url(#dawn)"/>
<g fill="#fbf4e1" opacity="0.55" filter="url(#soft)">
  <ellipse cx="420" cy="210" rx="260" ry="34"/><ellipse cx="1500" cy="170" rx="300" ry="30"/><ellipse cx="980" cy="360" rx="220" ry="22"/>
</g>

<g filter="url(#sfumato6)">
  <path d="${ridge(600, 20, 40, [[760, 230, 90], [900, 170, 70], [600, 120, 120], [1420, 150, 140], [1700, 90, 160]])}" fill="#b4c2bd" opacity="0.85"/>
</g>
<g filter="url(#sfumato3)">
  <path d="${ridge(640, 26, 30, [[300, 90, 150], [820, 120, 70], [1180, 110, 110], [1560, 70, 140]])}" fill="#93a8a4" opacity="0.9"/>
</g>
<rect x="0" y="640" width="${W}" height="56" fill="url(#water)" opacity="0.92"/>
<g stroke="#fbf6e6" stroke-width="2" opacity="0.6" filter="url(#sfumato3)">
  <path d="M420 656 H760 M820 668 H1260 M560 680 H980 M1300 662 H1600"/>
</g>
<g fill="#8b9c92" opacity="0.75" filter="url(#sfumato3)">
  <path d="M1360 646 v-30 h10 v-12 h8 v42 Z M1392 646 v-22 h26 v22 Z M1424 646 v-46 l6 -12 l6 12 v46 Z M1446 646 v-18 h34 v18 Z"/>
</g>
<path d="${ridge(690, 18, 50, [[180, 40, 200], [1400, 30, 260]])}" fill="#75876a" opacity="0.92" filter="url(#sfumato3)"/>

<g fill="#1d2a20" filter="url(#foliage)">${cypresses}</g>
<g fill="#26352a" filter="url(#foliage)">${pines}</g>

<path d="M0 712 H${W} V770 H0Z" fill="url(#wall)"/>
<path d="M0 704 H${W} V716 H0Z" fill="#e8dcbd"/>
<path d="M0 764 H${W} V776 H0Z" fill="#7b6c50" opacity="0.6"/>

<path d="M0 776 H${W} V${H} H0Z" fill="url(#field)"/>
${meadow()}

<g>
  <path d="M1690 ${H} L1760 776 H${W} V${H} Z" fill="url(#paving)"/>
  <g stroke="#9c8158" stroke-width="2" opacity="0.6" fill="none">
    <path d="M1745 860 H2000 M1728 950 H2000 M1708 1050 H2000 M1800 776 L1770 ${H} M1880 776 L1880 ${H} M1960 776 L1990 ${H}"/>
  </g>
  <path d="M1760 120 H${W} V780 H1760 Z" fill="url(#plaster)"/>
  <path d="M1840 300 H${W} V780 H1840 Z" fill="#3a3027" opacity="0.88"/>
  <path d="M1840 300 H${W} V420 C1950 330 1880 300 1840 300 Z" fill="#594a3b" opacity="0.5"/>
  <path d="M1848 760 H${W} V700 C1960 690 1900 720 1848 760Z" fill="#8e3427" opacity="0.65"/>
  ${quoins(1760, 120, 780)}
  <path d="M1760 120 H${W}" stroke="#7c7f78" stroke-width="10"/>
</g>

<ellipse cx="1440" cy="800" rx="320" ry="260" fill="url(#bookGlow)"/>
<g fill="none" stroke="#f3d78c" stroke-linecap="round">
  <path d="M1420 790 C1380 690 1420 610 1340 540 C1270 480 1250 400 1150 340" stroke-width="3" opacity="0.6"/>
  <path d="M1452 790 C1470 700 1420 640 1380 590 C1330 530 1340 440 1260 380" stroke-width="2" opacity="0.45"/>
  <path d="M1470 792 C1520 720 1480 620 1420 560 C1370 500 1300 420 1240 300" stroke-width="1.6" opacity="0.4"/>
</g>
<g fill="#3a3528" opacity="0.88">${swallows()}</g>

<g>
  <ellipse cx="1450" cy="1112" rx="200" ry="20" fill="#1c2114" opacity="0.55" filter="url(#sfumato3)"/>
  <path d="M1300 1100 H1600 L1590 1072 H1310 Z" fill="#b8b19f"/>
  <path d="M1340 1072 L1352 900 H1548 L1560 1072 Z" fill="url(#marble)"/>
  <path d="M1328 1072 H1572 V1056 H1328 Z M1344 916 H1556 V900 H1344 Z" fill="#c9c1ad"/>
  <g stroke="#a39b87" stroke-width="3" opacity="0.7">
    <path d="M1378 1052 L1382 920 M1414 1052 L1416 920 M1450 1052 V920 M1486 1052 L1484 920 M1522 1052 L1518 920"/>
  </g>
  <path d="M1352 900 L1350 880 H1550 L1548 900 Z" fill="#bdb5a1"/>
  <path d="M1330 880 H1570 V858 H1330 Z" fill="#ddd6c4"/>
  <path d="M1336 858 C1320 900 1310 960 1340 1010 C1350 960 1370 920 1400 880 Z" fill="url(#cloth)"/>
  <path d="M1336 858 C1352 900 1360 940 1340 1010" stroke="#5e2119" stroke-width="2" fill="none" opacity="0.6"/>
  <path d="M1350 858 L1450 836 L1550 858 L1550 850 L1450 826 L1350 850 Z" fill="#9a8e71"/>
  <path d="M1352 850 C1390 822 1420 820 1450 832 C1480 820 1510 822 1548 850 L1548 842 C1510 812 1480 812 1450 824 C1420 812 1390 812 1352 842 Z" fill="#fbf4df"/>
  <path d="M1356 842 C1392 812 1422 808 1450 822 L1450 816 C1422 802 1392 806 1360 832 Z" fill="#fffbef"/>
  <path d="M1450 822 C1478 808 1508 812 1544 842 L1540 832 C1508 806 1478 802 1450 816 Z" fill="#fffbef"/>
  <g stroke="#a99671" stroke-width="1" opacity="0.7">
    <path d="M1376 832 l52 -14 M1378 838 l50 -13 M1384 843 l44 -12 M1474 818 l52 14 M1474 825 l50 13 M1474 831 l44 12"/>
  </g>
  <path d="M1452 830 C1456 880 1440 920 1460 970 L1470 968 C1452 920 1466 880 1460 830 Z" fill="url(#ribbon)"/>
</g>

${lily(1220, 1150, 330, -40)}
${lily(1270, 1158, 270, 30)}
${lily(1650, 1150, 250, 26)}
${lily(140, 1160, 300, 30)}

<rect width="${W}" height="${H}" filter="url(#brush)" opacity="0.35"/>
<rect width="${W}" height="${H}" fill="#c9a86a" opacity="0.1"/>
<rect width="${W}" height="${H}" fill="url(#vignette)"/>
<rect width="${W}" height="${H}" filter="url(#canvas)" opacity="0.5"/>
</svg>`
}

async function main() {
  const out = path.join(__dirname, '..', 'public', 'illustrations')
  const master = await sharp(Buffer.from(buildSvg()), { density: 72 }).png().toBuffer()
  const outputs = await Promise.all([
    sharp(master).extract({ left: 1040, top: 40, width: 960, height: 1120 }).webp({ quality: 80, effort: 6 })
      .toFile(path.join(out, 'garden-of-stories-portrait.webp')),
    sharp(master).extract({ left: 0, top: 290, width: W, height: 870 }).resize(960, 418).webp({ quality: 80, effort: 6 })
      .toFile(path.join(out, 'garden-of-stories-panorama.webp'))
  ])
  for (const output of outputs) console.log(`${output.width}x${output.height}: ${output.size} bytes`)
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { buildSvg }
