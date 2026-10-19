const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
}

function plain(file) {
  const module = { exports: {} }
  new Function('module', 'exports', 'require', compile(file))(
    module, module.exports, id => require(id)
  )
  return module.exports
}

function mount(file, dependencies, browser) {
  let cursor = 0
  let mounted = false
  const states = []
  const effects = []
  const jsx = (type, props) => ({ type, props: props || {} })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useEffect(effect) {
      if (!mounted) effects.push(effect)
    }
  }
  const module = { exports: {} }
  const requires = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/head': { __esModule: true, default: 'Head' },
    'next/link': { __esModule: true, default: 'Link' },
    '../components/InstallApp': { __esModule: true, default: 'InstallApp' },
    '../components/HoldToSpeakButton': { __esModule: true, default: 'HoldToSpeakButton' },
    './HoldToSpeakButton': { __esModule: true, default: 'HoldToSpeakButton' },
    '../lib/storyLibrary': dependencies.storyLibrary,
    '../lib/profile': dependencies.profile,
    '../lib/useStoryInteraction': dependencies.useStoryInteraction,
    '../lib/storyLanguage': dependencies.storyLanguage,
    '../lib/storyPreferences': dependencies.storyPreferences
  }
  new Function('module', 'exports', 'require', 'window', compile(file))(
    module, module.exports, id => {
      if (!(id in requires)) throw new Error(`Unexpected dependency: ${id}`)
      return requires[id]
    }, browser
  )
  const render = () => {
    cursor = 0
    return module.exports.default()
  }
  const flushEffects = () => {
    render()
    mounted = true
    effects.splice(0).forEach(effect => effect())
    return render()
  }
  return { render, flushEffects, states }
}

function nodes(tree) {
  if (tree == null || typeof tree === 'boolean') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
}

function text(tree) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (Array.isArray(tree)) return tree.map(text).join(' ')
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  return text(tree.props?.children)
}
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && text(node).trim() === label)
const entry = (id, updatedAt, complete = false) => ({
  kind: 'personal', id, updatedAt,
  story: {
    id, title: `Story ${id}`, currentStep: 1, scenes: [{}, {}, {}],
    responses: complete ? ['one', 'two', 'three'] : ['one']
  }
})

function homeLibrary(entries, error = null, selectionError = false) {
  const selected = []
  const assigned = []
  const browser = {
    location: { assign: value => assigned.push(value) },
    addEventListener() {}, removeEventListener() {}
  }
  const component = mount('src/pages/index.tsx', {
    storyLibrary: {
      loadStoryLibrary: () => ({ library: { entries }, error }),
      selectPersonalStory: id => {
        if (selectionError) throw new Error('Saved story could not be selected.')
        selected.push(id)
      }
    }
  }, browser)
  return { ...component, selected, assigned }
}

function personalTouches(preferences, profile) {
  const values = new Map()
  const writes = []
  const browser = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { writes.push([key, value]) },
      removeItem: key => values.delete(key)
    }
  }
  const component = mount('src/pages/myself.tsx', {
    profile: {
      loadMuseProfile: () => profile,
      saveMuseProfile: about => ({ about, keypoints: [about], updatedAt: new Date().toISOString() })
    },
    useStoryInteraction: { useStoryInteraction: () => ({
      cancelRecording() {}, dictate() {}, stopRecording() {}, recordingTarget: '', ready: true, error: ''
    }) },
    storyLanguage: plain('src/lib/storyLanguage.ts'),
    storyPreferences: { loadStoryPreferences: () => {
      if (preferences instanceof Error) throw preferences
      return preferences
    } }
  }, browser)
  return { ...component, writes }
}

function main() {
  {
    const ui = homeLibrary([
      entry('older-active', '2026-10-15T00:00:00.000Z'),
      entry('newer-active', '2026-10-16T00:00:00.000Z'),
      entry('completed', '2026-10-17T00:00:00.000Z', true)
    ])
    const tree = ui.flushEffects()
    assert.ok(text(tree).includes('Story newer-active'))
    assert.ok(text(tree).includes('Scene 2 of 3'))
    assert.equal(button(tree, 'Continue story').props.type, 'button')
    button(tree, 'Continue story').props.onClick()
    assert.deepEqual(ui.selected, ['newer-active'])
    assert.deepEqual(ui.assigned, ['/story'])
    assert.ok(nodes(tree).some(node => node.type === 'Link' && node.props.href === '/story?new=1'))
  }
  {
    const ui = homeLibrary([entry('finished', '2026-10-17T00:00:00.000Z', true)])
    const tree = ui.flushEffects()
    assert.ok(text(tree).includes('Your latest completed story'))
    button(tree, 'Read again').props.onClick()
    assert.deepEqual(ui.selected, ['finished'])
    assert.deepEqual(ui.assigned, ['/story'])
  }
  {
    const ui = homeLibrary([], 'Browser storage is unavailable.')
    const tree = ui.flushEffects()
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && text(node).includes('Browser storage is unavailable.')))
    assert.ok(!nodes(tree).some(node => node.type === 'button' && text(node).includes('Continue story')))
  }
  {
    const ui = homeLibrary([entry('unavailable', '2026-10-17T00:00:00.000Z')], null, true)
    let tree = ui.flushEffects()
    button(tree, 'Continue story').props.onClick()
    tree = ui.render()
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && text(node).includes('Saved story could not be selected.')))
    assert.deepEqual(ui.assigned, [])
  }
  {
    const ui = personalTouches({ language: 'ar-SA', duration: 10 }, {
      about: 'I love gardens.', keypoints: ['I love gardens.'], updatedAt: '2026-10-17T00:00:00.000Z'
    })
    const tree = ui.flushEffects()
    assert.ok(nodes(tree).some(node => node.type === 'h1' && text(node) === 'Myself'))
    assert.equal(nodes(tree).find(node => node.type === 'textarea').props.value, 'I love gardens.')
    assert.ok(text(tree).includes('Your memories'), 'Myself keeps memory management available')
    assert.equal(nodes(tree).find(node => node.type === 'select' && node.props['aria-label'] === 'Personal touches voice language').props.value, 'ar-SA')
    assert.deepEqual(ui.writes, [], 'Reading preferences never writes language or credentials')
  }
  {
    const ui = personalTouches(new Error('Saved story language is not supported.'), null)
    const tree = ui.flushEffects()
    assert.equal(nodes(tree).find(node => node.type === 'select' && node.props['aria-label'] === 'Personal touches voice language').props.value, 'en-US')
    assert.ok(nodes(tree).some(node => node.props.role === 'alert' && text(node).includes('Saved story language is not supported')))
  }
  console.log('6 returning-user Home and personal-touch checks passed')
}

try { main() } catch (error) {
  console.error(error)
  process.exitCode = 1
}
