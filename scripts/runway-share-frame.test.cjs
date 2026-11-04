const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file) {
  const module = { exports: {} }
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id =>
    id.startsWith('.') ? load(path.join(path.dirname(file), id + '.ts')) : require(id))
  return module.exports
}

async function main() {
  const { createRunwayFrameDataUrl } = load('src/lib/runwayShareFrame.ts')
  const descriptors = new Map(['Image', 'document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(global, key)]))
  const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL
  const urls = [], dimensions = [], draws = [], revoked = []
  let canvasFailure = false, output = 'data:image/jpeg;base64,/9gBAf/Y2Q=='
  try {
    URL.createObjectURL = blob => { urls.push(blob); return 'blob:artwork' }
    URL.revokeObjectURL = value => revoked.push(value)
    global.window = { setTimeout, clearTimeout }
    global.Image = class {
      set src(value) { assert.equal(value, 'blob:artwork'); queueMicrotask(() => this.onload?.()) }
    }
    global.document = {
      createElement(tag) {
        assert.equal(tag, 'canvas')
        return {
          width: 0, height: 0,
          getContext() { return canvasFailure ? null : { drawImage(...args) { draws.push(args) } } },
          toDataURL(type, quality) {
            assert.equal(type, 'image/jpeg')
            assert.equal(quality, 0.82)
            return output
          }
        }
      }
    }
    for (const motif of ['map', 'sword', 'doorway', 'ocean']) {
      const start = urls.length
      const value = await createRunwayFrameDataUrl(motif)
      assert.equal(value, output)
      const svg = await urls[start].text()
      assert.match(svg, /width="720" height="1280"/)
      assert.match(svg, /<path d=/)
      assert.doesNotMatch(svg, /<text|PRIVATE|<script/)
    }
    assert.equal(draws.length, 4)
    canvasFailure = true
    await assert.rejects(createRunwayFrameDataUrl('map'), /Canvas rendering/)
    canvasFailure = false
    output = 'data:image/png;base64,AAAA'
    await assert.rejects(createRunwayFrameDataUrl('map'), /invalid or too large/)
    output = 'data:image/jpeg;base64,/9gBAf/Y2Q=='
    assert.equal(revoked.length, urls.length, 'Temporary SVG URLs are released on success and failure')
    console.log('PASS premium image-to-video frame renders from privacy-safe local artwork as bounded JPEG and releases temporary URLs')
  } finally {
    URL.createObjectURL = createUrl
    URL.revokeObjectURL = revokeUrl
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(global, key, descriptor)
      else delete global[key]
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
