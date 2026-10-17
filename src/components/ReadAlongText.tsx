import type { ReactNode } from 'react'

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
  const tokens: ReactNode[] = []
  const pattern = /\s+|\S+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const token = match[0]
    if (/^\s+$/.test(token)) {
      tokens.push(token)
      continue
    }
    const tokenStart = startAt + match.index
    const current = active && position >= tokenStart && position < tokenStart + token.length
    const completed = active && position >= tokenStart + token.length
    tokens.push(
      <span
        key={match.index}
        style={{
          background: current ? '#f2d58a' : completed ? '#e8eee3' : undefined,
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
