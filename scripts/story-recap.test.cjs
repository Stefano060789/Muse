const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/lib/storyRecap.ts'), 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const compiledModule = { exports: {} }
new Function('module', 'exports', 'require', javascript)(compiledModule, compiledModule.exports, id => {
  throw new Error(`Unexpected runtime dependency: ${id}`)
})
const { createStoryRecap, storyRecapCopy } = compiledModule.exports

const chapterOne = {
  id: 'one', title: 'The Garden', createdAt: '2026-11-01T10:00:00Z',
  chapter: { number: 1, rootId: 'one' }, currentStep: 2,
  scenes: [
    { title: 'A lantern', body: 'You found a lantern beside the old gate. The light stayed warm.', question: '', choices: [] },
    { title: 'The path', body: 'A path led you past the fountain and toward the gardener.', question: '', choices: [] },
    { title: 'A welcome', body: 'The gardener welcomed you into the quiet garden.', question: '', choices: [] }
  ],
  responses: ['I light the lantern.', 'I follow the path.']
}
const chapterTwo = {
  ...chapterOne, id: 'two', title: 'Beyond the Garden', createdAt: '2026-11-02T10:00:00Z',
  chapter: { number: 2, rootId: 'one', parentId: 'one', parentTitle: 'The Garden' },
  currentStep: 1, scenes: chapterOne.scenes.slice(0, 2), responses: ['I carry the lantern onward.']
}
const unrelated = { ...chapterOne, id: 'other', chapter: { number: 1, rootId: 'other' } }
const future = {
  ...chapterTwo, id: 'three', chapter: { number: 3, rootId: 'one', parentId: 'two', parentTitle: 'Beyond the Garden' }
}
const recap = createStoryRecap(chapterTwo, [
  { kind: 'personal', id: future.id, updatedAt: future.createdAt, story: future },
  { kind: 'personal', id: unrelated.id, updatedAt: unrelated.createdAt, story: unrelated },
  { kind: 'personal', id: chapterTwo.id, updatedAt: chapterTwo.createdAt, story: { ...chapterTwo, title: 'Stale local copy' } },
  { kind: 'personal', id: chapterOne.id, updatedAt: chapterOne.createdAt, story: chapterOne }
])

assert.deepEqual(recap.map(chapter => chapter.number), [1, 2], 'Related saved chapters are ordered and future chapters are omitted')
assert.equal(recap[1].title, 'Beyond the Garden', 'The current story replaces any stale library copy')
assert.equal(recap[0].highlights.length, 3, 'Long chapters include beginning, middle, and latest scene highlights')
assert.equal(recap[1].highlights.length, 2, 'The current recap stops at its saved current scene')
assert.deepEqual(recap[1].recentActions, ['I carry the lantern onward.'])
assert.ok(recap[0].highlights[0].text.includes('lantern'))
assert.equal(storyRecapCopy('en-US').show, 'Show story recap')
assert.match(storyRecapCopy('it-IT').intro, /interazioni IA/)
console.log('PASS local recap includes prior chapter highlights and recent actions without future or unrelated stories')
