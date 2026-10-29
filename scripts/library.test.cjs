const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const savedGiftFixture = require('./saved-gift-fixture.cjs')

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
  function mountLibrary(stories, origin = 'https://muse.example', personalStories = [], session = null) {
    const ts = require('typescript')
    const store = memory()
    for (const story of stories) lib.saveLibraryCreatorStory(story, store)
    for (const story of personalStories) lib.saveLibraryPersonalStory(story, store)
    const states = [], effects = [], copied = [], requests = []
    let currentSession = session
    let progressResponse = { ok: true, data: { progress: { opened: 2, inProgress: 1, solved: 1, skipped: 0, furthestScene: 0 } } }
    let cursor = 0, mounted = false, tick, clock = Date.parse('2026-10-15T00:00:00Z')
    const jsx = (type, props) => ({ type, props: props || {} })
    const react = {
      useRef(initial) { const index = cursor++; return states[index] ||= { current: initial } },
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
      fetch: async (url, options) => {
        requests.push({ url, ...options, body: JSON.parse(options.body) })
        const response = typeof progressResponse === 'function' ? progressResponse(JSON.parse(options.body)) : progressResponse
        return { ok: response.ok, json: async () => response.data }
      },
      Date: class extends Date { static now() { return clock } },
      require(name) {
        if (name === 'react') return react
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
        if (name === 'next/head' || name === 'next/link') return { __esModule: true, default: name === 'next/link' ? 'a' : 'head' }
        if (name === '../lib/sharedStorySharing') return sharing
        if (name === '../lib/sharedStoryProgress') return require(path.join(output, 'sharedStoryProgress.js'))
        if (name === '../components/GiftProgress') return { __esModule: true, default: 'gift-progress' }
        if (name === '../components/ShareGiftStory') return { __esModule: true, default: 'share-gift-story' }
        if (name === '../components/GiftStoryPreview') return { __esModule: true, default: 'gift-story-preview' }
        if (name === '../components/PersonalStoryShareCard') return { __esModule: true, default: 'personal-story-share-card' }
        if (name === '../lib/interfaceLanguage') return { useInterfaceLanguage: () => 'en-US' }
        if (name === '../lib/interfacePages') return {
          archiveSyncNote: () => 'Account stories sync when you sign in.',
          interfacePageText: key => ({
            archiveTitle: 'Archive', myStoriesTitle: 'My stories',
            storiesForMe: 'Stories for me', giftsForOthers: 'Gifts for others',
            loadingLibrary: 'Loading saved stories…', personalStoryTitle: 'My story',
            createGift: 'Create a gift story', noPersonalStories: 'No personal stories yet.',
            storyCompleted: 'Completed', inProgress: 'In progress',
            storyDetails: 'Story details', readStory: 'Read story',
            removeFromBrowser: 'Remove from this browser',
            syncingStories: 'Syncing stories…', syncAccountStories: 'Sync account stories',
            noGiftStories: 'No gift stories yet.'
          })[key] || key
        }
        if (name === '../lib/accountClient') return {
          supabase: { auth: { getSession: async () => ({ data: { session: currentSession }, error: null }) } },
          accountFetch: async (url, init) => {
            const headers = { ...init.headers, ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}) }
            const body = JSON.parse(init.body)
            requests.push({ url, ...init, headers, body })
            const response = typeof progressResponse === 'function' ? progressResponse(body) : progressResponse
            return { ok: response.ok, json: async () => response.data }
          }
        }
        if (name === '../lib/storyLibrary') return {
          loadStoryLibrary: () => lib.loadStoryLibrary(store),
          restoreLibraryCreatorStories: values => lib.restoreLibraryCreatorStories(values, store),
          saveLibraryPersonalStory: story => lib.saveLibraryPersonalStory(story, store),
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
      render, copied, clipboard, store, requests,
      setProgressResponse(value) { progressResponse = value },
      advance(value, update = true) { clock = Date.parse(value); if (update) tick?.() },
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
  await checkAsync('shared library integrates the safe recipient share panel without exposing management access', async () => {
    const story = JSON.parse(JSON.stringify(savedGiftFixture))
    const ui = mountLibrary([story])
    try {
      const tree = ui.render(), all = nodes(tree), text = textOf(tree)
      assert.equal(ui.requests.length, 0, 'Rendering a locally saved gift uses no backend calls')
      assert.ok(all.some(node => node.props?.id === 'personal-stories-heading'))
      assert.ok(all.some(node => node.props?.id === 'shared-stories-heading'))
      assert.ok(!all.some(node => node.props?.href?.startsWith('/shared#manage=') || node.props?.href?.startsWith('/shared#reuse=')))
      const card = all.find(node => node.type === 'article')
      assert.deepEqual(nodes(card).filter(node => node.type === 'button').map(textOf), ['Remove from this browser'])
      assert.equal(nodes(card).filter(node => node.type === 'gift-progress').length, 1)
      assert.equal(nodes(card).find(node => node.type === 'gift-progress').props.compact, true)
      const panel = nodes(card).find(node => node.type === 'share-gift-story')
      const details = sharing.recipientShareDetails('https://muse.example', story.playToken)
      assert.equal(panel.props.recipientUrl, details.url)
      assert.equal(panel.props.shareText, details.text)
      assert.equal(panel.props.whatsappUrl, details.whatsappUrl)
      assert.equal(panel.props.expiresAt, null)
      assert.equal(panel.props.localOnly, false)
      assert.equal(panel.props.previewContent.type, 'gift-story-preview')
      const validatedStory = lib.validateCreatorStory(story)
      assert.deepEqual(panel.props.previewContent.props.brief, validatedStory.brief)
      assert.deepEqual(panel.props.previewContent.props.content, validatedStory.content)
      assert.ok(!JSON.stringify(panel.props).includes(story.ownerToken), 'Sharing receives only recipient-facing data, never owner access')
      assert.ok(!all.some(node => node.type === 'time'), 'Legacy expiry dates no longer block migrated stories')
      assert.ok(text.includes('Account stories sync when you sign in.'))
      assert.ok(text.includes('independently of recipient completion'))
      assert.ok(text.includes('View story progress'))
      assert.ok(text.includes('private owner access; do not share them'))
      for (const field of ['message', 'solution', 'recipientHints']) assert.ok(!text.includes(story.brief[field]))
    } finally { ui.cleanup() }
  })
  check('account recovery merges stories atomically and refreshes recipient links', () => {
    const store = memory()
    lib.saveLibraryPersonalStory(personal('keep-me'), store)
    lib.saveLibraryCreatorStory(shared('same-story.original-owner'), store)
    const recovered = shared('same-story.recovered-owner')
    recovered.playToken = 'recovered-recipient'
    recovered.content.title = 'Refreshed story'
    assert.equal(lib.restoreLibraryCreatorStories([recovered, shared('another-story.recovered')], store), 1)
    const result = read(store).library
    assert.equal(result.entries.length, 3)
    const original = result.entries.find(entry => entry.id === 'same-story.original-owner')
    assert.equal(original.story.playToken, 'recovered-recipient')
    assert.equal(original.story.content.title, 'Refreshed story')
    // Account recovery refreshes the saved recipient capability with the current link.
    lib.restoreLibraryCreatorStories([{ ...shared('rotate.before'), recovered: true }], store)
    lib.restoreLibraryCreatorStories([{ ...shared('rotate.after'), recovered: true }], store)
    assert.ok(!read(store).library.entries.some(entry => entry.id === 'rotate.before'))
    assert.ok(read(store).library.entries.some(entry => entry.id === 'rotate.after'))
    const before = store.getItem('muse-story-library')
    assert.throws(() => lib.restoreLibraryCreatorStories([shared('new.recovered'), { invalid: true }], store))
    assert.equal(store.getItem('muse-story-library'), before)
  })
  await checkAsync('account recovery syncs gift and personal stories and reports failures', async () => {
    const ui = mountLibrary([], 'https://muse.example', [], { access_token: 'fixture-account-token' })
    try {
      const summary = { opened: 1, inProgress: 1, solved: 0, skipped: 0, furthestScene: 0, sceneCount: 1 }
      ui.setProgressResponse(body => body.action === 'library' && body.mode !== 'journey'
        ? { ok: true, data: { stories: [{ ...shared('recovered.owner'), progress: summary }], next: null } }
        : { ok: true, data: { stories: [] } })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(ui.requests[0].body.action, 'library')
      assert.equal(ui.requests[0].body.includeProgress, true)
      assert.equal(ui.requests[0].headers.Authorization, 'Bearer fixture-account-token')
      assert.equal(ui.requests[1].body.mode, 'journey', 'The personal story request uses the personal-story API mode')
      assert.equal(ui.requests[1].body.action, 'library')
      assert.equal(ui.requests[1].url, '/api/personal-story')
      assert.equal(ui.requests[1].headers.Authorization, 'Bearer fixture-account-token')
      assert.equal(read(ui.store).library.entries.length, 1)
      const progressNode = nodes(ui.render()).find(node => node.type === 'gift-progress')
      assert.ok(progressNode, JSON.stringify({ text: textOf(ui.render()), types: nodes(ui.render()).map(node => node.type) }))
      assert.deepEqual(progressNode.props.snapshot, summary)
      ui.setProgressResponse({ ok: false, data: { error: 'Account session expired.' } })
      button(ui.render(), 'Sync account stories').props.onClick()
      await new Promise(resolve => setImmediate(resolve))
      assert.ok(textOf(ui.render()).includes('Account session expired.'))
      assert.ok(textOf(ui.render()).includes('Sign in or create an account'))
      assert.equal(read(ui.store).library.entries.length, 1, 'Failed account sync preserves existing browser entries')
    } finally { ui.cleanup() }
  })
  check('personal cards keep progress simple and place journey allowances and storage details under disclosure', () => {
    const story = personal('journey')
    story.scenes = [{ title: 'Opening', body: 'Begin here.', question: '', choices: [] }]
    story.journey = {
      duration: 5, maxTurns: 3, revision: 1, pending: false, status: 'active',
      state: { inventory: [], discoveries: [], relationships: [], progress: 'Started' },
      capability: 'a'.repeat(64), choiceMode: 'free'
    }
    const ui = mountLibrary([], 'https://muse.example', [story])
    try {
      const tree = ui.render(), card = nodes(tree).find(node => node.type === 'article')
      const progress = nodes(card).find(node => node.type === 'p' && textOf(node).includes('In progress'))
      assert.equal(textOf(progress), 'In progress · Scene 1')
      assert.doesNotMatch(textOf(progress), /attempt|active|reconcil|status/i)
      assert.match(textOf(nodes(card).find(node => node.type === 'details')), /up to\s+3\s+story steps/)
      assert.ok(textOf(nodes(card).find(node => node.type === 'details')).includes('in this browser'))
      assert.ok(button(card, 'Read story'))
      assert.ok(button(card, 'Remove from this browser'))
    } finally { ui.cleanup() }
  })
  await checkAsync('legacy expiry does not block migrated links, while missing links remain disabled', async () => {
    for (const variant of ['expired', 'missing', 'permanent']) {
      const story = shared(variant)
      if (variant === 'expired') story.expiresAt = '2000-01-01T00:00:00.000Z'
      else if (variant === 'missing') delete story.playToken
      else story.expiresAt = null
      const ui = mountLibrary([story])
      try {
        const tree = ui.render()
        const share = nodes(tree).find(node => node.type === 'share-gift-story')
        assert.equal(Boolean(share), variant !== 'missing')
        if (share) {
          assert.equal(share.props.disabled, false)
          assert.equal(share.props.expiresAt, null, 'Legacy expiry does not disable sharing')
        }
        assert.ok(button(tree, 'Remove from this browser'))
        if (variant === 'missing') assert.ok(textOf(tree).includes('No recipient link saved here'))
        assert.ok(!textOf(tree).includes('View story progress to see'), 'Gift cards omit instructional copy')
        assert.ok(!nodes(tree).some(node => node.type === 'input' && node.props.type === 'password'), 'No deployment-wide creator code is requested')
        assert.ok(read(ui.store).library.entries.length === 1)
      } finally { ui.cleanup() }
    }
  })
  await checkAsync('completion checks use account authorization, never poll, and surface failures', async () => {
    const story = shared('private-owner')
    const ui = mountLibrary([story])
    try {
      let tree = ui.render()
      assert.equal(ui.requests.length, 0, 'Opening the library makes no network request')
      const progress = () => nodes(ui.render()).find(node => node.type === 'gift-progress')
      const result = await progress().props.load()
      assert.equal(result.solved, 1)
      assert.equal(ui.requests[0].url, '/api/shared-story')
      assert.equal(ui.requests[0].body.action, 'progress')
      assert.equal(ui.requests[0].body.token, story.ownerToken)
      assert.ok(!JSON.stringify(ui.requests[0]).includes(story.playToken))
      const liveSummary = { opened: 1, inProgress: 1, solved: 0, skipped: 0, furthestScene: 1, sceneCount: null }
      ui.setProgressResponse({ ok: true, data: { progress: liveSummary } })
      await progress().props.load()
      assert.equal(ui.requests[1].body.action, 'progress')
      ui.setProgressResponse({ ok: false, data: { error: 'Sign in to view progress.' } })
      await assert.rejects(progress().props.load(), /Sign in to view progress/)
      ui.setProgressResponse({ ok: true, data: {} })
      await assert.rejects(progress().props.load(), /Story progress was not returned/)
      assert.equal(read(ui.store).library.entries.length, 1, 'Failed checks do not erase the story')
      const beforeRemove = ui.requests.length
      button(ui.render(), 'Remove from this browser').props.onClick()
      assert.equal(read(ui.store).library.entries.length, 0)
      assert.equal(ui.requests.length, beforeRemove, 'Removal is browser-local only, never server deletion')
    } finally { ui.cleanup() }
  })
  await checkAsync('legacy browser expiry never re-disables upgraded recipient links', async () => {
    const story = shared('expires-soon')
    story.expiresAt = '2026-10-15T00:00:01.000Z'
    const ui = mountLibrary([story])
    try {
      const sharePanel = nodes(ui.render()).find(node => node.type === 'share-gift-story')
      assert.ok(sharePanel)
      assert.equal(sharePanel.props.expiresAt, null)
      ui.advance(story.expiresAt, false)
      ui.advance(story.expiresAt)
      assert.equal(nodes(ui.render()).find(node => node.type === 'share-gift-story').props.disabled, false)
      assert.equal(nodes(ui.render()).find(node => node.type === 'share-gift-story').props.expiresAt, null)
    } finally { ui.cleanup() }
  })
  await checkAsync('local-only sharing warns clearly and clipboard failures are recoverable', async () => {
    const story = shared('local')
    const ui = mountLibrary([story], 'http://localhost:3000')
    try {
      assert.ok(textOf(ui.render()).includes('Local-only address'))
      const panel = nodes(ui.render()).find(node => node.type === 'share-gift-story')
      assert.ok(panel)
      assert.equal(panel.props.localOnly, true)
      assert.equal(panel.props.whatsappUrl, sharing.recipientShareDetails('http://localhost:3000', story.playToken).whatsappUrl)
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
    assert.ok(page.includes('loadProgress(entry.story.ownerToken)'))
    assert.ok(page.includes("text('removeFromBrowser', interfaceLanguage)"))
    for (const field of ['solution', 'message', 'assistanceHints', 'alternativeAnswers', 'recipientHints']) {
      assert.ok(!page.includes(`entry.story.brief.${field}`), `Private ${field} must not appear in cards`)
    }
    assert.ok(page.includes("action: 'progress'"))
    assert.ok(!page.includes("action: 'delete'"))
    assert.ok(page.includes('selectPersonalStory(id)'))
  })
  check('shared navigation exposes saved stories and shared persistence remains canonical', () => {
    const navigation = fs.readFileSync(path.join(root, 'src', 'components', 'SiteNavigation.tsx'), 'utf8')
    assert.ok(navigation.includes("href: '/library', key: 'navArchive'"))
    const page = fs.readFileSync(path.join(root, 'src', 'pages', 'library.tsx'), 'utf8')
    assert.ok(page.includes("window.location.assign('/story?read=1')"), 'Archive opens a reading-only personal story')
    assert.ok(!page.includes("'Continue story'"), 'Continuation belongs to My stories, not the archive')
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
