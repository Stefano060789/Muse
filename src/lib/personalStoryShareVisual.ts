function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  })[character]!)
}

function wrapText(value: string, limit: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && Array.from(word).length <= limit && Array.from(`${line} ${word}`).length > limit) {
      lines.push(line)
      line = ''
      if (lines.length === maxLines) break
    }
    const remaining = Array.from(word)
    while (remaining.length) {
      const available = limit - Array.from(line).length - (line ? 1 : 0)
      if (available <= 0) {
        lines.push(line)
        line = ''
        if (lines.length === maxLines) break
        continue
      }
      const part = remaining.splice(0, available).join('')
      line = line ? `${line} ${part}` : part
      if (remaining.length || Array.from(line).length >= limit) {
        lines.push(line)
        line = ''
        if (lines.length === maxLines) break
      }
    }
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.join('').replace(/\s/g, '').length < words.join('').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.…]+$/, '')}…`
  }
  return lines
}

export function createPersonalStoryShareSvg(input: {
  title: string
  teaser: string
  mood: string
  brand: string
  tagline: string
  url: string
}): string {
  const titleLines = wrapText(input.title, 26, 3)
  const teaserLines = wrapText(input.teaser, 44, 5)
  const titleMarkup = titleLines.map((line, index) =>
    `<tspan x="96" dy="${index ? 78 : 0}">${escapeXml(line)}</tspan>`).join('')
  const teaserMarkup = teaserLines.map((line, index) =>
    `<tspan x="96" dy="${index ? 44 : 0}">${escapeXml(line)}</tspan>`).join('')
  const titleY = 430
  const teaserY = titleY + titleLines.length * 78 + 94
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f8efe2"/><stop offset="1" stop-color="#e7e4f0"/></linearGradient></defs>
<rect width="1080" height="1350" rx="56" fill="url(#bg)"/>
<circle cx="930" cy="170" r="115" fill="#d7c6a5" opacity=".42"/><circle cx="115" cy="1200" r="190" fill="#b9bfd2" opacity=".32"/>
<text x="96" y="130" fill="#70566d" font-family="Georgia,serif" font-size="42">${escapeXml(input.brand)}</text>
<text x="96" y="245" fill="#70566d" font-family="Arial,sans-serif" font-size="28" letter-spacing="4">${escapeXml(input.mood.toUpperCase())}</text>
<text x="96" y="${titleY}" fill="#202c42" font-family="Georgia,serif" font-size="72" font-weight="700">${titleMarkup}</text>
<text x="96" y="${teaserY}" fill="#393440" font-family="Georgia,serif" font-size="34" line-height="1.5">${teaserMarkup}</text>
<path d="M96 1090h888" stroke="#70566d" stroke-opacity=".35" stroke-width="2"/>
<text x="96" y="1170" fill="#202c42" font-family="Arial,sans-serif" font-size="30">${escapeXml(input.tagline)}</text>
<text x="96" y="1230" fill="#70566d" font-family="Arial,sans-serif" font-size="24">${escapeXml(input.url)}</text>
</svg>`
}

export function personalStoryShareText(title: string, teaser: string, mood: string, footer: string, url: string): string {
  return `${title}\n\n${teaser}\n\n${mood}\n${footer} ${url}`
}

export const SHARE_CARD_SIZES = {
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 }
} as const
export type ShareCardFormat = keyof typeof SHARE_CARD_SIZES
export type ShareCardTheme = 'starlight' | 'paper' | 'dawn'

export function suggestStoryMoment(scenes: readonly { body: string }[], mood: string): {
  scene: string; passage: string; theme: ShareCardTheme
} {
  let index = scenes.length - 1
  while (index >= 0 && !scenes[index].body.trim()) index--
  const text = index < 0 ? '' : scenes[index].body.replace(/\s+/g, ' ').trim()
  const characters = Array.from(text)
  const excerpt = characters.slice(0, 199).join('')
  const sentenceEnd = Math.max(excerpt.lastIndexOf('. '), excerpt.lastIndexOf('! '), excerpt.lastIndexOf('? '), excerpt.lastIndexOf('。'))
  const passage = characters.length <= 200 ? text : sentenceEnd >= 60
    ? excerpt.slice(0, sentenceEnd + 1) : `${excerpt.trimEnd()}…`
  return {
    scene: index < 0 ? '' : String(index), passage,
    theme: mood === 'hopeful' ? 'dawn' : mood === 'relaxed' ? 'paper' : 'starlight'
  }
}
const palettes = {
  starlight: { bg: '#202c42', end: '#493650', ink: '#fff5e5', muted: '#e3d2c4', accent: '#e5c38c' },
  paper: { bg: '#fffaf0', end: '#e9e1d5', ink: '#202c42', muted: '#625366', accent: '#866136' },
  dawn: { bg: '#f7ddd1', end: '#e3dbee', ink: '#342d49', muted: '#63516a', accent: '#81562d' }
} as const

export function createStoryMomentSvg(input: {
  title: string; passage: string; reflection: string; milestone: string; progress: string
  theme: ShareCardTheme; format: ShareCardFormat; rtl: boolean
}): string {
  const { height } = SHARE_CARD_SIZES[input.format]
  const color = palettes[input.theme]
  const x = input.rtl ? 984 : 96
  const wideScript = /[\u3040-\u30ff\u3400-\u9fff]/u
  const lines = (text: string, size: number, y: number, limit: number, count: number, fill: string) =>
    `<text x="${x}" y="${y}" fill="${fill}" font-family="Georgia,serif" font-size="${size}" text-anchor="start" direction="${input.rtl ? 'rtl' : 'ltr'}">${wrapText(text, wideScript.test(text) ? Math.floor(limit / 2) : limit, count)
      .map((line, index) => `<tspan x="${x}" dy="${index ? size * 1.22 : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`
  const offset = (height - 1080) * 0.34
  const vertical = input.format === 'story'
  const titleY = vertical ? 400 : 250 + offset
  const passageY = vertical ? 790 : 465 + offset
  const reflectionY = vertical ? 1490 : 800 + offset
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img">
<defs><linearGradient id="moment-bg" x2="1" y2="1"><stop stop-color="${color.bg}"/><stop offset="1" stop-color="${color.end}"/></linearGradient></defs>
<rect width="1080" height="${height}" fill="url(#moment-bg)"/>
<circle cx="960" cy="130" r="290" fill="${color.accent}" opacity=".07"/>
<circle cx="90" cy="${height - 140}" r="260" fill="${color.accent}" opacity=".08"/>
<g fill="${color.accent}" opacity=".5">${Array.from({ length: 18 }, (_, i) =>
    `<circle cx="${i % 2 ? 68 : 1012}" cy="${180 + i * (height - 320) / 18}" r="${i % 3 === 0 ? 2 : 1}"/>`).join('')}</g>
<path d="M75 ${height - 55}Q350 ${height - 90} 540 ${height - 55}T1005 ${height - 55}" fill="none" stroke="${color.accent}" stroke-opacity=".3"/>
<rect x="42" y="42" width="996" height="${height - 84}" rx="28" fill="none" stroke="${color.accent}" stroke-opacity=".45"/>
<path d="M500 122h80m-40-40v80m-22-62 44 44m-44 0 44-44" stroke="${color.accent}" stroke-width="2"/>
${lines(input.milestone, vertical ? 32 : 25, vertical ? 300 : 187 + offset, 54, 1, color.accent)}
${lines(input.title.slice(0, 160), vertical ? 76 : 56, titleY, vertical ? 21 : 26, 3, color.ink)}
<path d="M96 ${vertical ? 685 : 410 + offset}h888" stroke="${color.accent}" stroke-opacity=".35"/>
${input.passage ? `<text x="${x}" y="${passageY - 15}" fill="${color.accent}" opacity=".18" font-family="Georgia,serif" font-size="140" direction="${input.rtl ? 'rtl' : 'ltr'}">“</text>` : ''}
${lines(input.passage.slice(0, 200), vertical ? 44 : 30, passageY, vertical ? 36 : 46, vertical ? 12 : 9, color.ink)}
${lines(input.reflection.slice(0, 120), vertical ? 34 : 27, reflectionY, vertical ? 38 : 46, vertical ? 4 : 3, color.muted)}
${lines(input.progress, 24, height - 157, 60, 2, color.accent)}
<text x="540" y="${height - 80}" text-anchor="middle" fill="${color.accent}" font-family="Georgia,serif" font-size="32" letter-spacing="5">MUSE</text>
</svg>`
}
