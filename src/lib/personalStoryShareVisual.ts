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
  if (lines.join('').length < words.join('').length) {
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
