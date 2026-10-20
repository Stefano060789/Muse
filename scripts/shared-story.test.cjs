const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.shared-story-tests-'))
const originalFetch = global.fetch
const originalEnv = { ...process.env }
let passed = 0

async function check(name, run) {
  await run()
  passed += 1
  console.log(`PASS ${name}`)
}

async function main() {
  process.env.MUSE_OPERATIONS_SQLITE_PATH = path.join(output, 'operations.sqlite')
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/sharedStory.ts', 'src/lib/sharedStoryGenerator.ts', 'src/pages/api/shared-story.ts',
    'src/lib/personalStoryGenerator.ts', 'src/pages/api/personal-story.ts',
    '--outDir', output, '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const { parseSharedStoryBrief, parseGeneratedStory, normalizeSharedAnswer, sceneCountForDuration, sharedStoryPlayerView } = require(path.join(output, 'lib', 'sharedStory.js'))
  const { generateSharedStory } = require(path.join(output, 'lib', 'sharedStoryGenerator.js'))
  const handler = require(path.join(output, 'pages', 'api', 'shared-story.js')).default
  const personalHandler = require(path.join(output, 'pages', 'api', 'personal-story.js')).default
  const { parsePersonalStoryRequest, generatePersonalStory } = require(path.join(output, 'lib', 'personalStoryGenerator.js'))
  process.env.STORY_STORAGE = 'supabase'
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  const brief = {
    creatorName: 'Alex', recipientName: 'Sam', narration: 'Playful detective narration',
    setting: 'A room with a desk, notebook and stars painted on the ceiling.',
    recipientHints: 'Sam likes astronomy.', goal: 'Find the hidden letter.',
    solution: 'behind the blue notebook', message: 'Meet me tomorrow at our favourite cafe.',
    durationMinutes: 5
  }
  const contentFor = (minutes) => {
    const count = sceneCountForDuration(minutes)
    const words = Math.ceil(minutes * 70 / count)
    return {
      title: 'The Room of Stars', description: 'Find the hidden letter using familiar clues.',
      narrationStyle: 'suspenseful', narrationLanguage: 'en-US',
      scenes: Array.from({ length: count }, (_, index) => ({
        title: `Discovery ${index + 1}`, body: Array(words).fill('wonder').join(' '),
        clue: 'Look where your favourite constellations were once drawn.'
      }))
    }
  }
  const content = contentFor(5)
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  let providerRequest
  const providerMock = async (_url, options) => {
    providerRequest = JSON.parse(options.body)
    return json({ choices: [{ message: { content: JSON.stringify(content) } }] })
  }

  await check('brief preserves the creator setting, recipient hints and private payoff', () => {
    assert.deepEqual(parseSharedStoryBrief(brief), { ...brief, answerType: 'phrase', assistanceHints: [], alternativeAnswers: [] })
  })
  await check('final answer types and public directions validate and appear only at the ending', () => {
    const directed = parseSharedStoryBrief({ ...brief, answerType: 'word', solution: 'starlight', alternativeAnswers: ['moonbeam'], answerInstruction: 'At the observatory door, say it aloud.' })
    assert.equal(directed.answerType, 'word')
    assert.equal(directed.answerInstruction, 'At the observatory door, say it aloud.')
    assert.throws(() => parseSharedStoryBrief({ ...brief, answerType: 'word' }), /one word/)
    assert.throws(() => parseSharedStoryBrief({ ...brief, solution: 'starlight', answerInstruction: 'Say starlight aloud.' }), /must not reveal/)
    assert.equal(sharedStoryPlayerView(directed, content, { current_scene: 0, solved: false }).answerInstruction, undefined)
    assert.equal(sharedStoryPlayerView(directed, content, { current_scene: content.scenes.length - 1, solved: false }).answerInstruction, directed.answerInstruction)
    assert.equal(sharedStoryPlayerView({ ...directed, answerType: 'action' }, content, { current_scene: 0, solved: false }).answerType, 'action')
  })
  await check('optional puzzle help validates bounded creator-only lists', () => {
    const assistanceHints = ['Look beneath the paper cover.', 'Remember the colour of the sea.']
    const alternativeAnswers = ['under the azure journal']
    assert.deepEqual(parseSharedStoryBrief({ ...brief, assistanceHints, alternativeAnswers }).assistanceHints, assistanceHints)
    for (const update of [
      { assistanceHints: 'not a list' }, { assistanceHints: Array(4).fill('hint') },
      { assistanceHints: [''] }, { assistanceHints: ['x'.repeat(601)] },
      { alternativeAnswers: Array(6).fill('answer') }, { alternativeAnswers: ['!!!'] },
      { alternativeAnswers: ['x'.repeat(201)] }, { alternativeAnswers: null }
    ]) assert.throws(() => parseSharedStoryBrief({ ...brief, ...update }))
  })
  await check('private alternatives and on-demand hints cannot leak into generated public content', () => {
    const assisted = { ...brief, assistanceHints: ['Look beneath the paper cover.'], alternativeAnswers: ['under the azure journal'] }
    for (const description of [...assisted.assistanceHints, ...assisted.alternativeAnswers]) {
      assert.throws(() => parseGeneratedStory({ ...content, description }, assisted), /exposed/)
    }
    const view = sharedStoryPlayerView(assisted, content, { current_scene: 0, solved: false, revealed_hints: 1 })
    assert.deepEqual(view.revealedHints, assisted.assistanceHints)
    assert.equal(view.hintsRemaining, 0)
    assert.equal(view.alternativeAnswers, undefined)
    assert.deepEqual(sharedStoryPlayerView(assisted, content, { current_scene: 0, solved: false }).revealedHints, [])
  })
  await check('invalid durations, missing setting and oversized answers are rejected', () => {
    for (const update of [{ durationMinutes: 7 }, { durationMinutes: '5' }, { setting: '' }, { solution: 'x'.repeat(201) }, { solution: '!!!' }]) {
      assert.throws(() => parseSharedStoryBrief({ ...brief, ...update }))
    }
    assert.throws(() => parseSharedStoryBrief(null))
  })
  await check('5/10/15/20 minutes scale scene count and validated narration length', () => {
    for (const minutes of [5, 10, 15, 20]) {
      assert.equal(parseGeneratedStory(contentFor(minutes), { ...brief, durationMinutes: minutes }).scenes.length, sceneCountForDuration(minutes))
    }
    assert.throws(() => parseGeneratedStory({ ...content, scenes: content.scenes.slice(0, 1) }, brief))
    assert.throws(() => parseGeneratedStory({ ...content, scenes: content.scenes.map((scene) => ({ ...scene, body: 'Too short.' })) }, brief))
  })
  await check('AI output exposing the secret answer or reveal is rejected', () => {
    for (const leaked of [brief.solution, brief.message]) {
      assert.throws(() => parseGeneratedStory({ ...content, description: leaked }, brief))
    }
  })
  await check('answer normalization ignores case, punctuation and spacing, not meaning', () => {
    assert.equal(normalizeSharedAnswer(' BEHIND the blue notebook! '), normalizeSharedAnswer(brief.solution))
    assert.notEqual(normalizeSharedAnswer(`not ${brief.solution}`), normalizeSharedAnswer(brief.solution))
    assert.notEqual(normalizeSharedAnswer('notebook'), normalizeSharedAnswer(brief.solution))
    assert.equal(normalizeSharedAnswer('Café — étoile'), 'café étoile')
  })
  await check('generator directions explain final spoken/action challenge and accepted alternatives', async () => {
    global.fetch = providerMock
    process.env.LLM_PROVIDER = 'OPENAI'
    process.env.OPENAI_API_KEY = 'test-key'
    await generateSharedStory({
      ...brief, answerType: 'action', answerInstruction: 'At the old gate, describe how you would open it.',
      alternativeAnswers: ['open the moon door']
    })
    assert.match(providerRequest.messages[0].content, /specific action/)
    assert.match(providerRequest.messages[0].content, /cannot verify physical actions/)
    assert.match(providerRequest.messages[0].content, /Final-scene direction/)
    assert.match(providerRequest.messages[0].content, /exact creator-approved equivalents/)
    assert.deepEqual(JSON.parse(providerRequest.messages[1].content).alternativeAnswers, ['open the moon door'])
  })
  await check('unsolved recipient projection omits the answer, brief, hints and message', () => {
    const view = sharedStoryPlayerView(brief, content, { current_scene: 1, solved: false })
    assert.equal(view.sceneIndex, 1)
    const serialized = JSON.stringify(view)
    for (const secret of [brief.solution, brief.message, brief.recipientHints]) assert.ok(!serialized.includes(secret))
    assert.equal(view.message, undefined)
    assert.equal(view.scenes, undefined)
  })
  await check('only solved projection reveals the exact creator message', () => {
    const view = sharedStoryPlayerView(brief, content, { current_scene: 0, solved: true })
    assert.equal(view.message, brief.message)
    assert.equal(view.solution, undefined)
  })
  await check('unlock policy validates strictly and skipped reveal is distinct from solved', () => {
    assert.equal(parseSharedStoryBrief(brief).unlockPolicy, undefined)
    assert.equal(parseSharedStoryBrief({ ...brief, unlockPolicy: 'allow-skip' }).unlockPolicy, 'allow-skip')
    for (const unlockPolicy of [null, true, 'skip', '']) assert.throws(() => parseSharedStoryBrief({ ...brief, unlockPolicy }))
    const enabled = { ...brief, unlockPolicy: 'allow-skip' }
    const locked = sharedStoryPlayerView(enabled, content, { current_scene: 0, solved: false })
    assert.equal(locked.canSkip, true)
    assert.equal(locked.message, undefined)
    const skipped = sharedStoryPlayerView(enabled, content, { current_scene: 0, solved: false, skipped: true })
    assert.equal(skipped.solved, false)
    assert.equal(skipped.skipped, true)
    assert.equal(skipped.canSkip, false)
    assert.equal(skipped.message, brief.message)
    assert.ok(!JSON.stringify(skipped).includes(brief.solution))
  })
  await check('generation sends a structured brief to the actual Groq chat API', async () => {
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_PROVIDER = 'GROQ'
    delete process.env.LLM_MODEL
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
      return providerMock(url, options)
    }
    assert.deepEqual(await generateSharedStory(brief), content)
    assert.equal(providerRequest.model, 'llama-3.3-70b-versatile')
    assert.deepEqual(JSON.parse(providerRequest.messages[1].content), brief)
    assert.match(providerRequest.messages[0].content, /assistanceHints are private/)
    assert.match(providerRequest.messages[0].content, /alternativeAnswers are private/)
    const schemaExample = JSON.parse(providerRequest.messages[0].content.match(/Return JSON only, without markdown: (\{.*\})\./)[1])
    assert.equal(schemaExample.narrationStyle, 'suspenseful')
    assert.equal(schemaExample.narrationLanguage, 'en-US')
    assert.ok(Array.isArray(schemaExample.scenes))
    assert.equal(providerRequest.response_format.type, 'json_object')
  })
  await check('explicit OpenAI selection preserves its key, endpoint and model', async () => {
    process.env.LLM_PROVIDER = 'OPENAI'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions')
      assert.equal(options.headers.Authorization, 'Bearer test-openai-key')
      return providerMock(url, options)
    }
    assert.deepEqual(await generateSharedStory(brief), content)
    assert.equal(providerRequest.model, 'gpt-4.1-mini')
    process.env.LLM_MODEL = 'gpt-4.1'
    await generateSharedStory(brief)
    assert.equal(providerRequest.model, 'gpt-4.1')
    delete process.env.LLM_MODEL
    delete process.env.OPENAI_API_KEY
    process.env.LLM_PROVIDER = 'GROQ'
  })
  await check('missing key, unsupported provider and upstream errors are explicit', async () => {
    delete process.env.LLM_API_KEY
    await assert.rejects(() => generateSharedStory(brief), /not configured/)
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_PROVIDER = 'INVALID'
    await assert.rejects(() => generateSharedStory(brief), /Choose ANTHROPIC, OPENAI or GROQ/)
    process.env.LLM_PROVIDER = 'GROQ'
    global.fetch = async () => json({ error: 'private provider detail' }, 401)
    await assert.rejects(() => generateSharedStory(brief), (error) => error.status === 502 && !error.message.includes('private provider detail'))
    global.fetch = async () => json({ choices: [{ message: { content: 'not JSON' } }] })
    await assert.rejects(() => generateSharedStory(brief), /invalid story JSON/)
  })
  const anthropicResponse = (value, stop = 'end_turn') => json({
    content: [{ type: 'thinking', thinking: 'not story text' }, { type: 'text', text: JSON.stringify(value) }],
    stop_reason: stop
  })
  await check('Claude Haiku is the default with native Messages headers and low effort', async () => {
    delete process.env.LLM_PROVIDER
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages')
      assert.equal(options.headers['x-api-key'], 'test-anthropic-key')
      assert.equal(options.headers['anthropic-version'], '2023-06-01')
      assert.equal(options.headers.Authorization, undefined)
      providerRequest = JSON.parse(options.body)
      return anthropicResponse(content)
    }
    assert.deepEqual(await generateSharedStory(brief), content)
    assert.equal(providerRequest.model, 'claude-haiku-5-5')
    assert.equal(providerRequest.output_config.effort, 'low')
    assert.equal(providerRequest.temperature, undefined)
    assert.equal(providerRequest.response_format, undefined)
    assert.ok(providerRequest.system.includes('solution and final message are private'))
    assert.equal(providerRequest.messages.length, 1)
    assert.deepEqual(JSON.parse(providerRequest.messages[0].content), brief)
    process.env.LLM_MODEL = 'claude-haiku-5-5'
    await generateSharedStory(brief)
    delete process.env.LLM_MODEL
  })
  await check('Claude refusals, truncation, malformed JSON and missing text are explicit', async () => {
    for (const [stop, status] of [['refusal', 422], ['max_tokens', 502], ['model_context_window_exceeded', 502]]) {
      global.fetch = async () => anthropicResponse(content, stop)
      await assert.rejects(() => generateSharedStory(brief), (error) => error.status === status)
    }
    global.fetch = async () => json({ content: [{ type: 'text', text: '```json\n{}\n```' }], stop_reason: 'end_turn' })
    await assert.rejects(() => generateSharedStory(brief), /invalid story JSON/)
    global.fetch = async () => json({ content: [{ type: 'thinking', thinking: 'no text' }], stop_reason: 'end_turn' })
    await assert.rejects(() => generateSharedStory(brief), /returned no story/)
    global.fetch = async () => json({ error: 'secret provider detail' }, 429)
    await assert.rejects(() => generateSharedStory(brief), (error) => error.status === 429 && !error.message.includes('secret provider detail'))
  })
  await check('Claude never silently uses an OpenAI or Groq key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    process.env.OPENAI_API_KEY = 'other-provider-key'
    await assert.rejects(() => generateSharedStory(brief), /ANTHROPIC_API_KEY/)
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
    delete process.env.OPENAI_API_KEY
  })
  const personalContent = {
    title: 'The Small Observatory', description: 'A curious journey shaped by your choices.',
    narrationStyle: 'curious', narrationLanguage: 'en-US',
    scenes: Array.from({ length: 3 }, (_, index) => ({
      title: `Scene ${index + 1}`, body: 'An unfamiliar star invites you to explore.',
      question: 'What will you explore?', choices: ['The telescope', 'The garden', 'The notebook']
    }))
  }
  let personal
  await check('My Story generates with Haiku using only opted-in profile keypoints', async () => {
    global.fetch = async (_url, options) => {
      providerRequest = JSON.parse(options.body)
      return anthropicResponse(personalContent)
    }
    const input = parsePersonalStoryRequest({ action: 'create', mood: 'curious', need: 'I want to explore', profileKeypoints: [] })
    personal = await generatePersonalStory(input)
    assert.equal(personal.generation, 'ai')
    assert.equal(personal.scenes.length, 3)
    assert.deepEqual(JSON.parse(providerRequest.messages[0].content).profileKeypoints, [])
    await generatePersonalStory(parsePersonalStoryRequest({ ...input, profileKeypoints: ['I love stars'] }))
    assert.deepEqual(JSON.parse(providerRequest.messages[0].content).profileKeypoints, ['I love stars'])
  })
  await check('My Story continuations respond to answers and preserve previous scenes', async () => {
    const changed = { ...personalContent.scenes[1], body: 'Your choice of the garden leads to a new constellation.' }
    global.fetch = async (_url, options) => {
      providerRequest = JSON.parse(options.body)
      return anthropicResponse({ scene: changed, narrationStyle: 'warm', narrationLanguage: 'en-US' })
    }
    const continued = await generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story: personal, answer: 'The garden' }))
    assert.equal(continued.currentStep, 1)
    assert.deepEqual(continued.responses, ['The garden'])
    assert.deepEqual(continued.scenes[0], personal.scenes[0])
    assert.deepEqual(continued.scenes[1], changed)
    assert.deepEqual(JSON.parse(providerRequest.messages[0].content).responses, ['The garden'])
    const final = await generatePersonalStory(parsePersonalStoryRequest({ action: 'continue', story: continued, answer: 'The telescope' }))
    assert.equal(final.currentStep, 2)
    assert.throws(() => parsePersonalStoryRequest({ action: 'continue', story: final, answer: 'extra turn' }))
  })
  await check('personal input bounds and malformed AI scenes are rejected', async () => {
    const base = { action: 'create', mood: 'curious', need: '', profileKeypoints: [] }
    for (const update of [{ mood: 'bad' }, { need: 'x'.repeat(1001) }, { profileKeypoints: Array(6).fill('detail') }]) {
      assert.throws(() => parsePersonalStoryRequest({ ...base, ...update }))
    }
    assert.throws(() => parsePersonalStoryRequest({ action: 'continue', story: { ...personal, currentStep: 1 }, answer: 'bad state' }))
    global.fetch = async () => anthropicResponse({ ...personalContent, scenes: [] })
    await assert.rejects(() => generatePersonalStory(parsePersonalStoryRequest(base)), (error) => error.status === 502)
  })

  let stored
  let allowRequest = true
  let legacyRpc = false
  let progressFailure = false
  let runtimeProviderCalls = 0
  const progressQueries = []
  const collectionQueries = []
  let collectionFailure = false
  let adventureProgressFailure = false
  const adventureProgressQueries = []
  let state = { current_scene: 0, solved: false, skipped: false, revealed_hints: 0 }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://muse-test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  delete process.env.VERCEL
  global.fetch = async (url, options) => {
    if (String(url).includes('api.anthropic.com')) {
      runtimeProviderCalls++
      providerRequest = JSON.parse(options.body)
      return anthropicResponse(JSON.parse(providerRequest.messages[0].content).action === 'create' ? personalContent : content)
    }
    const location = new URL(String(url))
    assert.equal(location.hostname, 'muse-test.supabase.co')
    const body = options?.body ? JSON.parse(options.body) : null
    if (location.pathname === '/rest/v1/muse_adventure_requests') {
      adventureProgressQueries.push(location)
      assert.equal(location.searchParams.get('story_id'), `eq.${stored.id}`)
      assert.equal(location.searchParams.get('status'), 'eq.done')
      assert.equal(location.searchParams.get('select'), 'player_hash,request_id')
      assert.equal(location.searchParams.get('order'), 'player_hash.asc,request_id.asc')
      if (adventureProgressFailure) return json({ message: 'private adventure storage failure' }, 503)
      const offset = Number(location.searchParams.get('offset'))
      return json(offset === 0
        ? Array.from({ length: 1000 }, (_, index) => ({ player_hash: `player-${Math.floor(index / 5)}`, request_id: `request-${index}` }))
        : [{ player_hash: 'player-199', request_id: 'later-one' }, { player_hash: 'player-199', request_id: 'later-two' }])
    }
    if (location.pathname === '/rest/v1/shared_story_sessions') {
      progressQueries.push(location)
      assert.equal(location.searchParams.get('story_id'), `eq.${stored.id}`)
      if (progressFailure) return json({ message: 'private database error' }, 503)
      if (options.method === 'HEAD') {
        assert.equal(location.searchParams.get('select'), 'story_id')
        const count = location.searchParams.get('solved') === 'eq.true' ? 2
          : location.searchParams.get('skipped') === 'eq.true' ? 3 : 1201
        return new Response(null, { status: 200, headers: { 'Content-Range': `0-0/${count}` } })
      }
      assert.equal(location.searchParams.get('select'), 'current_scene')
      assert.equal(location.searchParams.get('order'), 'current_scene.desc')
      assert.equal(location.searchParams.get('limit'), '1')
      return json([{ current_scene: 1 }])
    }
    if (location.pathname.endsWith('/rpc/reserve_shared_story_request')) return json(allowRequest)
    if (location.pathname.endsWith('/rpc/advance_shared_story')) {
      assert.equal(body.expected_play_hash, stored.play_hash)
      if (body.action_name === 'next') state.current_scene = Math.min(state.current_scene + 1, content.scenes.length - 1)
      if (body.action_name === 'guess') state.solved = body.guess_normalized === stored.answer_normalized || stored.alternative_answers_normalized.includes(body.guess_normalized)
      if (body.action_name === 'hint') state.revealed_hints = Math.min(state.revealed_hints + 1, stored.brief.assistanceHints.length)
      return json(legacyRpc ? { current_scene: state.current_scene, solved: state.solved } : state)
    }
    if (location.pathname === '/rest/v1/shared_story_media' || location.pathname === '/rest/v1/shared_story_media_purge') {
      // Text-only stories only check for media and sweep abandoned uploads; there is nothing to remove.
      if (options.method === 'DELETE') return new Response(null, { status: 204 })
      assert.ok(options.method === undefined || options.method === 'GET')
      return json([])
    }
    assert.equal(location.pathname, '/rest/v1/shared_stories')
    if ((!options.method || options.method === 'GET') && location.searchParams.has('limit')) {
      collectionQueries.push(location)
      if (collectionFailure) return json({ message: 'private collection failure' }, 400)
      return json(stored ? [stored] : [])
    }
    if (options.method === 'POST') {
      stored = body
      return new Response(null, { status: 201 })
    }
    if (options.method === 'PATCH') {
      stored = { ...stored, ...body }
      return new Response(null, { status: 204 })
    }
    if (options.method === 'DELETE') {
      stored = null
      return new Response(null, { status: 204 })
    }
    return json(stored ? [stored] : [])
  }
  const api = async (body, method = 'POST', headers = {}, selectedHandler = handler) => {
    let status = 200
    let result
    const responseHeaders = {}
    const res = {
      setHeader: (key, value) => { responseHeaders[key] = value },
      status: (value) => { status = value; return res },
      json: (value) => { result = value; return res }
    }
    await selectedHandler({ method, body: { consentVersion: '2026-10-18', ...body }, headers: { host: 'localhost:3102', ...headers }, socket: { remoteAddress: '127.0.0.1' } }, res)
    assert.equal(responseHeaders['Cache-Control'], 'no-store')
    return { status, body: result }
  }
  let created
  let playerSession
  await check('shared generation rejects missing or stale processing consent before provider access', async () => {
    for (const consentVersion of [undefined, null, 'old-version']) {
      assert.equal((await api({ action: 'create', brief, consentVersion })).status, 400)
    }
  })
  await check('API creates separate owner/play capabilities and stores only hashes', async () => {
    created = await api({ action: 'create', brief })
    assert.equal(created.status, 201)
    assert.notEqual(created.body.ownerToken, created.body.playToken)
    assert.ok(!JSON.stringify(stored).includes(created.body.ownerToken.split('.')[1]))
    assert.ok(!JSON.stringify(stored).includes(created.body.playToken.split('.')[1]))
    assert.deepEqual(created.body.content, content)
    assert.equal(created.body.expiresAt, null, 'Permanent stories expose an explicit null expiry')
    assert.equal(stored.expires_at, 'infinity', 'Hosted storage uses PostgreSQL infinity, never a distant date')
  })
  await check('hosted Creator recovery is gated, paginated, read-only and returns usable role-separated capabilities', async () => {
    const originalCode = process.env.MUSE_CREATOR_ACCESS_CODE
    const code = 'synthetic-hosted-recovery-code'
    process.env.MUSE_CREATOR_ACCESS_CODE = code
    try {
      const calls = runtimeProviderCalls
      const before = JSON.stringify(stored)
      assert.equal((await api({ action: 'library' })).status, 401)
      assert.equal(collectionQueries.length, 0)
      const result = await api({ action: 'library' }, 'POST', { 'x-muse-creator-code': code })
      assert.equal(result.status, 200)
      assert.equal(result.body.next, null)
      assert.equal(result.body.stories.length, 1)
      const query = collectionQueries.at(-1)
      assert.equal(query.searchParams.get('limit'), '21')
      assert.equal(query.searchParams.get('order'), 'id.asc')
      assert.ok(query.searchParams.get('expires_at').startsWith('gt.'))
      const recovered = result.body.stories[0]
      assert.equal(recovered.recovered, true)
      assert.equal(recovered.brief.message, brief.message)
      assert.equal(recovered.expiresAt, null)
      assert.equal((await api({ action: 'manage', token: recovered.ownerToken }, 'POST', { 'x-muse-creator-code': code })).status, 200)
      assert.equal(JSON.stringify(stored), before, 'Recovery does not patch stored hashes')
      const after = stored.id
      await api({ action: 'library', after }, 'POST', { 'x-muse-creator-code': code })
      assert.equal(collectionQueries.at(-1).searchParams.get('id'), `gt.${after}`)
      collectionFailure = true
      const failed = await api({ action: 'library' }, 'POST', { 'x-muse-creator-code': code })
      assert.equal(failed.status, 503)
      assert.ok(!JSON.stringify(failed.body).includes('private collection failure'))
      assert.equal(runtimeProviderCalls, calls)
    } finally {
      collectionFailure = false
      if (originalCode === undefined) delete process.env.MUSE_CREATOR_ACCESS_CODE
      else process.env.MUSE_CREATOR_ACCESS_CODE = originalCode
    }
  })
  await check('recipient cannot access management and owner cannot play with the owner token', async () => {
    assert.equal((await api({ action: 'manage', token: created.body.playToken })).status, 404)
    assert.equal((await api({ action: 'open', token: created.body.ownerToken })).status, 404)
    const managed = await api({ action: 'manage', token: created.body.ownerToken })
    assert.equal(managed.body.brief.message, brief.message)
    assert.equal(managed.body.expiresAt, null, 'Management never leaks the internal infinity sentinel')
  })
  await check('hosted progress uses exact bounded counts beyond 1000 rows, is owner-only and surfaces errors', async () => {
    const before = runtimeProviderCalls
    assert.equal((await api({ action: 'progress', token: created.body.playToken })).status, 404)
    assert.equal(progressQueries.length, 0, 'Recipient cannot trigger the progress query')
    const result = await api({ action: 'progress', token: created.body.ownerToken })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { progress: { opened: 1206, inProgress: 1201, solved: 2, skipped: 3, furthestScene: 1, sceneCount: content.scenes.length } })
    assert.equal(progressQueries.length, 4)
    progressFailure = true
    const unavailable = await api({ action: 'progress', token: created.body.ownerToken })
    assert.equal(unavailable.status, 503)
    assert.ok(!JSON.stringify(unavailable.body).includes('private database error'))
    assert.equal(unavailable.body.progress, undefined, 'Unavailable storage must not look like zero playthroughs')
    progressFailure = false
    assert.equal(runtimeProviderCalls, before, 'Progress never calls the AI provider')
  })
  await check('one hosted collection request includes authoritative progress without creating playthroughs or AI calls', async () => {
    const originalCode = process.env.MUSE_CREATOR_ACCESS_CODE
    process.env.MUSE_CREATOR_ACCESS_CODE = 'synthetic-combined-progress-code'
    try {
      const calls = runtimeProviderCalls
      const result = await api({ action: 'library', includeProgress: true }, 'POST', { 'x-muse-creator-code': process.env.MUSE_CREATOR_ACCESS_CODE })
      assert.equal(result.status, 200)
      assert.deepEqual(result.body.stories[0].progress, {
        opened: 1206, inProgress: 1201, solved: 2, skipped: 3, furthestScene: 1, sceneCount: content.scenes.length
      })
      assert.equal(runtimeProviderCalls, calls)
    } finally {
      if (originalCode === undefined) delete process.env.MUSE_CREATOR_ACCESS_CODE
      else process.env.MUSE_CREATOR_ACCESS_CODE = originalCode
    }
  })
  await check('hosted live progress counts successful scenes per playthrough across all result pages, not charged attempts', async () => {
    const previous = stored.brief
    const calls = runtimeProviderCalls
    stored.brief = { ...previous, adventure: { actionBudget: 12 } }
    try {
      const result = await api({ action: 'progress', token: created.body.ownerToken })
      assert.equal(result.status, 200)
      assert.equal(result.body.progress.furthestScene, 7, 'Seven generated scenes plus the opening, not sum across recipients')
      assert.equal(result.body.progress.sceneCount, null, 'Live stories do not invent a fixed total')
      assert.equal(adventureProgressQueries.length, 2)
      assert.equal(adventureProgressQueries[1].searchParams.get('offset'), '1000')
      adventureProgressFailure = true
      const failed = await api({ action: 'progress', token: created.body.ownerToken })
      assert.equal(failed.status, 503)
      assert.equal(failed.body.progress, undefined)
      assert.ok(!JSON.stringify(failed.body).includes('private adventure storage failure'))
      assert.equal(runtimeProviderCalls, calls)
    } finally { stored.brief = previous; adventureProgressFailure = false }
  })
  await check('recipient open, clues and wrong guesses never receive private data', async () => {
    const opened = await api({ action: 'open', token: created.body.playToken })
    assert.equal(opened.status, 200)
    playerSession = opened.body.sessionToken
    assert.match(playerSession, /^[a-f0-9]{64}$/)
    const wrong = await api({ action: 'guess', token: created.body.playToken, sessionToken: playerSession, guess: `not ${brief.solution}` })
    const next = await api({ action: 'next', token: created.body.playToken, sessionToken: playerSession })
    for (const result of [opened, wrong, next]) {
      assert.equal(result.status, 200)
      assert.ok(!JSON.stringify(result.body).includes(brief.message))
      assert.ok(!JSON.stringify(result.body).includes(brief.solution))
    }
    assert.equal(wrong.body.player.solved, false)
    assert.equal(next.body.player.sceneIndex, 1)
  })
  await check('a correct normalized guess reveals the final message through the API', async () => {
    const solved = await api({ action: 'guess', token: created.body.playToken, sessionToken: playerSession, guess: 'BEHIND THE BLUE NOTEBOOK!' })
    assert.equal(solved.status, 200)
    assert.equal(solved.body.player.solved, true)
    assert.equal(solved.body.player.message, brief.message)
    assert.ok(!JSON.stringify(solved.body).includes(brief.solution))
  })
  await check('recipient cannot delete or replace the creator link', async () => {
    for (const action of ['delete', 'share']) assert.equal((await api({ action, token: created.body.playToken })).status, 404)
  })
  await check('owner can rotate the recipient token, invalidating the old link', async () => {
    const replaced = await api({ action: 'share', token: created.body.ownerToken })
    assert.equal(replaced.status, 200)
    assert.notEqual(replaced.body.playToken, created.body.playToken)
    assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 404)
    assert.equal((await api({ action: 'open', token: replaced.body.playToken })).status, 200)
    created.body.playToken = replaced.body.playToken
  })
  await check('invalid methods, cross-origin requests, unknown actions and malformed tokens fail', async () => {
    assert.equal((await api({}, 'GET')).status, 405)
    assert.equal((await api({ action: 'create', brief }, 'POST', { origin: 'https://evil.example' })).status, 403)
    assert.equal((await api({ action: 'unknown' })).status, 400)
    assert.equal((await api({ action: 'open', token: 'old-base64-payload' })).status, 404)
    assert.equal((await api({ action: 'guess', token: created.body.playToken, sessionToken: 'bad', guess: 'answer' })).status, 400)
  })
  await check('durable request cap blocks provider calls and guessing', async () => {
    allowRequest = false
    assert.equal((await api({ action: 'create', brief })).status, 429)
    assert.equal((await api({ action: 'guess', token: created.body.playToken, sessionToken: playerSession, guess: 'answer' })).status, 429)
    allowRequest = true
  })
  await check('missing hosted credentials produces an explicit 503, not insecure fallback', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 503)
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })
  await check('unmigrated hosted RPC fails explicitly rather than silently discarding hint progress', async () => {
    legacyRpc = true
    assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 503)
    legacyRpc = false
  })
  await check('creator deletion disables both capabilities', async () => {
    assert.equal((await api({ action: 'delete', token: created.body.ownerToken })).status, 200)
    assert.equal((await api({ action: 'manage', token: created.body.ownerToken })).status, 404)
    assert.equal((await api({ action: 'open', token: created.body.playToken })).status, 404)
  })
  await check('My Story API uses the same durable generation budget and explicit failures', async () => {
    const input = { action: 'create', mood: 'curious', need: '', profileKeypoints: [] }
    const run = (body = input, method = 'POST', headers = {}) => api(body, method, headers, personalHandler)
    assert.equal((await run()).body.generation, 'ai')
    allowRequest = false
    assert.equal((await run()).status, 429)
    allowRequest = true
    assert.equal((await run({ ...input, mood: 'bad' })).status, 400)
    assert.equal((await run(input, 'GET')).status, 405)
    assert.equal((await run(input, 'POST', { origin: 'https://evil.example' })).status, 403)
    delete process.env.ANTHROPIC_API_KEY
    assert.equal((await run()).status, 503)
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  })
  console.log(`\n${passed} Shared Story checks passed.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  global.fetch = originalFetch
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
  fs.rmSync(output, { recursive: true, force: true })
})
