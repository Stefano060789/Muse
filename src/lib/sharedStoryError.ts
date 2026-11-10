export class SharedStoryError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message)
    this.name = 'SharedStoryError'
  }
}
