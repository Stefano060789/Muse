export function readDraft<T>(key: string, validate: (value: unknown) => value is T): T | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('A saved draft could not be read. It has not been overwritten.') }
  if (!validate(value)) throw new Error('A saved draft has an unsupported format. It has not been overwritten.')
  return value
}

export function writeDraft(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function removeDraft(key: string): void {
  window.localStorage.removeItem(key)
}
