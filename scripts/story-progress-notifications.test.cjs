const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const values = new Map()
const events = []
global.window = {
  localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  },
  dispatchEvent: event => { events.push(event.type) }
}
function load(relative) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id.endsWith('/browserDrafts')) return {
      readDraft(key, validate) {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return null
        let value
        try { value = JSON.parse(raw) } catch { throw new Error('A saved draft could not be read.') }
        if (!validate(value)) throw new Error('A saved draft has an unsupported format.')
        return value
      },
      writeDraft(key, value) { window.localStorage.setItem(key, JSON.stringify(value)) }
    }
    throw new Error(`Unexpected dependency ${id}`)
  })
  return module.exports
}

const notifications = load('src/lib/storyProgressNotifications.ts')
const base = { opened: 1, finished: 0, furthestScene: 0, sceneCount: 5 }
assert.deepEqual(notifications.storyProgressEvents(null, base), [], 'Initial baseline does not produce alerts')
assert.equal(notifications.loadStoryProgressNotificationsEnabled(), true, 'Notifications default to enabled')
notifications.saveStoryProgressNotificationsEnabled(false)
assert.equal(notifications.loadStoryProgressNotificationsEnabled(), false)
assert.deepEqual(events, [notifications.STORY_PROGRESS_NOTIFICATION_CHANGE_EVENT])

assert.equal(notifications.storyProgressEvents(
  { opened: 0, finished: 0, furthestScene: null, sceneCount: 5 }, base
)[0].kind, 'first-open')
assert.equal(notifications.storyProgressEvents(
  base, { ...base, furthestScene: 1 }
)[0].kind, 'milestone')
assert.equal(notifications.storyProgressEvents(
  { ...base, furthestScene: 3 }, { ...base, furthestScene: 4, finished: 1 }
)[0].kind, 'completed', 'Completion takes precedence over a simultaneous progress milestone')
assert.equal(notifications.storyProgressEvents(
  { opened: 1, finished: 0, furthestScene: 2, sceneCount: null },
  { opened: 1, finished: 0, furthestScene: 3, sceneCount: null }
)[0].message, 'The group reached 3 live story actions.')
assert.deepEqual(notifications.storyProgressEvents(
  base, { ...base, furthestScene: 0 }
), [], 'Unchanged story progress does not notify')
console.log('PASS shared-story progress notification events and browser preference')
