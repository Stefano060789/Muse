import type { ShareCardFormat } from './personalStoryShareVisual'

export const STORY_MOTIFS = ['map', 'sword', 'doorway', 'ocean', 'light'] as const
export type StoryMotif = typeof STORY_MOTIFS[number]
type Shape = { d: string; fill: string; stroke?: string; width?: number; opacity?: number }

export function suggestStoryMotif(title: string, passage: string): StoryMotif {
  const source = `${title} ${passage}`.toLowerCase()
  if (/\bmaps?\b|\bmappa\b|\bmapa\b|地图|мап|карт|خريط|नक्श/u.test(source)) return 'map'
  if (/\bswords?\b|\bspada\b|\bespada\b|剑|меч|سيف|तलवार/u.test(source)) return 'sword'
  if (/\bsea\b|\bocean\b|\bmare\b|\bmar\b|海|океан|мор[ея]|بحر|समुद्र/u.test(source)) return 'ocean'
  if (/\bdoors?\b|\bdoorway\b|\bgate\b|\bporta\b|\bpuerta\b|门|двер|باب|दरवाज़/u.test(source)) return 'doorway'
  return 'light'
}

export function storyArtworkBounds(format: ShareCardFormat) {
  return { x: 96, y: format === 'story' ? 210 : 145, width: 888,
    height: format === 'story' ? 520 : format === 'portrait' ? 400 : 300 }
}

const circle = (x: number, y: number, r: number) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

export function storyArtworkShapes(motif: StoryMotif, seconds: number): Shape[] {
  const phase = seconds / 6 * Math.PI * 2
  const gold = '#e5c38c'
  const shapes: Shape[] = [
    { d: 'M0 0H900V520H0Z', fill: '#182638' },
    { d: circle(680, 120, 180), fill: '#68526b', opacity: .24 },
    { d: 'M0 440Q250 330 480 440T900 400V520H0Z', fill: '#31404b' }
  ]
  const add = (d: string, fill = 'none', stroke?: string, width = 2, opacity = 1) =>
    shapes.push({ d, fill, stroke, width, opacity })
  if (motif === 'map') {
    const wind = Math.sin(phase) * 13
    add('M120 428Q420 480 780 422L720 470H170Z', '#0d1928', undefined, 0, .5)
    add(`M135 ${98 + wind}Q400 120 760 ${82 - wind}L790 ${420 + wind}Q420 390 110 ${445 - wind}Q155 260 135 ${98 + wind}Z`, '#dfc493', gold, 3)
    add('M190 300Q250 220 290 275T430 250T610 265T720 195M180 345Q340 300 400 350T710 330', 'none', '#8c795d', 3, .65)
    for (let i = 0; i < 6; i++) {
      const x = 230 + i * 72, y = 180 + i % 2 * 37
      add(`M${x - 24} ${y + 28}l24-42 28 42-28-13Z`, '#9c8d66', undefined, 0, .6)
    }
    add('M225 355Q370 215 480 310T690 220', 'none', '#ad7342', 5)
    for (let i = 0; i < 14; i++) {
      const t = ((i / 14 + seconds / 8) % 1)
      add(circle(225 + t * 465, 295 + Math.sin(t * Math.PI * 3) * 46, 3), '#fff3c7', undefined, 0, .8)
    }
    add(circle(670, 145, 35), 'none', '#7e6143', 2)
    add('M670 107l9 38-9 38-9-38Z', '#836447')
    add('M632 145l38-9 38 9-38 9Z', '#a18150')
    for (let i = 0; i < 3; i++) {
      const y = 130 + i * 140
      add(`M35 ${y}Q180 ${y - 55 + wind} 300 ${y}T865 ${y - 30}`, 'none', '#fff2d2', 2, .18)
    }
  } else if (motif === 'sword') {
    add('M0 420l140-110 100 90 150-40 190 70 140-110 180 90V520H0Z', '#263b3c')
    const lift = 16 * Math.sin(phase)
    add(circle(450, 240, 155 + Math.sin(phase) * 12), '#dcc39a', undefined, 0, .08)
    add(`M450 ${62 + lift}L487 ${298 + lift}l-37 30-37-30Z`, '#dce3df', '#f7edcd', 3)
    add(`M450 ${62 + lift}V${328 + lift}l-37-30Z`, '#879baa')
    add(`M360 ${301 + lift}Q450 ${280 + lift} 540 ${301 + lift}l-8 22Q450 ${309 + lift} 368 ${323 + lift}Z`, gold)
    add(`M433 ${319 + lift}h34v96h-34Z`, '#826149', gold, 3)
    add(circle(450, 423 + lift, 21), gold)
    const shineY = 90 + ((seconds / 4) % 1) * 200
    add(`M416 ${shineY}l34-12 34 12-34 12Z`, '#ffffff', undefined, 0, .8)
  } else if (motif === 'doorway') {
    add('M250 440V230a200 200 0 0 1 400 0V440Z', '#6d6570', gold, 3)
    add('M285 440V235a165 165 0 0 1 330 0V440Z', '#e7c794')
    add('M310 440V242a140 140 0 0 1 280 0V440Z', '#fff1c8')
    const opening = .5 + .28 * Math.sin(phase - .7)
    const edge = 310 + 280 * (1 - opening)
    add(`M310 440V242Q450 90 ${edge} ${242 - opening * 35}V${440 - opening * 25}Z`, '#594253', gold, 3)
    add(`M330 412V250Q410 160 ${edge - 22} 242V395Z`, 'none', '#b19a80', 3)
    add(circle(edge - 28, 320, 6), gold)
    add('M310 440l-120 80h540L590 440Z', '#ffe9ae', undefined, 0, .16 + opening * .14)
    add('M100 480Q140 340 205 295M760 480Q720 340 695 300', 'none', '#7b9184', 8)
  } else if (motif === 'ocean') {
    add(circle(690, 110, 45), '#fff0d0')
    for (let i = 0; i < 4; i++) {
      const y = 270 + i * 58, wave = Math.sin(phase + i) * 25
      add(`M0 ${y}Q115 ${y - 38 + wave} 225 ${y}T450 ${y}T675 ${y}T900 ${y}V520H0Z`,
        ['#465970', '#3b6574', '#35717b', '#254c60'][i], '#a8cbc4', 2)
    }
    const bob = Math.sin(phase) * 9
    add(`M350 ${283 + bob}h190l-35 38h-122Z`, '#bd9670', gold, 2)
    add(`M449 ${151 + bob}V${281 + bob}M452 ${157 + bob}l70 100h-70Z`, '#eddfbd', gold, 3)
    for (let i = 0; i < 6; i++) {
      const y = 230 + i * 35, spread = 13 + i * 10
      add(`M${690 - spread} ${y}q${spread} ${Math.sin(phase + i) * 10} ${spread * 2} 0`, 'none', gold, 3, .35)
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = (i * 137 + seconds * (8 + i % 3)) % 860 + 20
    const y = 35 + (i * 61) % 430 + Math.sin(phase + i) * 12
    add(circle(x, y, i % 3 === 0 ? 2.6 : 1.4), gold, undefined, 0, .2 + .3 * (1 + Math.sin(phase + i)) / 2)
  }
  return shapes
}

export function storyArtworkSvg(motif: StoryMotif, format: ShareCardFormat): string {
  const bounds = storyArtworkBounds(format)
  return `<svg x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 900 520" preserveAspectRatio="none" data-story-motif="${motif}">${storyArtworkShapes(motif, 0).map(shape =>
    `<path d="${shape.d}" fill="${shape.fill}" stroke="${shape.stroke ?? 'none'}" stroke-width="${shape.width ?? 0}" opacity="${shape.opacity ?? 1}"/>`).join('')}</svg>`
}

export function createStoryFrameSvg(motif: StoryMotif): string {
  const paths = storyArtworkShapes(motif, 0).map(shape =>
    `<path d="${shape.d}" fill="${shape.fill}" stroke="${shape.stroke ?? 'none'}" stroke-width="${shape.width ?? 0}" opacity="${shape.opacity ?? 1}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280"><rect width="720" height="1280" fill="#182638"/><g transform="translate(0 432) scale(.8)">${paths}</g></svg>`
}

export function drawStoryArtwork(context: CanvasRenderingContext2D, motif: StoryMotif, format: ShareCardFormat, seconds: number): void {
  const bounds = storyArtworkBounds(format)
  context.save()
  context.translate(bounds.x, bounds.y)
  context.scale(bounds.width / 900, bounds.height / 520)
  for (const shape of storyArtworkShapes(motif, seconds)) {
    const path = new Path2D(shape.d)
    context.globalAlpha = shape.opacity ?? 1
    context.fillStyle = shape.fill
    if (shape.fill !== 'none') context.fill(path)
    if (shape.stroke) {
      context.strokeStyle = shape.stroke
      context.lineWidth = shape.width ?? 2
      context.stroke(path)
    }
  }
  context.restore()
}
