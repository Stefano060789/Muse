const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.library-tests-'))
let passed = 0
function check(name, run) { run(); passed++; console.log(`PASS ${name}`) }
async function checkAsync(name, run) { await run(); passed++; console.log(`PASS ${name}`) }
function memory(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    values,
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) }
  }
}
async function main() {
try {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/storyLibrary.ts', 'src/lib/sharedStorySharing.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--strict', '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const lib = require(path.join(output, 'storyLibrary.js'))
  const sharing = require(path.join(output, 'sharedStorySharing.js'))
  const { createPersonalStory, answerPersonalStory, loadPersonalStory, savePersonalStory } = require(path.join(output, 'story.js'))
  const personal = id => ({ ...createPersonalStory('curious'), id })
  const shared = ownerToken => ({
    ownerToken, playToken: 'recipient-secret', expiresAt: '2030-01-01T00:00:00.000Z',
    brief: {
      creatorName: 'A', recipientName: 'B', narration: 'Warm', setting: 'An old library.',
      recipientHints: 'A favourite book.', goal: 'Find the letter.', solution: 'blue book',
      message: 'A private message', durationMinutes: 5
    },
    content: { title: 'Shared mystery', description: 'A mystery', scenes: [{ title: 'Begin', body: 'An invitation.', clue: 'Look nearby.' }] }
  })
  const read = store => {
    const result = lib.loadStoryLibrary(store)
    assert.equal(result.error, null)
    return result
  }
  function mountLibrary(stories, origin = 'https://muse.example') {
    const ts = require('typescript')
    const store = memory()
    for (const story of stories) lib.saveLibraryCreatorStory(story, store)
    const states = [], effects = [], copied = []
    let cursor = 0, mounted = false, tick, clock = Date.parse('2026-10-15T00:00:00Z')
    const jsx = (type, props) => ({ type, props: props || {} })
    const react = {
      useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
        return [states[index], value => { states[index] = value }]
      },
      useEffect(effect) { if (!mounted) effects.push(effect) }
    }
    const module = { exports: {} }
    const browser = {
      location: { origin }, addEventListener() {}, removeEventListener() {},
      setInterval(callback) { tick = callback; return 1 }, clearInterval() {},
      confirm() { return true }
    }
    const clipboard = { async writeText(value) { copied.push(value) } }
    const source = fs.readFileSync(path.join(root, 'src', 'pages', 'library.tsx'), 'utf8')
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
      reportDiagnostics: true
    })
    assert.deepEqual(compiled.diagnostics, [])
    require('node:vm').runInNewContext(compiled.outputText, {
      module, exports: module.exports, window: browser, navigator: { clipboard },
      Date: class extends Date { static now() { return clock } },
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
        if (name === 'next/head' || name === 'next/link') return { __esModule: true, default: name === 'next/link' ? 'a' : 'head' }
        if (name === '../lib/sharedStorySharing') return sharing
        if (name === '../lib/storyLibrary') return {
          loadStoryLibrary: () => lib.loadStoryLibrary(store),
          removeLibraryEntry: (kind, id) => lib.removeLibraryEntry(kind, id, store),
          selectPersonalStory: id => lib.selectPersonalStory(id, store)
        }
        throw new Error(`Unexpected UI dependency: ${name}`)
      }
    })
    const render = () => { cursor = 0; return module.exports.default() }
    render()
    mounted = true
    const cleanups = effects.map(effect => effect())
    return {
      render, copied, clipboard, store,
      advance(value, update = true) { clock = Date.parse(value); if (update) tick() },
      cleanup() { cleanups.forEach(cleanup => cleanup?.()) }
    }
  }
  function nodes(tree) {
    if (tree == null || typeof tree === 'boolean') return []
    if (Array.isArray(tree)) return tree.flatMap(nodes)
    return typeof tree === 'object' ? [tree, ...nodes(tree.props.children)] : [tree]
  }
  const textOf = tree => nodes(tree).filter(node => typeof node === 'string' || typeof node === 'number').join(' ')
  const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && textOf(node) === label)
  check('migrates both legacy keys once, preserves copies and deduplicates stable IDs', () => {
    const a = personal('a'), b = shared('owner-a')
    const store = memory({ 'muse-personal-story': JSON.stringify(a), 'muse-shared-creator': JSON.stringify(b) })
    assert.equal(read(store).library.entries.length, 2)
    lib.saveLibraryPersonalStory(a, store)
    lib.saveLibraryCreatorStory(b, store)
    assert.equal(read(store).library.entries.length, 2)
    assert.equal(store.getItem('muse-personal-story'), JSON.stringify(a))
  })
  check('retains many personal and shared stories without arbitrary eviction', () => {
    const store = memory()
    for (let i = 0; i < 60; i++) {
      lib.saveLibraryPersonalStory(personal(`p-${i}`), store)
      lib.saveLibraryCreatorStory(shared(`s-${i}`), store)
    }
    const result = read(store)
    assert.equal(result.library.entries.length, 120)
    assert.equal(lib.latestPersonalStory(result).id, 'p-59')
    assert.equal(lib.latestCreatorStory(result).ownerToken, 's-59')
  })
  check('reopens an older story locally and saves its answers and progress independently', () => {
    const store = memory()
    lib.saveLibraryPersonalStory(personal('old'), store)
    lib.saveLibraryPersonalStory(personal('new'), store)
    lib.selectPersonalStory('old', store)
    const next = answerPersonalStory(lib.latestPersonalStory(read(store)), 'Choose curiosity')
    lib.saveLibraryPersonalStory(next, store)
    assert.equal(lib.latestPersonalStory(read(store)).currentStep, 1)
    assert.equal(read(store).library.entries.find(entry => entry.id === 'new').story.currentStep, 0)
    assert.deepEqual(JSON.parse(store.getItem('muse-personal-story')).responses, ['Choose curiosity'])
  })
  check('public personal persistence uses the indexed browser library', () => {
    const store = memory()
    global.window = { localStorage: store }
    savePersonalStory(personal('a'))
    savePersonalStory(personal('b'))
    lib.selectPersonalStory('a')
    assert.equal(loadPersonalStory().id, 'a')
    assert.equal(read(store).library.entries.length, 2)
    delete global.window
  })
  check('public personal loader reports corrupt library rather than silently dropping it', () => {
    const store = memory({ [lib.STORY_LIBRARY_KEY]: '{bad' })
    global.window = { localStorage: store }
    assert.throws(() => loadPersonalStory(), /not replaced/)
    assert.equal(store.getItem(lib.STORY_LIBRARY_KEY), '{bad')
    delete global.window
  })
  check('deletion affects only local entries and stale legacy copies cannot resurrect them', () => {
    const a = personal('a'), b = shared('owner-a'), store = memory()
    lib.saveLibraryPersonalStory(a, store)
    lib.saveLibraryCreatorStory(b, store)
    lib.removeLibraryEntry('personal', 'a', store)
    lib.removeLibraryEntry('shared', 'owner-a', store)
    assert.equal(store.getItem('muse-personal-story'), null)
    assert.equal(store.getItem('muse-shared-creator'), null)
    store.setItem('muse-personal-story', JSON.stringify(a))
    store.setItem('muse-shared-creator', JSON.stringify(b))
    assert.equal(read(store).library.entries.length, 0)
    assert.equal(lib.latestPersonalStory(read(store)), null)
    assert.equal(lib.latestCreatorStory(read(store)), null)
  })
  check('deleting latest chooses a remaining entry and rotates its compatibility copy', () => {
    const store = memory()
    lib.saveLibraryPersonalStory(personal('a'), store)
    lib.saveLibraryPersonalStory(personal('b'), store)
    lib.removeLibraryEntry('personal', 'b', store)
    assert.equal(lib.latestPersonalStory(read(store)).id, 'a')
    assert.equal(JSON.parse(store.getItem('muse-personal-story')).id, 'a')
  })
  check('corrupt and future-version libraries block writes without altering any keys', () => {
    for (const value of ['{broken', '{"version":2,"entries":[]}', 'null']) {
      const store = memory({ [lib.STORY_LIBRARY_KEY]: value, 'muse-personal-story': JSON.stringify(personal('legacy')) })
      const before = [...store.values]
      assert.ok(lib.loadStoryLibrary(store).error)
      assert.throws(() => lib.saveLibraryPersonalStory(personal('a'), store), /not replaced/)
      assert.deepEqual([...store.values], before)
    }
  })
  check('malformed legacy data is not removed or overwritten during migration', () => {
    for (const key of ['muse-personal-story', 'muse-shared-creator']) {
      const store = memory({ [key]: '{"bad":true}' })
      assert.ok(lib.loadStoryLibrary(store).error)
      assert.equal(store.getItem(lib.STORY_LIBRARY_KEY), null)
      assert.equal(store.getItem(key), '{"bad":true}')
      assert.throws(() => lib.saveLibraryPersonalStory(personal('a'), store))
    }
  })
  check('explicit schema validators reject malformed nested shapes and references', () => {
    const valid = personal('valid')
    for (const update of [
      { id: '' }, { currentStep: -1 }, { currentStep: 99 }, { currentStep: 0.5 },
      { scenes: [] }, { scenes: [{ title: 'x', body: 'y', question: 'z', choices: [2] }] },
      { responses: [null] }, { createdAt: 'bad date' }, { mood: 'invalid' },
      { profileKeypoints: 'oops' }, { narrationStyle: 'unknown' }, { narrationLanguage: 'bad!' }
    ]) assert.throws(() => lib.validatePersonalStory({ ...valid, ...update }))
    assert.throws(() => lib.validateCreatorStory({ ...shared('a'), brief: {} }))
    assert.throws(() => lib.validateCreatorStory({ ...shared('a'), content: { scenes: [null] } }))
    assert.throws(() => lib.validateCreatorStory({ ...shared('a'), ownerToken: 4 }))
    const entry = { kind: 'personal', id: valid.id, updatedAt: valid.createdAt, story: valid }
    const base = { version: 1, entries: [entry], latestPersonal: valid.id, latestShared: null }
    assert.throws(() => lib.validateStoryLibrary({ ...base, entries: [entry, entry] }))
    assert.throws(() => lib.validateStoryLibrary({ ...base, latestPersonal: 'missing' }))
    assert.throws(() => lib.validateStoryLibrary({ ...base, entries: [{ ...entry, id: 'mismatch' }] }))
  })
  check('unavailable storage and quota failure are explicit and preserve existing library', () => {
    const denied = { getItem() { throw new Error('denied') }, setItem() {}, removeItem() {} }
    assert.match(lib.loadStoryLibrary(denied).error, /permissions/)
    assert.throws(() => lib.saveLibraryPersonalStory(personal('a'), denied))
    const store = memory()
    lib.saveLibraryPersonalStory(personal('old'), store)
    const before = [...store.values]
    store.setItem = () => { throw new Error('quota') }
    assert.throws(() => lib.saveLibraryPersonalStory(personal('new'), store), /quota/)
    assert.deepEqual([...store.values], before)
  })
  check('compatibility write failure reports that the canonical save succeeded', () => {
    const store = memory()
    const set = store.setItem
    store.setItem = (key, value) => {
      if (key === 'muse-personal-story') throw new Error('denied')
      set(key, value)
    }
    assert.throws(() => lib.saveLibraryPersonalStory(personal('a'), store), /library change was saved/)
    assert.equal(lib.latestPersonalStory(read(store)).id, 'a')
  })
  check('failed legacy cleanup still cannot resurrect a canonically removed entry', () => {
    const store = memory()
    lib.saveLibraryCreatorStory(shared('a'), store)
    const stale = store.getItem('muse-shared-creator')
    store.removeItem = () => { throw new Error('denied') }
    assert.throws(() => lib.removeLibraryEntry('shared', 'a', store), /library change was saved/)
    assert.equal(store.getItem('muse-shared-creator'), stale)
    assert.equal(read(store).library.entries.length, 0)
  })
  check('gift occasion, dedication and reply opt-in survive library save and reuse', () => {
    const store = memory(), story = shared('gift')
    story.brief.gift = { occasion: 'birthday', dedication: 'A little adventure for you.', allowReply: true }
    lib.saveLibraryCreatorStory(story, store)
    assert.deepEqual(read(store).library.entries[0].story.brief.gift, story.brief.gift)
  })
  check('expired shared entries are retained for explicit local removal without any API calls', () => {
    const store = memory(), story = shared('expired')
    story.expiresAt = '2000-01-01T00:00:00.000Z'
    lib.saveLibraryCreatorStory(story, store)
    assert.equal(lib.latestCreatorStory(read(store)).expiresAt, story.expiresAt)
  })
  check('saving another shared story appends and updating an older one preserves other local briefs', () => {
    const store = memory(), first = shared('first'), second = shared('second')
    lib.saveLibraryCreatorStory(first, store)
    lib.saveLibraryCreatorStory(second, store)
    first.content.title = 'Updated first mystery'
    first.expiresAt = '2000-01-01T00:00:00.000Z'
    lib.saveLibraryCreatorStory(first, store)
    const entries = read(store).library.entries
    assert.equal(entries.length, 2)
    assert.deepEqual(entries.find(entry => entry.id === 'second').story, lib.validateCreatorStory(second))
    assert.equal(entries.find(entry => entry.id === 'first').story.content.title, first.content.title)
    assert.equal(entries.find(entry => entry.id === 'first').story.brief.message, first.brief.message)
  })
  await checkAsync('shared library separates actions, copies only recipient capability, and hides private brief fields', async () => {
    const story = shared('owner/#? private')
    story.playToken = 'recipient/#? token'
    const ui = mountLibrary([story])
    try {
      const tree = ui.render(), all = nodes(tree), text = textOf(tree)
      assert.ok(all.some(node => node.props?.id === 'personal-stories-heading'))
      assert.ok(all.some(node => node.props?.id === 'shared-stories-heading'))
      assert.ok(all.some(node => node.props?.href === `/shared#manage=${encodeURIComponent(story.ownerToken)}`))
      assert.ok(all.some(node => node.props?.href === `/shared#reuse=${encodeURIComponent(story.ownerToken)}`))
      assert.ok(text.includes(story.expiresAt))
      assert.ok(text.includes('not backed up or synced across devices'))
      assert.ok(text.includes('independently of recipient completion and server expiry'))
      assert.ok(text.includes('Recipient progress and completion are not tracked here'))
      assert.ok(text.includes('private owner access; do not share them'))
      for (const field of ['message', 'solution', 'recipientHints']) assert.ok(!text.includes(story.brief[field]))
      const copy = button(tree, 'Copy recipient link')
      assert.equal(copy.props.disabled, false)
      await copy.props.onClick()
      assert.deepEqual(ui.copied, [sharing.recipientShareDetails('https://muse.example', story.playToken).url])
      assert.ok(!ui.copied[0].includes('owner'))
      assert.ok(textOf(ui.render()).includes('Recipient link copied'))
    } finally { ui.cleanup() }
  })
  await checkAsync('expired and missing recipient links disable copy without disabling local brief reuse', async () => {
    for (const variant of ['expired', 'missing']) {
      const story = shared(variant)
      if (variant === 'expired') story.expiresAt = '2000-01-01T00:00:00.000Z'
      else delete story.playToken
      const ui = mountLibrary([story])
      try {
        const tree = ui.render(), copy = button(tree, 'Copy recipient link')
        assert.equal(copy.props.disabled, true)
        await copy.props.onClick()
        assert.deepEqual(ui.copied, [])
        assert.ok(nodes(tree).some(node => node.props?.href === `/shared#reuse=${variant}`))
        assert.ok(textOf(tree).includes(variant === 'expired' ? 'Server link expired' : 'No recipient link saved here'))
        assert.ok(read(ui.store).library.entries.length === 1)
      } finally { ui.cleanup() }
    }
  })
  await checkAsync('expiry is refreshed on screen and rechecked at copy time', async () => {
    const story = shared('expires-soon')
    story.expiresAt = '2026-10-15T00:00:01.000Z'
    const ui = mountLibrary([story])
    try {
      const copy = button(ui.render(), 'Copy recipient link')
      assert.equal(copy.props.disabled, false)
      ui.advance(story.expiresAt, false)
      await copy.props.onClick()
      assert.deepEqual(ui.copied, [])
      ui.advance(story.expiresAt)
      assert.equal(button(ui.render(), 'Copy recipient link').props.disabled, true)
      assert.ok(textOf(ui.render()).includes('Your local brief is retained'))
    } finally { ui.cleanup() }
  })
  await checkAsync('local-only sharing warns clearly and clipboard failures are recoverable', async () => {
    const ui = mountLibrary([shared('local')], 'http://localhost:3000')
    try {
      assert.ok(textOf(ui.render()).includes('Local-only address'))
      await button(ui.render(), 'Copy recipient link').props.onClick()
      assert.ok(textOf(ui.render()).includes('will not work on another device'))
      ui.clipboard.writeText = async () => { throw new Error('denied') }
      await button(ui.render(), 'Copy recipient link').props.onClick()
      assert.ok(textOf(ui.render()).includes('Could not copy the recipient link'))
      assert.ok(!textOf(ui.render()).includes('Unreadable entries'))
      assert.equal(read(ui.store).library.entries.length, 1)
    } finally { ui.cleanup() }
  })
  check('private shared assistance and narration metadata survive library validation', () => {
    const story = shared('a')
    story.brief.assistanceHints = ['Try the shelves.']
    story.brief.alternativeAnswers = ['the blue book']
    story.content.narrationStyle = 'warm'
    story.content.narrationLanguage = 'en-US'
    story.content.scenes[0].choices = ['Follow the clue', 'Continue exploring', 'Look for a detail']
    const store = memory()
    lib.saveLibraryCreatorStory(story, store)
    const restored = lib.latestCreatorStory(read(store))
    assert.deepEqual(restored.brief.assistanceHints, story.brief.assistanceHints)
    assert.deepEqual(restored.brief.alternativeAnswers, story.brief.alternativeAnswers)
    assert.equal(restored.content.narrationLanguage, 'en-US')
    assert.deepEqual(restored.content.scenes[0].choices, story.content.scenes[0].choices)
  })
  check('library UI keeps private details out of cards and confirms browser-only deletion', () => {
    const page = fs.readFileSync(path.join(root, 'src', 'pages', 'library.tsx'), 'utf8')
    assert.ok(page.includes('window.confirm('))
    assert.ok(page.includes('Remove browser entry only'))
    assert.ok(page.includes('encodeURIComponent(entry.story.ownerToken)'))
    assert.ok(page.includes('Remote availability not checked'))
    for (const field of ['solution', 'message', 'assistanceHints', 'alternativeAnswers', 'recipientHints']) {
      assert.ok(!page.includes(`entry.story.brief.${field}`), `Private ${field} must not appear in cards`)
    }
    assert.ok(!page.includes('fetch('))
    assert.ok(page.includes('selectPersonalStory(id)'))
  })
  check('home, personal and shared pages expose library and canonical shared persistence', () => {
    for (const filename of ['index.tsx', 'story.tsx', 'shared.tsx']) {
      const page = fs.readFileSync(path.join(root, 'src', 'pages', filename), 'utf8')
      assert.ok(page.includes('href="/library"'))
    }
    const sharedPage = fs.readFileSync(path.join(root, 'src', 'pages', 'shared.tsx'), 'utf8')
    assert.ok(sharedPage.includes('saveLibraryCreatorStory(restored)'))
    assert.ok(sharedPage.includes("removeLibraryEntry('shared', creator.ownerToken)"))
    assert.ok(sharedPage.includes('entry.id === requestedOwner'))
    assert.ok(!sharedPage.includes('CREATOR_KEY'))
  })
  console.log(`${passed} library checks passed`)
} finally {
  delete global.window
  fs.rmSync(output, { recursive: true, force: true })
}
}
main().catch(error => { console.error(error); process.exitCode = 1 })
