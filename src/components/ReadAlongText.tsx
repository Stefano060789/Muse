export default function ReadAlongText({
  text,
  startAt,
  position,
  active
}: {
  text: string
  startAt: number
  position: number
  active: boolean
}) {
  if (!active) return <>{text}</>
  const tokens = []
  const pattern = /\s+|\S+/g
  const containsCjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(text)
  let codePointStart = 0
  let match: RegExpExecArray | null
  const parts = containsCjk
    ? Array.from(text, token => {
        const part = { token, index: codePointStart }
        codePointStart += token.length
        return part
      })
    : Array.from(text.matchAll(pattern), item => ({ token: item[0], index: item.index ?? 0 }))
  for (const { token, index } of parts) {
    const tokenStart = startAt + index
    if (active && tokenStart > position) break
    if (/^\s+$/.test(token)) {
      tokens.push(token)
      continue
    }
    const current = active && position >= tokenStart && position < tokenStart + token.length
    tokens.push(
      <span
        key={index}
        style={{
          background: current ? '#f2d58a' : undefined,
          borderRadius: 3,
          transition: 'background-color 120ms linear'
        }}
      >
        {token}
      </span>
    )
  }
  return <>{tokens}</>
}
