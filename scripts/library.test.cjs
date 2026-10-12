const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.library-tests-'))
let passed = 0
function check(name, run) { run(); passed++; console.log(`PASS ${name}`) }
function memory(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    values,
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) }
  }
}
try {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/storyLibrary.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--strict', '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const lib = require(path.join(output, 'storyLibrary.js'))
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
  check('expired shared entries are retained for explicit local removal without any API calls', () => {
    const store = memory(), story = shared('expired')
    story.expiresAt = '2000-01-01T00:00:00.000Z'
    lib.saveLibraryCreatorStory(story, store)
    assert.equal(lib.latestCreatorStory(read(store)).expiresAt, story.expiresAt)
  })
  check('private shared assistance and narration metadata survive library validation', () => {
    const story = shared('a')
    story.brief.assistanceHints = ['Try the shelves.']
    story.brief.alternativeAnswers = ['the blue book']
    story.content.narrationStyle = 'warm'
    story.content.narrationLanguage = 'en-US'
    const store = memory()
    lib.saveLibraryCreatorStory(story, store)
    const restored = lib.latestCreatorStory(read(store))
    assert.deepEqual(restored.brief.assistanceHints, story.brief.assistanceHints)
    assert.deepEqual(restored.brief.alternativeAnswers, story.brief.alternativeAnswers)
    assert.equal(restored.content.narrationLanguage, 'en-US')
  })
  check('library UI keeps private details out of cards and confirms browser-only deletion', () => {
    const page = fs.readFileSync(path.join(root, 'src', 'pages', 'library.tsx'), 'utf8')
    assert.ok(page.includes('window.confirm('))
    assert.ok(page.includes('Remove browser entry only'))
    assert.ok(page.includes('encodeURIComponent(entry.story.ownerToken)'))
    assert.ok(page.includes('Remote availability not checked'))
    assert.ok(!page.includes('entry.story.brief.'))
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
