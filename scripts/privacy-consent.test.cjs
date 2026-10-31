const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.join(__dirname, '..')

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'legalContact.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const legal = {}
new Function('exports', compiled)(legal)

const copySource = fs.readFileSync(path.join(root, 'src', 'lib', 'publicLegalCopy.ts'), 'utf8')
const copyCompiled = ts.transpileModule(copySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const legalCopy = {}
new Function('exports', copyCompiled)(legalCopy)
const englishPublicCopy = legalCopy.publicLegalCopy('en-US')
const allParagraphs = sectionSet => Object.values(sectionSet)
  .flatMap(section => [section.heading, ...section.paragraphs])
  .join(' ')
const privacyDisclosure = [
  englishPublicCopy.privacy.intro,
  allParagraphs(englishPublicCopy.privacy.sections),
  englishPublicCopy.privacy.notReady
].join(' ')
const termsDisclosure = [
  allParagraphs(englishPublicCopy.terms.sections)
].join(' ')
const sampleNarrationByLocale = {
  'en-US': [
    'prerecorded public Google WaveNet audio assets',
    'translated versions use browser or device speech only',
    'No sample story text is sent to Muse cloud text-to-speech.'
  ],
  'it-IT': [
    'file audio pubblici preregistrati di Google WaveNet',
    'le versioni tradotte usano solo la sintesi vocale del browser o del dispositivo',
    'Il testo del campione non viene inviato al servizio di sintesi vocale cloud di Muse.'
  ],
  'es-ES': [
    'archivos de audio públicos pregrabados de Google WaveNet',
    'las versiones traducidas usan solo la voz del navegador o dispositivo',
    'El texto de la muestra no se envía al servicio de texto a voz en la nube de Muse.'
  ],
  'zh-CN': [
    '预先录制的公开 Google WaveNet 音频',
    '翻译版本仅使用浏览器或设备语音',
    '示例故事文本不会发送到 Muse 云端文本转语音服务。'
  ],
  'hi-IN': [
    'पहले से रिकॉर्ड किए गए सार्वजनिक Google WaveNet ऑडियो',
    'अनुवादित संस्करण केवल ब्राउज़र या डिवाइस की वाणी का उपयोग करते हैं',
    'नमूने का कहानी-पाठ Muse के क्लाउड टेक्स्ट-टू-स्पीच को नहीं भेजा जाता।'
  ],
  'uk-UA': [
    'попередньо записані загальнодоступні аудіофайли Google WaveNet',
    'перекладені версії використовують лише мовлення браузера або пристрою',
    'Текст прикладу не надсилається до хмарного перетворення тексту на мовлення Muse.'
  ],
  'ar-SA': [
    'ملفات صوتية عامة مسجلة مسبقاً من Google WaveNet',
    'النسخ المترجمة فتستخدم كلام المتصفح أو الجهاز فقط',
    'لا يُرسل نص القصة التجريبية إلى خدمة تحويل النص إلى كلام السحابية من Muse.'
  ]
}

const checks = [
  ['unchecked and missing consent cannot authorize transmission', () => {
    assert.equal(legal.hasExplicitConsent(false), false)
    assert.equal(legal.hasExplicitConsent(undefined), false)
    assert.equal(legal.hasExplicitConsent('true'), false)
  }],
  ['explicit checked consent authorizes transmission', () => {
    assert.equal(legal.hasExplicitConsent(true), true)
    assert.equal(legal.MUSE_AI_CONSENT_VERSION, '2026-10-18')
  }],
  ['missing public contact settings remain explicitly unconfigured', () => {
    assert.deepEqual(legal.getPublicContactConfig(undefined, ''), {
      operator: { value: null, status: 'missing' },
      supportEmail: { value: null, status: 'missing' }
    })
  }],
  ['operator name is trimmed and rejects unsafe values', () => {
    assert.deepEqual(legal.getPublicContactConfig('  Muse Studio  ', undefined).operator, {
      value: 'Muse Studio',
      status: 'configured'
    })
    assert.equal(legal.getPublicContactConfig('Muse\nStudio', undefined).operator.status, 'invalid')
    assert.equal(legal.getPublicContactConfig('x'.repeat(121), undefined).operator.status, 'invalid')
  }],
  ['support email validation permits normal addresses and rejects malformed values', () => {
    assert.deepEqual(legal.getPublicContactConfig(undefined, ' help+beta@example.co.uk ').supportEmail, {
      value: 'help+beta@example.co.uk',
      status: 'configured'
    })
    for (const email of ['help@example', 'help@@example.com', '.help@example.com', 'help..desk@example.com', 'help@-example.com', 'help@example..com']) {
      assert.equal(legal.getPublicContactConfig(undefined, email).supportEmail.status, 'invalid', email)
    }
  }],
  ['privacy disclosures match first-party operational telemetry and omit page-view collection', () => {
    const app = fs.readFileSync(path.join(root, 'src', 'pages', '_app.tsx'), 'utf8')
    const telemetry = fs.readFileSync(path.join(root, 'src', 'pages', 'api', 'telemetry.ts'), 'utf8')
    const creator = fs.readFileSync(path.join(root, 'src', 'pages', 'creator.tsx'), 'utf8')
    assert.doesNotMatch(app, /site-visit|VisitBeacon/)
    assert.doesNotMatch(telemetry, /site-visit/)
    assert.match(telemetry, /story-created/)
    assert.match(privacyDisclosure, /does not record page views or website visits/)
    assert.match(privacyDisclosure, /fixed event codes/)
    assert.match(privacyDisclosure, /retained for up to seven days/)
    assert.match(privacyDisclosure, /latest five browser memories/)
    assert.match(privacyDisclosure, /explicit consent/)
    assert.match(privacyDisclosure, /readable, unencrypted text/)
    assert.match(privacyDisclosure, /random browser-session capability/)
    assert.match(privacyDisclosure, /up to 10 minutes/)
    assert.match(privacyDisclosure, /Google Cloud Text-to-Speech or ElevenLabs/)
    assert.match(privacyDisclosure, /up to 30 days/)
    assert.match(privacyDisclosure, /60 seconds and 5 MB/)
    assert.match(privacyDisclosure, /120 general requests per minute/)
    assert.match(privacyDisclosure, /20 failed creator-code attempts per 10 minutes/)
    assert.match(privacyDisclosure, /5 error-report requests per minute/)
    assert.match(termsDisclosure, /collects no page-view or website-visit analytics/)
    assert.match(termsDisclosure, /not legal approval or a certified legal agreement/)
    assert.match(termsDisclosure, /age and consent are self-declared/i)
    assert.match(termsDisclosure, /no full-backup or media-recovery guarantee/i)
    assert.doesNotMatch(creator, /bonomistefano@outlook\.it/)
  }],
  ['sample narration disclosure distinguishes English audio from translated speech in every locale', () => {
    const locales = ['en-US', 'it-IT', 'es-ES', 'zh-CN', 'hi-IN', 'uk-UA', 'ar-SA']
    for (const locale of locales) {
      const browserSection = legalCopy.publicLegalCopy(locale).privacy.sections.browser
      const sampleParagraph = browserSection.paragraphs.at(-1)
      const [englishAudio, translatedSpeech, cloudTtsExclusion] = sampleNarrationByLocale[locale]
      assert.ok(sampleParagraph.includes(englishAudio), `${locale} identifies the English prerecorded audio`)
      assert.ok(sampleParagraph.includes(translatedSpeech), `${locale} limits translated samples to browser/device speech`)
      assert.ok(sampleParagraph.includes(cloudTtsExclusion), `${locale} excludes sample text from Muse cloud TTS`)
    }
  }],
  ['operations readiness blocks launch until account authentication is configured', () => {
    const operations = fs.readFileSync(path.join(root, 'src', 'lib', 'operations.ts'), 'utf8')
    assert.match(operations, /Supabase account authentication is not configured/)
    assert.match(fs.readFileSync(path.join(root, 'src', 'lib', 'accountAuth.ts'), 'utf8'), /requireAccount/)
  }]
]

for (const [name, run] of checks) {
  run()
  console.log(`PASS ${name}`)
}
