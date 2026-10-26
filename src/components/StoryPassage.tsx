import ReadAlongText from './ReadAlongText'

export default function StoryPassage({ text, narrationText, position, active, mode }: {
  text: string; narrationText: string; position: number; active: boolean; mode?: 'read' | 'listen' | null
}) {
  if (mode === null) return null
  const start = (narrationText || '').indexOf(text)
  return <ReadAlongText text={text} startAt={Math.max(0, start)} position={start >= 0 ? position : -1} active={mode === 'listen' || (active && start >= 0)} />
}
