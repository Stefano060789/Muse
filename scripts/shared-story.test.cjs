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
  process.env.NODE_ENV = 'test'
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
  const { translateSharedStory } = require(path.join(output, 'lib', 'sharedStoryTranslator.js'))
  const { parseSharedStoryTranslation } = require(path.join(output, 'lib', 'sharedStoryTranslation.js'))
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
  await check('fresh-install and incremental Supabase schemas have identical guarded ending functions and service-only RPCs', () => {
    const baseline = fs.readFileSync(path.join(root, 'supabase', 'shared-stories.sql'), 'utf8')
    const migration = fs.readFileSync(path.join(root, 'supabase', 'shared-story-endings.sql'), 'utf8')
    const definition = sql => sql.match(/create or replace function public\.advance_shared_story\([\s\S]*?\n\$\$;/)[0]
      .replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()
    assert.equal(definition(baseline), definition(migration))
    for (const sql of [baseline, migration]) {
      assert.match(sql, /create or replace function public\.advance_shared_story_ending/)
      assert.match(sql, /create or replace function public\.muse_cooperative_ending_advance/)
      assert.match(sql, /from public, anon, authenticated/)
      assert.match(sql, /to service_role/)
    }
  })
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  let providerRequest
  const providerMock = async (_url, options) => {
    providerRequest = JSON.parse(options.body)
    return json({ choices: [{ message: { content: JSON.stringify(content) } }] })
  }

  await check('brief preserves the creator setting, recipient hints and private payoff', () => {
    assert.deepEqual(parseSharedStoryBrief(brief), { ...brief, puzzleDifficulty: 'balanced', answerType: 'phrase', assistanceHints: [], alternativeAnswers: [] })
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
    const clue = parseSharedStoryBrief({ ...brief, answerType: 'clue' })
    assert.equal(sharedStoryPlayerView(clue, content, { current_scene: 0, solved: false }).answerType, 'clue')
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
  await check('puzzle difficulty defaults to balanced and validates supported levels', () => {
    assert.equal(parseSharedStoryBrief(brief).puzzleDifficulty, 'balanced')
    for (const puzzleDifficulty of ['gentle', 'easy', 'balanced', 'challenging', 'expert']) {
      assert.equal(parseSharedStoryBrief({ ...brief, puzzleDifficulty }).puzzleDifficulty, puzzleDifficulty)
    }
    for (const puzzleDifficulty of [null, '', 'impossible']) {
      assert.throws(() => parseSharedStoryBrief({ ...brief, puzzleDifficulty }), /puzzle difficulty/)
    }
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
    await generateSharedStory({ ...brief, answerType: 'clue', solution: 'silver key' })
    assert.match(providerRequest.messages[0].content, /identifying the specific clue/)
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
    const view = sharedStoryPlayerView(brief, content, { current_scene: content.scenes.length - 1, solved: true })
    assert.equal(view.message, brief.message)
    assert.equal(view.solution, undefined)
  })
  await check('unlock policy validates strictly and skipped reveal is distinct from solved', () => {
    assert.equal(parseSharedStoryBrief(brief).unlockPolicy, undefined)
    assert.equal(parseSharedStoryBrief({ ...brief, unlockPolicy: 'allow-skip' }).unlockPolicy, 'allow-skip')
    for (const unlockPolicy of [null, true, 'skip', '']) assert.throws(() => parseSharedStoryBrief({ ...brief, unlockPolicy }))
    const enabled = { ...brief, unlockPolicy: 'allow-skip' }
    const locked = sharedStoryPlayerView(enabled, content, { current_scene: 0, solved: false })
    assert.equal(locked.canSkip, false)
    assert.equal(locked.message, undefined)
    const skipped = sharedStoryPlayerView(enabled, content, { current_scene: content.scenes.length - 1, solved: false, skipped: true })
    assert.equal(skipped.solved, false)
    assert.equal(skipped.skipped, true)
    assert.equal(skipped.canSkip, false)
    assert.equal(skipped.message, brief.message)
    assert.ok(!JSON.stringify(skipped).includes(brief.solution))
  })
  await check('pass-and-play turn taking is optional, strictly parsed and generator-directed', async () => {
    const teamBrief = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 12, turnTaking: true } })
    assert.deepEqual(teamBrief.adventure, { actionBudget: 12, choiceMode: 'free', turnTaking: true })
    const cooperativeBrief = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 20, choiceMode: 'suggested', cooperative: true } })
    assert.deepEqual(cooperativeBrief.adventure, { actionBudget: 20, choiceMode: 'suggested', cooperative: true })
    assert.throws(() => parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 12, cooperative: 'yes' } }))
    assert.throws(() => parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 12, turnTaking: 'yes' } }))
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_PROVIDER = 'GROQ'
    global.fetch = async (url, options) => providerMock(url, options)
    assert.deepEqual(await generateSharedStory(teamBrief), content)
    assert.match(providerRequest.messages[0].content, /pass-and-play story for two people sharing one device/)
    assert.deepEqual(JSON.parse(providerRequest.messages[1].content), teamBrief)
    const cooperativePromptBrief = { ...cooperativeBrief, adventure: { ...cooperativeBrief.adventure, choiceMode: 'free' } }
    await generateSharedStory(cooperativePromptBrief)
    assert.match(providerRequest.messages[0].content, /participants as one team/)
    assert.deepEqual(JSON.parse(providerRequest.messages[1].content), cooperativePromptBrief)
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
  await check('story difficulty directs clue clarity and fair attention in generation', async () => {
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_PROVIDER = 'GROQ'
    for (const [puzzleDifficulty, expected] of [
      ['gentle', /Story difficulty: gentle.*one simple inference/],
      ['easy', /Story difficulty: easy.*two obvious details/],
      ['balanced', /Story difficulty: standard.*few clear details/],
      ['challenging', /Story difficulty: challenging but fair.*several concrete details/],
      ['expert', /Story difficulty: expert but fair.*layered deductions/]
    ]) {
      await generateSharedStory(parseSharedStoryBrief({ ...brief, puzzleDifficulty }))
      assert.match(providerRequest.messages[0].content, expected)
    }
  })
  await check('ending modes validate authored options and allow no solution only outside answer mode', () => {
    const choices = ['Open the cedar door', 'Follow the silver river', 'Wait beside the lantern']
    for (const participants of ['recipient', 'together']) {
      const parsed = parseSharedStoryBrief({ ...brief, participants })
      assert.equal(parsed.participants, participants)
      assert.equal(parsed.adventure, undefined, 'Participation never forces live, turn-taking or cooperative mode')
      assert.equal(sharedStoryPlayerView(parsed, content, { current_scene: 0, solved: false }).participants, participants)
    }
    assert.throws(() => parseSharedStoryBrief({ ...brief, participants: 'unsupported' }), /participant/)
    for (const endingMode of ['choice', 'automatic']) {
      const ending = parseSharedStoryBrief({ ...brief, solution: undefined, endingMode, ...(endingMode === 'choice' ? { endingChoices: choices } : {}) })
      assert.equal(ending.solution, '')
      assert.equal(parseGeneratedStory(content, ending).scenes.length, content.scenes.length)
      const early = sharedStoryPlayerView(ending, content, { current_scene: 0, solved: true, skipped: true })
      assert.equal(early.solved, false)
      assert.equal(early.skipped, false)
      assert.equal(early.message, undefined)
      assert.equal(early.endingChoices, undefined)
      const final = sharedStoryPlayerView(ending, content, { current_scene: 2, solved: false })
      assert.equal(final.endingMode, endingMode)
      assert.deepEqual(final.endingChoices, endingMode === 'choice' ? choices : undefined)
      assert.equal(final.message, undefined)
      const completed = sharedStoryPlayerView(ending, content, { current_scene: 2, solved: true })
      assert.equal(completed.message, brief.message)
      assert.deepEqual(completed.scene, content.scenes[2], 'Solved view retains the final prepared scene for rendering above the reveal')
      assert.equal(completed.scene.body, content.scenes[2].body)
    }
    for (const change of [
      { endingMode: 'invalid' }, { endingMode: null }, { solution: undefined },
      { endingMode: 'automatic', goal: '' }, { endingMode: 'choice', endingChoices: choices.slice(0, 2) },
      { endingMode: 'choice', endingChoices: [...choices, ...choices] },
      { endingMode: 'choice', endingChoices: ['Open!', 'open', 'Wait'] },
      { endingMode: 'choice', endingChoices: ['!!!', 'Wait', 'Go'] },
      { endingMode: 'choice', endingChoices: [brief.message, ...choices.slice(1)] },
      { endingMode: 'choice', endingChoices: ['x'.repeat(161), ...choices.slice(1)] }
    ]) assert.throws(() => parseSharedStoryBrief({ ...brief, ...change }))
    const ending = parseSharedStoryBrief({ ...brief, endingMode: 'choice', endingChoices: choices })
    assert.throws(() => parseGeneratedStory({ ...content, description: choices[0] }, ending), /exposed/)
  })
  await check('suggested prepared scenes require distinct actions on every non-final scene, with separate final controls', () => {
    const suggested = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 6, choiceMode: 'suggested' } })
    const choices = ['Inspect the arch', 'Examine the stream', 'Listen at the gate']
    const prepared = { ...content, scenes: content.scenes.map((scene, index) => ({ ...scene, ...(index < content.scenes.length - 1 ? { choices } : {}) })) }
    assert.equal(parseGeneratedStory(prepared, suggested).scenes.length, 3)
    for (const index of [0, 1]) {
      assert.throws(() => parseGeneratedStory({ ...prepared, scenes: prepared.scenes.map((scene, i) => i === index ? { ...scene, choices: undefined } : scene) }, suggested), /every non-final/)
      assert.throws(() => parseGeneratedStory({ ...prepared, scenes: prepared.scenes.map((scene, i) => i === index ? { ...scene, choices: ['Inspect!', 'inspect', 'Wait'] } : scene) }, suggested))
    }
    const final = sharedStoryPlayerView(suggested, { ...prepared, scenes: prepared.scenes.map(scene => ({ ...scene, choices })) }, { current_scene: 2, solved: false })
    assert.equal(final.scene.choices, undefined)
  })
  await check('unused final-scene and free-action choices accept empty provider arrays without weakening required menus', () => {
    const choices = ['Inspect the arch', 'Examine the stream', 'Listen at the gate']
    const suggested = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 6, choiceMode: 'suggested' } })
    for (const empty of [[], null]) {
      const prepared = { ...content, scenes: content.scenes.map((scene, index) => ({ ...scene, choices: index < 2 ? choices : empty })) }
      assert.equal(parseGeneratedStory(prepared, suggested).scenes[2].choices, undefined)
      const free = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 6, choiceMode: 'free' } })
      assert.ok(parseGeneratedStory({ ...content, scenes: content.scenes.map(scene => ({ ...scene, choices: empty })) }, free).scenes.every(scene => scene.choices === undefined))
      assert.throws(() => parseGeneratedStory({ ...prepared, scenes: prepared.scenes.map((scene, index) => index === 0 ? { ...scene, choices: empty } : scene) }, suggested))
    }
  })
  await check('invalid generated actions retry once automatically, with no retry on unrelated validation failures', async () => {
    const previousFetch = global.fetch
    const suggested = parseSharedStoryBrief({ ...brief, adventure: { actionBudget: 6, choiceMode: 'suggested' } })
    const choices = ['Inspect the arch', 'Examine the stream', 'Listen at the gate']
    const valid = { ...content, scenes: content.scenes.map((scene, index) => ({ ...scene, choices: index < 2 ? choices : [] })) }
    const invalid = { ...valid, scenes: valid.scenes.map((scene, index) => index === 0 ? { ...scene, choices: ['Only one option'] } : scene) }
    let calls = 0
    try {
      global.fetch = async (_url, options) => {
        calls++
        if (calls === 2) assert.match(JSON.parse(options.body).messages[0].content, /previous response failed action-choice validation/)
        return json({ choices: [{ message: { content: JSON.stringify(calls === 1 ? invalid : valid) } }] })
      }
      const result = await generateSharedStory(suggested)
      assert.equal(calls, 2)
      assert.deepEqual(result.scenes[0].choices, choices)
      assert.equal(result.scenes[2].choices, undefined)
      calls = 0
      global.fetch = async () => {
        calls++
        return json({ choices: [{ message: { content: JSON.stringify(invalid) } }] })
      }
      await assert.rejects(() => generateSharedStory(suggested), /after an automatic retry/)
      assert.equal(calls, 2, 'Never loop indefinitely on malformed choices')
      calls = 0
      global.fetch = async () => {
        calls++
        return json({ choices: [{ message: { content: JSON.stringify({ ...valid, description: brief.message }) } }] })
      }
      await assert.rejects(() => generateSharedStory(suggested), /exposed/)
      assert.equal(calls, 1, 'Privacy failures are not choice-retried')
    } finally { global.fetch = previousFetch }
  })
  await check('exhausted live actions stop local exploration without concluding or exposing future prepared scenes', async () => {
    const { generateAdventureTurn, adventureChoiceView } = require(path.join(output, 'lib', 'sharedAdventure.js'))
    const originalMock = global.fetch
    const turn = { narration: Array(40).fill('wonder').join(' '), state: { inventory: [], discoveries: [], relationships: [], progress: 'Pause here and continue through the prepared scenes.' } }
    let request
    global.fetch = async (_url, options) => {
      request = JSON.parse(options.body)
      return json({ choices: [{ message: { content: JSON.stringify(turn) } }] })
    }
    try {
      const story = {
        brief: { ...brief, participants: 'together', adventure: { actionBudget: 1 } },
        content: { ...content, scenes: content.scenes.map((scene, index) => ({ ...scene, title: `Future marker ${index}` })) }
      }
      const view = { revision: 1, actionsUsed: 1, actionsRemaining: 0, budget: 1, budgetRemaining: 0, pending: true, turn: null }
      await generateAdventureTurn(story, view, 'Look around', undefined, 0)
      assert.match(request.messages[0].content, /Budget exhaustion is never a journey ending/)
      assert.match(request.messages[0].content, /Never narrate reaching future scenes/)
      assert.match(request.messages[0].content, /narrative context only/)
      const input = JSON.parse(request.messages[1].content)
      assert.equal(input.participants, 'together')
      assert.equal(input.sceneIndex, 0)
      assert.equal(input.sceneCount, 3)
      assert.equal(input.plan.length, 1)
      assert.ok(!JSON.stringify(input).includes('Future marker 1'))
      assert.ok(!JSON.stringify(input).includes(brief.message))
      const state = { inventory: ['A map'], discoveries: [], relationships: [], progress: 'Found a map' }
      const activeView = { ...view, actionsRemaining: 3, budgetRemaining: 3, pending: false, turn: { ...turn, state, sceneIndex: 0 } }
      const continued = adventureChoiceView(activeView, story, 1)
      assert.equal(continued.turn, null, 'A previous scene narration is not displayed after Next')
      assert.equal(continued.sceneIndex, 1)
      assert.deepEqual(continued.state, state, 'Durable discoveries survive Next')
      const currentChoices = ['Inspect the arch', 'Examine the stream', 'Listen at the gate']
      const suggestedStory = {
        ...story, brief: { ...story.brief, adventure: { actionBudget: 6, choiceMode: 'suggested' } },
        content: { ...story.content, scenes: story.content.scenes.map((scene, index) => ({ ...scene, choices: index === 1 ? currentChoices : ['Search the desk', 'Read the map', 'Ask the guide'] })) }
      }
      assert.deepEqual(adventureChoiceView(activeView, suggestedStory, 1).choices, currentChoices)
    } finally { global.fetch = originalMock }
  })
  await check('translation validates target language and sends only public story content', async () => {
    const translatedContent = {
      ...content, title: 'La stanza delle stelle', description: 'Trova la lettera nascosta.',
      narrationLanguage: 'it-IT',
      scenes: content.scenes.map((scene, index) => ({
        title: `Scoperta ${index + 1}`, body: `Guarda le stelle ${index + 1}.`,
        clue: `Osserva il cielo ${index + 1}.`
      }))
    }
    global.fetch = async (_url, options) => {
      providerRequest = JSON.parse(options.body)
      return json({ choices: [{ message: { content: JSON.stringify(translatedContent) } }] })
    }
    const privateBrief = {
      ...brief, recipientHints: 'PRIVATE RECIPIENT HINT', assistanceHints: ['PRIVATE ASSISTANCE'],
      alternativeAnswers: ['PRIVATE ALTERNATIVE'], solution: 'PRIVATE SECRET', message: 'PRIVATE REVEAL',
      gift: { occasion: 'surprise', dedication: 'PRIVATE DEDICATION', allowReply: false }
    }
    const translation = await translateSharedStory(parseSharedStoryBrief(privateBrief), content, 'it-IT')
    assert.equal(translation.language, 'it-IT')
    assert.equal(translation.content.scenes.length, content.scenes.length)
    const serializedInput = JSON.stringify(providerRequest.messages[1].content)
    for (const privateValue of [privateBrief.recipientHints, privateBrief.assistanceHints[0], privateBrief.alternativeAnswers[0],
      privateBrief.solution, privateBrief.message, privateBrief.gift.dedication]) {
      assert.ok(!serializedInput.includes(privateValue), `translation prompt excluded ${privateValue}`)
    }
    assert.throws(() => parseSharedStoryTranslation({ ...translation, language: 'en-US' }, 'it-IT'), /invalid/)
  })
  await check('automatic messages and final-choice options cannot leak through translated public scenes', async () => {
    const originalMock = global.fetch
    const endingChoices = ['Open the cedar door', 'Follow the silver river', 'Wait beside the lantern']
    try {
      for (const secret of [brief.message, endingChoices[0]]) {
        global.fetch = async () => json({ choices: [{ message: { content: JSON.stringify({
          ...content, description: secret, narrationLanguage: 'it-IT'
        }) } }] })
        await assert.rejects(() => translateSharedStory({ ...brief, solution: '', endingMode: 'choice', endingChoices }, content, 'it-IT'), /privacy validation/)
      }
    } finally { global.fetch = originalMock }
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
  const followUpReply = { message: 'A voluntary reflection about my grandmother’s garden.', createdAt: '2026-10-15T00:00:00.000Z' }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://muse-test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
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
    if (location.pathname === '/auth/v1/user') {
      if (new Headers(options.headers).get('Authorization') === 'Bearer personal-consent-fixture') {
        return json({
          id: 'fixture-account',
          email: 'fixture@example.test',
          user_metadata: {
            muse_registration_permissions: {
              version: '2026-11-01', acceptedAt: new Date().toISOString(), services: true, romance: false
            }
          }
        })
      }
      return json({ id: new Headers(options.headers).get('Authorization') === 'Bearer other-account-token' ? 'other-account' : 'fixture-account', email: 'fixture@example.test' })
    }
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
    if (location.pathname === '/rest/v1/shared_story_replies') {
      return json(location.searchParams.get('select') === 'message,created_at'
        ? [{ message: followUpReply.message, created_at: followUpReply.createdAt }]
        : [])
    }
    if (location.pathname === '/rest/v1/shared_story_voice') return json([])
    if (location.pathname.endsWith('/rpc/reserve_shared_story_request')) return json(allowRequest)
    if (location.pathname.endsWith('/rpc/advance_shared_story_ending')) {
      assert.equal(body.expected_play_hash, stored.play_hash)
      if (['guess', 'skip', 'ending-choice'].includes(body.action_name) && state.current_scene < content.scenes.length - 1) return json({ message: 'Reach the final scene first' }, 400)
      const endingMode = stored.brief.endingMode ?? 'answer'
      if ((['guess', 'skip'].includes(body.action_name) && endingMode !== 'answer') ||
          (body.action_name === 'ending-choice' && endingMode !== 'choice')) return json({ message: 'This ending requires a different action' }, 400)
      if (body.action_name === 'ending-choice' && (!/^[0-4]$/.test(body.guess_normalized) || !stored.brief.endingChoices?.[Number(body.guess_normalized)])) return json({ message: 'Invalid ending choice' }, 400)
      if (body.action_name === 'next') state.current_scene = Math.min(state.current_scene + 1, content.scenes.length - 1)
      if (body.action_name === 'guess') state.solved = body.guess_normalized === stored.answer_normalized || stored.alternative_answers_normalized.includes(body.guess_normalized)
      if (body.action_name === 'ending-choice') state.solved = true
      if (body.action_name === 'skip') state.skipped = true
      if (endingMode === 'automatic' && ['open', 'next'].includes(body.action_name) && state.current_scene === content.scenes.length - 1) state.solved = true
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
      return json(stored && location.searchParams.get('owner_id') === `eq.${stored.owner_id}` ? [stored] : [])
    }
    if (options.method === 'POST') {
      stored = body
      return new Response(null, { status: 201 })
    }
    if (options.method === 'PATCH') {
      stored = { ...stored, ...body }
      if (location.searchParams.get('select') === 'id') return json({ id: stored.id })
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
    await selectedHandler({ method, body: { consentVersion: '2026-11-01', ...body }, headers: { host: 'localhost:3102', authorization: 'Bearer fixture-account-token', ...headers }, socket: { remoteAddress: '127.0.0.1' } }, res)
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
  await check('hosted account recovery is owner-scoped, paginated, read-only and returns role-separated capabilities', async () => {
    const calls = runtimeProviderCalls
    const before = JSON.stringify(stored)
    assert.equal((await api({ action: 'library' }, 'POST', { authorization: '' })).status, 401)
    assert.equal(collectionQueries.length, 0)
    const result = await api({ action: 'library' })
    assert.equal(result.status, 200)
    assert.equal(result.body.next, null)
    assert.equal(result.body.stories.length, 1)
    const query = collectionQueries.at(-1)
    assert.equal(query.searchParams.get('owner_id'), 'eq.fixture-account')
    assert.equal(query.searchParams.get('limit'), '21')
    assert.equal(query.searchParams.get('order'), 'id.asc')
    assert.ok(query.searchParams.get('expires_at').startsWith('gt.'))
    const recovered = result.body.stories[0]
    assert.equal(recovered.recovered, true)
    assert.equal(recovered.brief.message, brief.message)
    assert.equal(recovered.expiresAt, null)
    assert.equal((await api({ action: 'manage', token: recovered.ownerToken })).status, 200)
    assert.equal((await api({ action: 'manage', token: recovered.ownerToken }, 'POST', { authorization: 'Bearer other-account-token' })).status, 404)
    assert.equal(JSON.stringify(stored), before, 'Recovery does not patch stored hashes')
    const after = stored.id
    await api({ action: 'library', after })
    assert.equal(collectionQueries.at(-1).searchParams.get('id'), `gt.${after}`)
    assert.equal(collectionQueries.at(-1).searchParams.get('owner_id'), 'eq.fixture-account')
    collectionFailure = true
    const failed = await api({ action: 'library' })
    assert.equal(failed.status, 503)
    assert.ok(!JSON.stringify(failed.body).includes('private collection failure'))
    assert.equal(runtimeProviderCalls, calls)
    collectionFailure = false
  })
  await check('recipient cannot access management and owner cannot play with the owner token', async () => {
    assert.equal((await api({ action: 'manage', token: created.body.playToken })).status, 404)
    assert.equal((await api({ action: 'open', token: created.body.ownerToken })).status, 404)
    const managed = await api({ action: 'manage', token: created.body.ownerToken })
    assert.equal(managed.body.brief.message, brief.message)
    assert.equal(managed.body.expiresAt, null, 'Management never leaks the internal infinity sentinel')
  })
  await check('owner can edit a safe story title and the recipient projection sees the persisted title', async () => {
    assert.equal((await api({ action: 'title', token: created.body.playToken, title: 'A New Story' })).status, 404)
    assert.equal((await api({ action: 'title', token: created.body.ownerToken, title: `Meet me ${brief.message}` })).status, 400)
    assert.equal((await api({ action: 'title', token: created.body.ownerToken, title: '   ' })).status, 400)
    assert.equal((await api({ action: 'title', token: created.body.ownerToken, title: '!!!' })).status, 400)
    const changed = await api({ action: 'title', token: created.body.ownerToken, title: 'A Story Across the Stars' })
    assert.equal(changed.status, 200)
    assert.equal(changed.body.content.title, 'A Story Across the Stars')
    assert.equal(stored.content.title, 'A Story Across the Stars')
    assert.equal((await api({ action: 'manage', token: created.body.ownerToken })).body.content.title, 'A Story Across the Stars')
    const opened = await api({ action: 'open', token: created.body.playToken }, 'POST', { authorization: undefined })
    assert.equal(opened.body.player.title, 'A Story Across the Stars')
    await api({ action: 'title', token: created.body.ownerToken, title: content.title })
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
  await check('one hosted account collection request includes progress without creating playthroughs or AI calls', async () => {
    const calls = runtimeProviderCalls
    const result = await api({ action: 'library', includeProgress: true })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.stories[0].progress, {
      opened: 1206, inProgress: 1201, solved: 2, skipped: 3, furthestScene: 1, sceneCount: content.scenes.length
    })
    assert.equal(runtimeProviderCalls, calls)
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
    const callsBeforeUnconsentedTranslation = runtimeProviderCalls
    const unconsentedTranslation = await api({
      action: 'translate', token: created.body.playToken, sessionToken: playerSession, language: 'it-IT'
    })
    assert.equal(unconsentedTranslation.status, 403, 'The server requires explicit translation consent')
    assert.equal(runtimeProviderCalls, callsBeforeUnconsentedTranslation, 'Unconsented translation never reaches the AI provider')
    const early = await api({ action: 'guess', token: created.body.playToken, sessionToken: playerSession, guess: brief.solution })
    assert.equal(early.status, 409)
    const next = await api({ action: 'next', token: created.body.playToken, sessionToken: playerSession })
    for (const result of [opened, next]) {
      assert.equal(result.status, 200)
      assert.ok(!JSON.stringify(result.body).includes(brief.message))
      assert.ok(!JSON.stringify(result.body).includes(brief.solution))
    }
    assert.equal(next.body.player.sceneIndex, 1)
  })
  await check('a correct normalized guess reveals the final message through the API', async () => {
    await api({ action: 'next', token: created.body.playToken, sessionToken: playerSession })
    const solved = await api({ action: 'guess', token: created.body.playToken, sessionToken: playerSession, guess: 'BEHIND THE BLUE NOTEBOOK!' })
    assert.equal(solved.status, 200)
    assert.equal(solved.body.player.solved, true)
    assert.equal(solved.body.player.message, brief.message)
    assert.ok(!JSON.stringify(solved.body).includes(brief.solution))
  })
  await check('hosted endings fail closed rather than using an older early-unlock RPC', async () => {
    const originalMock = global.fetch
    global.fetch = async (url, options) => String(url).endsWith('/rpc/advance_shared_story_ending')
      ? json({ code: 'PGRST202', message: 'Function is not installed' }, 404)
      : originalMock(url, options)
    try {
      const result = await api({ action: 'open', token: created.body.playToken })
      assert.equal(result.status, 503)
      assert.match(result.body.error, /shared-story-endings.sql/)
      assert.ok(!JSON.stringify(result.body).includes(brief.message))
    } finally { global.fetch = originalMock }
  })
  await check('hosted JSON persistence and versioned RPC round-trip choice/automatic endings without early leakage', async () => {
    const original = stored
    const originalState = state
    const choices = ['Open the cedar door', 'Follow the silver river', 'Wait beside the lantern']
    for (const endingMode of ['choice', 'automatic']) {
      state = { current_scene: 0, solved: false, skipped: false, revealed_hints: 0 }
      const made = await api({ action: 'create', brief: { ...brief, solution: '', endingMode, endingChoices: endingMode === 'choice' ? choices : undefined } })
      assert.equal(made.status, 201)
      assert.equal(stored.brief.endingMode, endingMode)
      assert.equal(stored.answer_normalized, '')
      const managed = await api({ action: 'manage', token: made.body.ownerToken })
      assert.equal(managed.body.brief.endingMode, endingMode)
      assert.deepEqual(managed.body.brief.endingChoices, endingMode === 'choice' ? choices : undefined)
      const opened = await api({ action: 'open', token: made.body.playToken })
      const sessionToken = opened.body.sessionToken
      const token = made.body.playToken
      assert.equal(opened.body.player.endingChoices, undefined)
      assert.equal(opened.body.player.message, undefined)
      if (endingMode === 'choice') assert.equal((await api({ action: 'ending-choice', token, sessionToken, choiceIndex: 0 })).status, 409)
      assert.equal((await api({ action: 'guess', token, sessionToken, guess: brief.solution })).status, 409)
      await api({ action: 'next', token, sessionToken })
      const final = await api({ action: 'next', token, sessionToken })
      if (endingMode === 'choice') {
        assert.deepEqual(final.body.player.endingChoices, choices)
        assert.equal(final.body.player.message, undefined)
        assert.equal((await api({ action: 'ending-choice', token, sessionToken, choiceIndex: 3 })).status, 400)
        const selected = await api({ action: 'ending-choice', token, sessionToken, choiceIndex: 2 })
        assert.equal(selected.body.player.message, brief.message)
      } else {
        assert.equal(final.body.player.message, brief.message)
        assert.equal(final.body.player.endingChoices, undefined)
        assert.deepEqual(final.body.player.scene, content.scenes[content.scenes.length - 1])
      }
      const reopened = await api({ action: 'open', token, sessionToken })
      assert.equal(reopened.body.player.solved, true)
      assert.equal(reopened.body.player.message, brief.message)
    }
    stored = original
    state = originalState
  })
  await check('creator-approved follow-up uses an exact stored reply and fresh consent, without changing the original', async () => {
    const original = stored
    stored = { ...stored, brief: { ...stored.brief, participants: 'together', gift: { occasion: 'surprise', dedication: '', allowReply: true } } }
    const payload = {
      action: 'follow-up', token: created.body.ownerToken,
      reply: followUpReply.message, replyCreatedAt: followUpReply.createdAt,
      direction: 'A warm garden mystery', goal: 'Find the next seed packet',
      solution: 'beneath the stone', message: 'Our garden keeps growing.'
    }
    const before = runtimeProviderCalls
    assert.equal((await api({ ...payload, consentVersion: undefined })).status, 400, 'No follow-up generation without fresh AI consent')
    assert.equal(runtimeProviderCalls, before)
    assert.equal((await api({ ...payload, token: created.body.playToken })).status, 404, 'Recipient capability cannot create a follow-up')
    assert.equal((await api({ ...payload, reply: 'stale reply' })).status, 409, 'Only the reply still stored for this story can be selected')
    const result = await api(payload)
    assert.equal(result.status, 201)
    assert.notEqual(result.body.ownerToken, created.body.ownerToken)
    assert.notEqual(result.body.playToken, created.body.playToken)
    assert.equal(result.body.brief.goal, payload.goal)
    assert.equal(result.body.brief.solution, payload.solution)
    assert.equal(result.body.brief.message, payload.message)
    assert.equal(result.body.brief.participants, 'together')
    assert.equal(result.body.brief.recipientHints, '', 'Previous private profile hints are not carried forward')
    const sent = JSON.parse(providerRequest.messages[0].content)
    assert.equal(sent.followUpContext.recipientReply, followUpReply.message)
    assert.match(sent.followUpContext.previousEnding, /Discovery 3/)
    assert.ok(!JSON.stringify(sent).includes(brief.solution), 'The previous secret answer is not forwarded into the follow-up prompt')
    assert.deepEqual(stored.brief, result.body.brief)
    stored = original
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
    const run = (body = input, method = 'POST', headers = {}) => api(body, method, {
      authorization: 'Bearer personal-consent-fixture', ...headers
    }, personalHandler)
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
