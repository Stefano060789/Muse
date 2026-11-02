export function fitTextareaToContent(
  textarea: HTMLTextAreaElement,
  viewportHeight: number,
  followLatest: boolean
) {
  const maximumHeight = Math.max(80, Math.min(288, Math.floor(viewportHeight * 0.4)))
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, maximumHeight)}px`
  if (followLatest) textarea.scrollTop = textarea.scrollHeight
}
