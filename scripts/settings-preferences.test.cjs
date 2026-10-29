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
    if (id === 'react') return { useEffect() {}, useState: initial => [initial, () => undefined] }
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
    if (id.endsWith('/storyLanguage')) return load('src/lib/storyLanguage.ts')
    throw new Error(`Unexpected dependency ${id}`)
  })
  return module.exports
}

const interfaceLanguage = load('src/lib/interfaceLanguage.ts')
const interfacePages = load('src/lib/interfacePages.ts')
const profile = load('src/lib/profilePreferences.ts')
assert.equal(interfaceLanguage.loadInterfaceLanguage(), 'en-US')
assert.equal(interfaceLanguage.interfaceText('navSettings', 'en-US'), 'Settings')
assert.equal(interfaceLanguage.interfaceText('navSettings', 'it-IT'), 'Impostazioni')
interfaceLanguage.saveInterfaceLanguage('ar-SA')
assert.equal(interfaceLanguage.loadInterfaceLanguage(), 'ar-SA')
assert.deepEqual(events, [interfaceLanguage.INTERFACE_LANGUAGE_CHANGE_EVENT])
assert.throws(() => interfaceLanguage.saveInterfaceLanguage('fr-FR'), /supported Muse interface language/)
for (const language of ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']) {
  assert.ok(interfacePages.interfacePageText('myselfTitle', language))
  assert.ok(interfacePages.interfacePageText('archiveTitle', language))
  assert.ok(interfacePages.interfacePageText('giftTitle', language))
  assert.ok(interfacePages.giftFormText('whoFor', language))
  assert.ok(interfacePages.archiveSyncNote(language))
}
assert.equal(interfacePages.interfacePageText('archiveTitle', 'it-IT'), 'Archivio')
assert.equal(interfacePages.giftFormText('birthday', 'es-ES'), 'Cumpleaños')
assert.equal(interfacePages.interfacePageText('personalStoryTitle', 'zh-CN'), '为自己创建故事')

profile.saveProfileDisplayName('  Alex  ')
assert.equal(profile.loadProfileDisplayName(), 'Alex')
assert.throws(() => profile.saveProfileDisplayName('x'.repeat(41)), /40 characters/)
console.log('PASS Settings interface language and profile-name preferences')
