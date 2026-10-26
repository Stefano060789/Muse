import ReadAlongText from './ReadAlongText'

export default function StoryPassage({ text, narrationText, position, active }: {
  text: string; narrationText: string; position: number; active: boolean
}) {
  const start = (narrationText || '').indexOf(text)
  return <ReadAlongText text={text} startAt={Math.max(0, start)} position={position} active={active && start >= 0} />
}
