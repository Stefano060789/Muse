const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const output = fs.mkdtempSync(path.join(__dirname, '.sample-audio-'))
const hash = value => createHash('sha256').update(value).digest('hex')

async function main() {
  if (process.env.NEXT_PUBLIC_NARRATION_PROVIDER !== 'google' || !process.env.MUSE_GOOGLE_TTS_BUDGET_CHARACTERS) {
    throw new Error('Explicitly configure Google narration and its approved character budget before preparing sample audio.')
  }
  process.loadEnvFile(path.join(root, '.env.local'))
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/lib/googleNarration.ts', 'src/lib/sampleStory.ts',
    '--outDir', output, '--rootDir', 'src', '--module', 'commonjs', '--target', 'es2020',
    '--esModuleInterop', '--skipLibCheck', '--strict', '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit' })
  const { synthesizeGoogleNarration } = require(path.join(output, 'lib', 'googleNarration.js'))
  const { SAMPLE_STORY } = require(path.join(output, 'lib', 'sampleStory.js'))
  const entries = [
    ...SAMPLE_STORY.scenes.map((scene, index) => [`scene-${index + 1}`, `${scene.title}. ${scene.body} Clue: ${scene.clue}`]),
    ['message', SAMPLE_STORY.message]
  ]
  const manifest = {}
  const assets = []
  for (const [name, text] of entries) {
    const audio = Buffer.from(await synthesizeGoogleNarration(text, 'en-US', 'warm'))
    const audioHash = hash(audio)
    const filename = `${name}-${audioHash.slice(0, 12)}.mp3`
    assets.push({ filename, audio })
    manifest[name] = { src: `/sample-audio/${filename}`, textHash: hash(text), audioHash, bytes: audio.length }
  }
  const directory = path.join(root, 'public', 'sample-audio')
  fs.mkdirSync(directory, { recursive: true })
  for (const { filename, audio } of assets) fs.writeFileSync(path.join(directory, filename), audio)
  fs.writeFileSync(path.join(root, 'src', 'lib', 'sampleAudio.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Prepared ${assets.length} public sample recordings. No credentials or private stories are included.`)
}

main().catch(error => {
  console.error('Sample audio preparation failed:', error.message)
  process.exitCode = 1
}).finally(() => fs.rmSync(output, { recursive: true, force: true }))
