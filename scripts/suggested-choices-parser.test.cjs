const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-suggested-choice-parser-'))

try {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/freeformStory.ts', '--outDir', output, '--module', 'commonjs',
    '--target', 'es2020', '--esModuleInterop', '--skipLibCheck', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })

  const { parseSuggestedChoices } = require(path.join(output, 'freeformStory.js'))
  const valid = ['Open the door', 'Ask the gardener', 'Follow the lanterns']
  assert.deepEqual(parseSuggestedChoices(valid), valid)

  for (const choices of [
    ['Open the door', 'Open the door!', 'Look outside'],
    ['café', 'cafe\u0301', 'Look outside'],
    ['Ａ', 'A', 'Look outside'],
    ['A  quiet path', 'A quiet path', 'Look outside'],
    ['Only one', 'Two choices'],
    ['A', 'B', 'C', 'D', 'E', 'F']
  ]) {
    assert.throws(() => parseSuggestedChoices(choices), `Expected rejection: ${choices.join(' / ')}`)
  }
} finally {
  fs.rmSync(output, { recursive: true, force: true })
}

console.log('PASS suggested-choice parser count and canonical duplicate checks')
