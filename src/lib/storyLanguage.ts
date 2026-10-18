/** Explicit story languages; independent of the application's interface locale. */
export const STORY_LANGUAGES = [
  { code: 'en-US', label: 'English', dir: 'ltr' },
  { code: 'zh-CN', label: 'Mandarin Chinese · 简体中文', dir: 'ltr' },
  { code: 'hi-IN', label: 'Hindi · हिन्दी', dir: 'ltr' },
  { code: 'es-ES', label: 'Spanish · Español', dir: 'ltr' },
  { code: 'ar-SA', label: 'Arabic · العربية', dir: 'rtl' }
] as const

export type StoryLanguageCode = typeof STORY_LANGUAGES[number]['code']

export function storyLanguage(code?: StoryLanguageCode) {
  return STORY_LANGUAGES.find(language => language.code === code) ?? STORY_LANGUAGES[0]
}

export function parseStoryLanguage(value: unknown): StoryLanguageCode | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !STORY_LANGUAGES.some(language => language.code === value)) {
    throw new Error('Choose a supported story language.')
  }
  return value as StoryLanguageCode
}

export function storyLanguageInstruction(code?: StoryLanguageCode): string {
  return code ? `The authoritative story language is ${storyLanguage(code).label} (${code}). Write every generated title, description, narration, clue, question, choice, hint and state metadata value in this language, regardless of the language of input or later actions. Keep JSON property names unchanged. Return narrationLanguage exactly "${code}".${code === 'zh-CN' ? ' For all requested word limits, count each Han character as one unit and other space-separated words as one unit.' : ''}` : ''
}

export function storyWordCount(text: string, code?: StoryLanguageCode): number {
  if (code !== 'zh-CN') return text.split(/\s+/).length
  const han = text.match(/\p{Script=Han}/gu) ?? []
  const other = text.replace(/\p{Script=Han}|[\p{P}\p{S}]/gu, ' ').trim()
  return han.length + (other ? other.split(/\s+/).length : 0)
}

export function assertStoryNarrationLanguage(value: unknown, code?: StoryLanguageCode): void {
  if (code && value !== code) throw new Error(`The AI response did not use the selected story language (${code}).`)
}

const english = {
  gift: 'A gift story for you', openGift: 'Open your gift story', openingGift: 'Opening your gift story…',
  from: 'From', for: 'For', read: 'Read', listen: 'Listen', pause: 'Pause', resume: 'Resume',
  stop: 'Stop', guess: 'Your answer', submitGuess: 'Try answer', next: 'Next',
  hints: 'Hints', hint: 'Get a hint', skip: 'Reveal message', reply: 'Reply',
  sendReply: 'Send reply', replyPlaceholder: 'Write a thank-you…', replySent: 'Reply sent',
  start: 'Begin story', continue: 'Continue', back: 'Back', close: 'Close',
  loading: 'Loading…', scene: 'Scene', discoveries: 'Discoveries', inventory: 'Inventory',
  relationships: 'Relationships', progress: 'Progress', action: 'What do you do?',
  actionPlaceholder: 'Describe your next action…', sendAction: 'Continue adventure',
  solved: 'You solved it!', revealed: 'Your message', playVoice: 'Play voice message',
  voiceMessage: 'Voice message', finalAnswer: 'Final answer', answerPlaceholder: 'Type your answer…',
  hintsRemaining: 'Hints remaining', actionsRemaining: 'Actions remaining',
  dedication: 'Dedication', keepsake: 'Save keepsake', reportProblem: 'Report a problem',
  narrationUnavailable: 'A voice for this language may not be installed on your device.'
}
type RecipientLabels = { [Key in keyof typeof english]: string }
const copies: Record<StoryLanguageCode, RecipientLabels> = {
  'en-US': english,
  'zh-CN': {
    gift: '送给你的故事', openGift: '打开礼物', openingGift: '正在打开礼物…',
    from: '来自', for: '送给', read: '阅读', listen: '聆听', pause: '暂停', resume: '继续',
    stop: '停止', guess: '你的答案', submitGuess: '提交答案', next: '下一步',
    hints: '提示', hint: '获取提示', skip: '揭晓留言', reply: '回复',
    sendReply: '发送回复', replyPlaceholder: '写下感谢的话…', replySent: '回复已发送',
    start: '开始故事', continue: '继续', back: '返回', close: '关闭',
    loading: '加载中…', scene: '场景', discoveries: '发现', inventory: '物品',
    relationships: '关系', progress: '进展', action: '你会怎么做？',
    actionPlaceholder: '描述你的下一步行动…', sendAction: '继续冒险',
    solved: '你解开了谜题！', revealed: '给你的留言', playVoice: '播放语音留言',
    voiceMessage: '语音留言', finalAnswer: '最终答案', answerPlaceholder: '输入你的答案…',
    hintsRemaining: '剩余提示', actionsRemaining: '剩余行动',
    dedication: '赠言', keepsake: '保存纪念', reportProblem: '报告问题',
    narrationUnavailable: '你的设备可能尚未安装此语言的语音。'
  },
  'hi-IN': {
    gift: 'आपके लिए एक कहानी', openGift: 'अपना उपहार खोलें', openingGift: 'उपहार खुल रहा है…',
    from: 'की ओर से', for: 'के लिए', read: 'पढ़ें', listen: 'सुनें', pause: 'रोकें', resume: 'फिर शुरू करें',
    stop: 'बंद करें', guess: 'आपका उत्तर', submitGuess: 'उत्तर दें', next: 'अगला',
    hints: 'संकेत', hint: 'संकेत लें', skip: 'संदेश दिखाएँ', reply: 'जवाब दें',
    sendReply: 'जवाब भेजें', replyPlaceholder: 'धन्यवाद लिखें…', replySent: 'जवाब भेज दिया गया',
    start: 'कहानी शुरू करें', continue: 'जारी रखें', back: 'वापस', close: 'बंद करें',
    loading: 'लोड हो रहा है…', scene: 'दृश्य', discoveries: 'खोजें', inventory: 'वस्तुएँ',
    relationships: 'रिश्ते', progress: 'प्रगति', action: 'आप क्या करते हैं?',
    actionPlaceholder: 'अपना अगला कदम बताएँ…', sendAction: 'रोमांच जारी रखें',
    solved: 'आपने पहेली सुलझा ली!', revealed: 'आपका संदेश', playVoice: 'आवाज़ वाला संदेश सुनें',
    voiceMessage: 'आवाज़ वाला संदेश', finalAnswer: 'अंतिम उत्तर', answerPlaceholder: 'अपना उत्तर लिखें…',
    hintsRemaining: 'बाकी संकेत', actionsRemaining: 'बाकी कदम',
    dedication: 'समर्पण', keepsake: 'यादगार सहेजें', reportProblem: 'समस्या बताएँ',
    narrationUnavailable: 'आपके उपकरण पर इस भाषा की आवाज़ शायद उपलब्ध न हो।'
  },
  'es-ES': {
    gift: 'Una historia para ti', openGift: 'Abre tu regalo', openingGift: 'Abriendo tu regalo…',
    from: 'De', for: 'Para', read: 'Leer', listen: 'Escuchar', pause: 'Pausar', resume: 'Reanudar',
    stop: 'Detener', guess: 'Tu respuesta', submitGuess: 'Probar respuesta', next: 'Siguiente',
    hints: 'Pistas', hint: 'Pedir una pista', skip: 'Revelar mensaje', reply: 'Responder',
    sendReply: 'Enviar respuesta', replyPlaceholder: 'Escribe un agradecimiento…', replySent: 'Respuesta enviada',
    start: 'Empezar historia', continue: 'Continuar', back: 'Volver', close: 'Cerrar',
    loading: 'Cargando…', scene: 'Escena', discoveries: 'Descubrimientos', inventory: 'Inventario',
    relationships: 'Relaciones', progress: 'Progreso', action: '¿Qué haces?',
    actionPlaceholder: 'Describe tu siguiente acción…', sendAction: 'Continuar aventura',
    solved: '¡Lo has resuelto!', revealed: 'Tu mensaje', playVoice: 'Reproducir mensaje de voz',
    voiceMessage: 'Mensaje de voz', finalAnswer: 'Respuesta final', answerPlaceholder: 'Escribe tu respuesta…',
    hintsRemaining: 'Pistas restantes', actionsRemaining: 'Acciones restantes',
    dedication: 'Dedicatoria', keepsake: 'Guardar recuerdo', reportProblem: 'Informar de un problema',
    narrationUnavailable: 'Puede que tu dispositivo no tenga instalada una voz para este idioma.'
  },
  'ar-SA': {
    gift: 'قصة من أجلك', openGift: 'افتح هديتك', openingGift: 'جارٍ فتح هديتك…',
    from: 'من', for: 'إلى', read: 'اقرأ', listen: 'استمع', pause: 'إيقاف مؤقت', resume: 'استئناف',
    stop: 'إيقاف', guess: 'إجابتك', submitGuess: 'جرّب الإجابة', next: 'التالي',
    hints: 'تلميحات', hint: 'اطلب تلميحًا', skip: 'اكشف الرسالة', reply: 'رد',
    sendReply: 'أرسل الرد', replyPlaceholder: 'اكتب كلمة شكر…', replySent: 'تم إرسال الرد',
    start: 'ابدأ القصة', continue: 'متابعة', back: 'رجوع', close: 'إغلاق',
    loading: 'جارٍ التحميل…', scene: 'المشهد', discoveries: 'الاكتشافات', inventory: 'الأغراض',
    relationships: 'العلاقات', progress: 'التقدم', action: 'ماذا تفعل؟',
    actionPlaceholder: 'صِف خطوتك التالية…', sendAction: 'تابع المغامرة',
    solved: 'لقد حللت اللغز!', revealed: 'رسالتك', playVoice: 'شغّل الرسالة الصوتية',
    voiceMessage: 'رسالة صوتية', finalAnswer: 'الإجابة النهائية', answerPlaceholder: 'اكتب إجابتك…',
    hintsRemaining: 'التلميحات المتبقية', actionsRemaining: 'الخطوات المتبقية',
    dedication: 'إهداء', keepsake: 'احفظ التذكار', reportProblem: 'أبلغ عن مشكلة',
    narrationUnavailable: 'قد لا يكون صوت لهذه اللغة مثبتًا على جهازك.'
  }
}

const extraEnglish = {
  surprise: 'Your surprise', playMessage: 'Listen to your message',
  skipConfirm: 'Reveal the message without solving? You can still read the story.',
  madeForYou: 'Made just for you', forYou: 'For {name}', from: 'From {name}',
  duration: 'About {minutes} minutes', openStory: 'Open your story', noAccount: 'No account needed.',
  storyFrom: 'A story from {creator} for {recipient}', tapPlay: 'Tap play when you are ready to listen.',
  skipped: 'Your message is ready.', voiceTitle: 'A voice message for you',
  reloadVoice: 'Reload voice message', loadVoice: 'Load voice message',
  replyPrivacy: 'Your reply is shared privately with {name}.', replyLabel: 'Your reply',
  updateReply: 'Update reply', makeStory: 'Make a story for someone',
  scene: 'Scene {number} of {total}', clue: 'Clue', playScene: 'Listen to this scene',
  tryAnswer: 'Try your answer', earlier: 'Earlier clues', answer: 'Your final answer',
  guessHelp: 'Use the clues to find the exact answer.', skipHelp: 'You may reveal the message without solving.',
  solveHelp: 'Solve the puzzle to reveal the message.', needHelp: 'Need a little help?',
  pauseHelp: 'Take your time. There is no countdown.', hintTitle: 'Hints',
  showHint: 'Show a hint', hintRemaining: '{count} left', conclusion: 'The conclusion'
}
type ExtraLabels = { [Key in keyof typeof extraEnglish]: string }
const extraCopies: Record<StoryLanguageCode, ExtraLabels> = {
  'en-US': extraEnglish,
  'zh-CN': {
    surprise: '给你的惊喜', playMessage: '聆听留言', skipConfirm: '不解谜就揭晓留言吗？你仍然可以阅读故事。',
    madeForYou: '专为你创作', forYou: '送给{name}', from: '来自{name}', duration: '约{minutes}分钟',
    openStory: '打开你的故事', noAccount: '无需注册账号。', storyFrom: '{creator}送给{recipient}的故事',
    tapPlay: '准备好后，点击播放即可聆听。', skipped: '你的留言已揭晓。', voiceTitle: '给你的语音留言',
    reloadVoice: '重新加载语音留言', loadVoice: '加载语音留言', replyPrivacy: '你的回复将私密地发送给{name}。',
    replyLabel: '你的回复', updateReply: '更新回复', makeStory: '为某人创作故事', scene: '第{number}幕，共{total}幕',
    clue: '线索', playScene: '聆听这一幕', tryAnswer: '提交你的答案', earlier: '之前的线索', answer: '你的最终答案',
    guessHelp: '根据线索找出准确答案。', skipHelp: '你可以不解谜就揭晓留言。', solveHelp: '解开谜题即可揭晓留言。',
    needHelp: '需要一点帮助吗？', pauseHelp: '慢慢来，没有倒计时。', hintTitle: '提示', showHint: '显示提示',
    hintRemaining: '剩余{count}条', conclusion: '结局'
  },
  'hi-IN': {
    surprise: 'आपका सरप्राइज़', playMessage: 'अपना संदेश सुनें', skipConfirm: 'बिना पहेली सुलझाए संदेश दिखाएँ? आप कहानी फिर भी पढ़ सकते हैं।',
    madeForYou: 'खास आपके लिए', forYou: '{name} के लिए', from: '{name} की ओर से', duration: 'लगभग {minutes} मिनट',
    openStory: 'अपनी कहानी खोलें', noAccount: 'खाते की ज़रूरत नहीं।', storyFrom: '{creator} की ओर से {recipient} के लिए एक कहानी',
    tapPlay: 'सुनने के लिए तैयार हों तो प्ले दबाएँ।', skipped: 'आपका संदेश तैयार है।', voiceTitle: 'आपके लिए एक आवाज़ वाला संदेश',
    reloadVoice: 'आवाज़ वाला संदेश फिर लोड करें', loadVoice: 'आवाज़ वाला संदेश लोड करें', replyPrivacy: 'आपका जवाब निजी रूप से {name} के साथ साझा होगा।',
    replyLabel: 'आपका जवाब', updateReply: 'जवाब बदलें', makeStory: 'किसी के लिए कहानी बनाएँ', scene: 'दृश्य {number}, कुल {total}',
    clue: 'सुराग', playScene: 'यह दृश्य सुनें', tryAnswer: 'अपना उत्तर आज़माएँ', earlier: 'पिछले सुराग', answer: 'आपका अंतिम उत्तर',
    guessHelp: 'सुरागों से सही उत्तर खोजें।', skipHelp: 'आप बिना पहेली सुलझाए संदेश देख सकते हैं।', solveHelp: 'संदेश देखने के लिए पहेली सुलझाएँ।',
    needHelp: 'थोड़ी मदद चाहिए?', pauseHelp: 'आराम से आगे बढ़ें। कोई उलटी गिनती नहीं है।', hintTitle: 'संकेत', showHint: 'संकेत दिखाएँ',
    hintRemaining: '{count} बाकी', conclusion: 'समापन'
  },
  'es-ES': {
    surprise: 'Tu sorpresa', playMessage: 'Escuchar tu mensaje', skipConfirm: '¿Revelar el mensaje sin resolverlo? Podrás seguir leyendo la historia.',
    madeForYou: 'Hecha solo para ti', forYou: 'Para {name}', from: 'De {name}', duration: 'Unos {minutes} minutos',
    openStory: 'Abre tu historia', noAccount: 'No necesitas una cuenta.', storyFrom: 'Una historia de {creator} para {recipient}',
    tapPlay: 'Pulsa reproducir cuando quieras escuchar.', skipped: 'Tu mensaje está listo.', voiceTitle: 'Un mensaje de voz para ti',
    reloadVoice: 'Volver a cargar el mensaje de voz', loadVoice: 'Cargar mensaje de voz', replyPrivacy: 'Tu respuesta se comparte en privado con {name}.',
    replyLabel: 'Tu respuesta', updateReply: 'Actualizar respuesta', makeStory: 'Crea una historia para alguien', scene: 'Escena {number} de {total}',
    clue: 'Pista', playScene: 'Escuchar esta escena', tryAnswer: 'Probar tu respuesta', earlier: 'Pistas anteriores', answer: 'Tu respuesta final',
    guessHelp: 'Usa las pistas para encontrar la respuesta exacta.', skipHelp: 'Puedes revelar el mensaje sin resolver el misterio.', solveHelp: 'Resuelve el misterio para revelar el mensaje.',
    needHelp: '¿Necesitas un poco de ayuda?', pauseHelp: 'Tómate tu tiempo. No hay cuenta atrás.', hintTitle: 'Pistas', showHint: 'Mostrar una pista',
    hintRemaining: 'Quedan {count}', conclusion: 'El desenlace'
  },
  'ar-SA': {
    surprise: 'مفاجأتك', playMessage: 'استمع إلى رسالتك', skipConfirm: 'هل تريد كشف الرسالة دون حل اللغز؟ يمكنك متابعة قراءة القصة.',
    madeForYou: 'صُنعت خصيصًا لك', forYou: 'إلى {name}', from: 'من {name}', duration: 'حوالي {minutes} دقيقة',
    openStory: 'افتح قصتك', noAccount: 'لا حاجة إلى حساب.', storyFrom: 'قصة من {creator} إلى {recipient}',
    tapPlay: 'اضغط التشغيل عندما تكون مستعدًا للاستماع.', skipped: 'رسالتك جاهزة.', voiceTitle: 'رسالة صوتية من أجلك',
    reloadVoice: 'أعد تحميل الرسالة الصوتية', loadVoice: 'حمّل الرسالة الصوتية', replyPrivacy: 'ستتم مشاركة ردك بشكل خاص مع {name}.',
    replyLabel: 'ردك', updateReply: 'حدّث الرد', makeStory: 'اصنع قصة لشخص ما', scene: 'المشهد {number} من {total}',
    clue: 'دليل', playScene: 'استمع إلى هذا المشهد', tryAnswer: 'جرّب إجابتك', earlier: 'الأدلة السابقة', answer: 'إجابتك النهائية',
    guessHelp: 'استخدم الأدلة للوصول إلى الإجابة الدقيقة.', skipHelp: 'يمكنك كشف الرسالة دون حل اللغز.', solveHelp: 'حل اللغز لكشف الرسالة.',
    needHelp: 'هل تحتاج إلى بعض المساعدة؟', pauseHelp: 'خذ وقتك. لا يوجد عد تنازلي.', hintTitle: 'تلميحات', showHint: 'اعرض تلميحًا',
    hintRemaining: '{count} متبقية', conclusion: 'الخاتمة'
  }
}
type FormattedCopyKeys = 'forYou' | 'from' | 'duration' | 'storyFrom' | 'replyPrivacy' | 'scene' | 'hintRemaining'
const adventureEnglish = {
  adventureContinues: 'Your adventure continues', yourJourney: 'Your journey',
  playAdventure: 'Listen to the adventure', submitAction: 'Submit action (uses one attempt)',
  refreshAdventure: 'Refresh adventure progress', pendingAction: 'Processing. Disconnected attempts expire within 90 seconds without a refund.',
  retrySubmission: 'Retry same submission / check status',
  actionLimit: 'Action limit reached. Use hints or try the final answer. You can still listen.',
  actionCost: 'Each action uses one attempt, even if it fails. Guesses, hints and browser audio use none.',
  actionConsent: 'I understand this action is sent to Muse’s configured AI provider to generate the next turn, and the shared story is kept on Muse’s server until deleted, with no automatic expiry.',
  loadingStory: 'Opening your private story…', working: 'Working…', noHints: 'The sender has not added any hints.',
  allHints: 'All available hints have been revealed.', hintHelp: 'Hints use no guesses and do not advance the story.',
  reviewAnswer: 'Review before sending. Up to 30 guesses.', dictateAnswer: 'Dictate your answer',
  stopDictation: 'Stop dictation', listening: 'Listening — speak now.', startingMicrophone: 'Starting microphone — please wait.',
  requestError: 'This request could not complete. Check your connection and try again.',
  actionError: 'This attempt could not complete. Refresh progress before submitting again; no automatic retry is made.',
  voiceError: 'The voice message could not play. Reload it or try your device browser.',
  settingsDisclosure: 'Optional settings and privacy information are currently shown in English.',
  actionsLeft: 'Actions left', sharedBudget: 'Shared AI budget',
  helpContact: 'Revisit earlier clues or contact the sender using the conversation where they sent your link. Muse does not send messages to the sender.'
}
type AdventureLabels = { [Key in keyof typeof adventureEnglish]: string }
const adventureCopies: Record<StoryLanguageCode, AdventureLabels> = {
  'en-US': adventureEnglish,
  'zh-CN': {
    adventureContinues: '你的冒险仍在继续', yourJourney: '你的旅程', playAdventure: '聆听冒险故事',
    submitAction: '提交行动（使用一次机会）', refreshAdventure: '刷新冒险进度',
    pendingAction: '正在处理。断线的尝试将在90秒内过期，且不退还机会。', retrySubmission: '重试同一次提交／查看状态',
    actionLimit: '行动次数已用完。请使用提示或尝试最终答案。你仍然可以聆听。',
    actionCost: '每次行动都会使用一次机会，即使失败也是如此。猜答案、提示和浏览器语音不使用机会。',
    actionConsent: '我理解此行动将发送给Muse配置的AI提供商以生成下一幕，共享故事将保存在Muse服务器上，直到被删除，不会自动过期。',
    loadingStory: '正在打开你的私人故事…', working: '正在处理…', noHints: '发送者尚未添加提示。',
    allHints: '所有可用提示均已显示。', hintHelp: '提示不占用猜测次数，也不会推进故事。',
    reviewAnswer: '发送前请检查。最多可猜30次。', dictateAnswer: '口述答案', stopDictation: '停止听写',
    listening: '正在聆听，请开始说话。', startingMicrophone: '正在启动麦克风，请稍候。',
    requestError: '请求未能完成。请检查网络连接后重试。',
    actionError: '此次尝试未能完成。再次提交前请刷新进度；系统不会自动重试。',
    voiceError: '语音留言无法播放。请重新加载或尝试使用设备浏览器。',
    settingsDisclosure: '可选设置和隐私信息目前以英语显示。', actionsLeft: '剩余行动', sharedBudget: '共享AI额度',
    helpContact: '请回顾之前的线索，或通过发送链接的对话联系发送者。Muse不会向发送者发送消息。'
  },
  'hi-IN': {
    adventureContinues: 'आपका रोमांच जारी है', yourJourney: 'आपकी यात्रा', playAdventure: 'रोमांच की कहानी सुनें',
    submitAction: 'कदम भेजें (एक अवसर लगेगा)', refreshAdventure: 'यात्रा की प्रगति फिर देखें',
    pendingAction: 'प्रक्रिया जारी है। संपर्क टूटने पर प्रयास 90 सेकंड में समाप्त हो जाएगा और अवसर वापस नहीं मिलेगा।',
    retrySubmission: 'वही प्रयास फिर भेजें / स्थिति देखें',
    actionLimit: 'कदमों की सीमा पूरी हो गई। संकेत लें या अंतिम उत्तर दें। आप अब भी सुन सकते हैं।',
    actionCost: 'हर कदम पर एक अवसर लगता है, असफल होने पर भी। उत्तर, संकेत और ब्राउज़र की आवाज़ पर अवसर नहीं लगता।',
    actionConsent: 'मैं समझता/समझती हूँ कि अगला भाग बनाने के लिए यह कदम Muse के चुने हुए AI प्रदाता को भेजा जाएगा और साझा कहानी हटाए जाने तक Muse के सर्वर पर रखी जाएगी, बिना अपने आप समाप्त हुए।',
    loadingStory: 'आपकी निजी कहानी खुल रही है…', working: 'काम जारी है…', noHints: 'भेजने वाले ने कोई संकेत नहीं जोड़ा है।',
    allHints: 'सभी उपलब्ध संकेत दिखा दिए गए हैं।', hintHelp: 'संकेत लेने से उत्तर के प्रयास कम नहीं होते और कहानी आगे नहीं बढ़ती।',
    reviewAnswer: 'भेजने से पहले जाँच लें। अधिकतम 30 उत्तर आज़मा सकते हैं।', dictateAnswer: 'अपना उत्तर बोलें',
    stopDictation: 'बोलकर लिखना रोकें', listening: 'सुन रहे हैं — अब बोलें।', startingMicrophone: 'माइक्रोफ़ोन शुरू हो रहा है — कृपया रुकें।',
    requestError: 'यह अनुरोध पूरा नहीं हो सका। अपना कनेक्शन जाँचकर फिर कोशिश करें।',
    actionError: 'यह प्रयास पूरा नहीं हो सका। फिर भेजने से पहले प्रगति जाँचें; अपने आप दोबारा प्रयास नहीं किया जाएगा।',
    voiceError: 'आवाज़ वाला संदेश नहीं चल सका। फिर लोड करें या उपकरण के ब्राउज़र में कोशिश करें।',
    settingsDisclosure: 'वैकल्पिक सेटिंग और गोपनीयता जानकारी अभी अंग्रेज़ी में दिखाई जाती है।',
    actionsLeft: 'बाकी कदम', sharedBudget: 'साझा AI सीमा',
    helpContact: 'पिछले सुराग देखें या उसी बातचीत में भेजने वाले से संपर्क करें जिसमें लिंक मिला था। Muse भेजने वाले को संदेश नहीं भेजता।'
  },
  'es-ES': {
    adventureContinues: 'Tu aventura continúa', yourJourney: 'Tu viaje', playAdventure: 'Escuchar la aventura',
    submitAction: 'Enviar acción (usa un intento)', refreshAdventure: 'Actualizar progreso de la aventura',
    pendingAction: 'Procesando. Los intentos desconectados caducan en 90 segundos sin devolución.',
    retrySubmission: 'Reenviar el mismo intento / consultar estado',
    actionLimit: 'Se ha alcanzado el límite de acciones. Usa pistas o prueba la respuesta final. Puedes seguir escuchando.',
    actionCost: 'Cada acción usa un intento, aunque falle. Las respuestas, pistas y el audio del navegador no usan ninguno.',
    actionConsent: 'Entiendo que esta acción se envía al proveedor de IA configurado por Muse para generar el siguiente turno, y que la historia compartida se guarda en el servidor de Muse hasta que se elimine, sin caducidad automática.',
    loadingStory: 'Abriendo tu historia privada…', working: 'Procesando…', noHints: 'La persona que te la envió no ha añadido pistas.',
    allHints: 'Ya se han mostrado todas las pistas disponibles.', hintHelp: 'Las pistas no consumen respuestas ni hacen avanzar la historia.',
    reviewAnswer: 'Revisa antes de enviar. Hasta 30 respuestas.', dictateAnswer: 'Dictar tu respuesta',
    stopDictation: 'Detener dictado', listening: 'Escuchando: habla ahora.', startingMicrophone: 'Iniciando micrófono: espera un momento.',
    requestError: 'No se pudo completar la solicitud. Comprueba tu conexión y vuelve a intentarlo.',
    actionError: 'No se pudo completar este intento. Actualiza el progreso antes de volver a enviar; no hay reintentos automáticos.',
    voiceError: 'No se pudo reproducir el mensaje de voz. Vuelve a cargarlo o prueba el navegador de tu dispositivo.',
    settingsDisclosure: 'Los ajustes opcionales y la información de privacidad se muestran actualmente en inglés.',
    actionsLeft: 'Acciones restantes', sharedBudget: 'Presupuesto compartido de IA',
    helpContact: 'Revisa las pistas anteriores o contacta con quien te envió el enlace en la misma conversación. Muse no envía mensajes al remitente.'
  },
  'ar-SA': {
    adventureContinues: 'مغامرتك مستمرة', yourJourney: 'رحلتك', playAdventure: 'استمع إلى المغامرة',
    submitAction: 'أرسل الخطوة (تستخدم محاولة واحدة)', refreshAdventure: 'حدّث تقدم المغامرة',
    pendingAction: 'جارٍ المعالجة. تنتهي المحاولات المنقطعة خلال 90 ثانية دون استعادة المحاولة.',
    retrySubmission: 'أعد إرسال نفس المحاولة / تحقق من الحالة',
    actionLimit: 'بلغت حد الخطوات. استخدم التلميحات أو جرّب الإجابة النهائية. لا يزال بإمكانك الاستماع.',
    actionCost: 'تستخدم كل خطوة محاولة واحدة حتى إن فشلت. الإجابات والتلميحات وصوت المتصفح لا تستخدم محاولات.',
    actionConsent: 'أفهم أن هذه الخطوة تُرسل إلى مزود الذكاء الاصطناعي الذي يضبطه Muse لإنشاء الدور التالي، وأن القصة المشتركة تُحفظ على خادم Muse حتى حذفها، دون انتهاء صلاحية تلقائي.',
    loadingStory: 'جارٍ فتح قصتك الخاصة…', working: 'جارٍ العمل…', noHints: 'لم يضف المرسل أي تلميحات.',
    allHints: 'تم عرض جميع التلميحات المتاحة.', hintHelp: 'لا تستهلك التلميحات محاولات الإجابة ولا تقدم القصة.',
    reviewAnswer: 'راجع قبل الإرسال. حتى 30 محاولة إجابة.', dictateAnswer: 'أملِ إجابتك', stopDictation: 'أوقف الإملاء',
    listening: 'جارٍ الاستماع — تحدث الآن.', startingMicrophone: 'جارٍ تشغيل الميكروفون — يرجى الانتظار.',
    requestError: 'تعذر إكمال الطلب. تحقق من اتصالك وحاول مجددًا.',
    actionError: 'تعذر إكمال هذه المحاولة. حدّث التقدم قبل الإرسال مجددًا؛ لا توجد إعادة محاولة تلقائية.',
    voiceError: 'تعذر تشغيل الرسالة الصوتية. أعد تحميلها أو جرّب متصفح جهازك.',
    settingsDisclosure: 'تُعرض الإعدادات الاختيارية ومعلومات الخصوصية حاليًا باللغة الإنجليزية.',
    actionsLeft: 'الخطوات المتبقية', sharedBudget: 'حصة الذكاء الاصطناعي المشتركة',
    helpContact: 'راجع الأدلة السابقة أو تواصل مع المرسل في المحادثة التي أرسل فيها الرابط. لا يرسل Muse رسائل إلى المرسل.'
  }
}
const supplementaryEnglish = {
  contactSender: 'Revisit earlier clues or contact {name} in the conversation where they sent your link. Muse does not send messages to the sender.',
  adventureBudget: 'Actions left: {actionsRemaining}/12. Shared AI budget: {budgetRemaining}/{budget}.',
  noBudget: 'The shared AI budget is used up. You can still use hints or try the final answer.',
  revealLoading: 'Loading your surprise…', revealError: 'Your surprise could not be loaded.',
  retry: 'Try again', surprisePhoto: 'The sender’s surprise photo', surpriseVideo: 'The sender’s surprise video',
  feedbackSolved: 'You solved it.', feedbackWrong: 'Not quite. Explore the clues and try again.',
  feedbackSkipped: 'Revealed without solving', dictateAction: 'Dictate action'
}
type SupplementaryLabels = { [Key in keyof typeof supplementaryEnglish]: string }
const supplementaryCopies: Record<StoryLanguageCode, SupplementaryLabels> = {
  'en-US': supplementaryEnglish,
  'zh-CN': {
    contactSender: '请回顾之前的线索，或在收到链接的对话中联系{name}。Muse不会向发送者发送消息。',
    adventureBudget: '剩余行动：{actionsRemaining}/12。共享AI额度：{budgetRemaining}/{budget}。',
    noBudget: '共享AI额度已用完。你仍然可以使用提示或尝试最终答案。',
    revealLoading: '正在加载你的惊喜…', revealError: '你的惊喜无法加载。',
    retry: '重试', surprisePhoto: '发送者准备的惊喜照片', surpriseVideo: '发送者准备的惊喜视频',
    feedbackSolved: '你解开了谜题。', feedbackWrong: '还不对。请探索线索后再试一次。', feedbackSkipped: '已跳过解谜，揭晓留言', dictateAction: '口述行动'
  },
  'hi-IN': {
    contactSender: 'पिछले सुराग देखें या जिस बातचीत में लिंक मिला था, उसमें {name} से संपर्क करें। Muse भेजने वाले को संदेश नहीं भेजता।',
    adventureBudget: 'बाकी कदम: {actionsRemaining}/12। साझा AI सीमा: {budgetRemaining}/{budget}।',
    noBudget: 'साझा AI सीमा पूरी हो गई। आप अब भी संकेत ले सकते हैं या अंतिम उत्तर दे सकते हैं।',
    revealLoading: 'आपका सरप्राइज़ लोड हो रहा है…', revealError: 'आपका सरप्राइज़ लोड नहीं हो सका।',
    retry: 'फिर कोशिश करें', surprisePhoto: 'भेजने वाले की सरप्राइज़ तस्वीर', surpriseVideo: 'भेजने वाले का सरप्राइज़ वीडियो',
    feedbackSolved: 'आपने पहेली सुलझा ली।', feedbackWrong: 'अभी सही नहीं है। सुराग देखें और फिर कोशिश करें।', feedbackSkipped: 'बिना पहेली सुलझाए संदेश दिखाया गया', dictateAction: 'अपना कदम बोलें'
  },
  'es-ES': {
    contactSender: 'Revisa las pistas anteriores o contacta con {name} en la conversación donde te envió el enlace. Muse no envía mensajes al remitente.',
    adventureBudget: 'Acciones restantes: {actionsRemaining}/12. Presupuesto compartido de IA: {budgetRemaining}/{budget}.',
    noBudget: 'Se ha agotado el presupuesto compartido de IA. Aún puedes usar pistas o probar la respuesta final.',
    revealLoading: 'Cargando tu sorpresa…', revealError: 'No se pudo cargar tu sorpresa.',
    retry: 'Volver a intentarlo', surprisePhoto: 'La foto sorpresa del remitente', surpriseVideo: 'El vídeo sorpresa del remitente',
    feedbackSolved: 'Lo has resuelto.', feedbackWrong: 'Todavía no. Explora las pistas y vuelve a intentarlo.', feedbackSkipped: 'Revelado sin resolver el misterio', dictateAction: 'Dictar acción'
  },
  'ar-SA': {
    contactSender: 'راجع الأدلة السابقة أو تواصل مع {name} في المحادثة التي أرسل فيها الرابط. لا يرسل Muse رسائل إلى المرسل.',
    adventureBudget: 'الخطوات المتبقية: {actionsRemaining}/12. حصة الذكاء الاصطناعي المشتركة: {budgetRemaining}/{budget}.',
    noBudget: 'نفدت حصة الذكاء الاصطناعي المشتركة. لا يزال بإمكانك استخدام التلميحات أو تجربة الإجابة النهائية.',
    revealLoading: 'جارٍ تحميل مفاجأتك…', revealError: 'تعذر تحميل مفاجأتك.',
    retry: 'حاول مجددًا', surprisePhoto: 'صورة المرسل المفاجئة', surpriseVideo: 'فيديو المرسل المفاجئ',
    feedbackSolved: 'لقد حللت اللغز.', feedbackWrong: 'ليست الإجابة الصحيحة بعد. استكشف الأدلة وحاول مجددًا.', feedbackSkipped: 'تم الكشف دون حل اللغز', dictateAction: 'أملِ خطوتك'
  }
}
export type RecipientCopy = Omit<RecipientLabels, 'from' | 'scene'> & Omit<ExtraLabels, FormattedCopyKeys> & AdventureLabels & {
  forYou: (name: string) => string
  from: (name: string) => string
  duration: (minutes: number) => string
  storyFrom: (creator: string, recipient: string) => string
  replyPrivacy: (name: string) => string
  scene: (number: number, total: number) => string
  hintRemaining: (count: number) => string
  reviewGuess: string
  contactSender: (name: string) => string
  hintsNoCost: string
  hintsExhausted: string
  adventureStateLabels: { inventory: string; discoveries: string; relationships: string }
  adventureBudget: (actionsRemaining: number, budgetRemaining: number, budget: number) => string
  aiActionConsent: string
  yourAction: string
  continueAdventure: string
  refreshProgress: string
  noActions: string
} & Omit<SupplementaryLabels, 'contactSender' | 'adventureBudget'>

export function recipientCopy(code?: StoryLanguageCode): RecipientCopy {
  const locale = storyLanguage(code).code
  const extra = extraCopies[locale]
  const labels = copies[locale]
  const adventure = adventureCopies[locale]
  const supplementary = supplementaryCopies[locale]
  const format = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (match, key) => values[key] === undefined ? match : String(values[key]))
  return {
    ...labels, ...extra, ...adventure, ...supplementary,
    forYou: name => format(extra.forYou, { name }),
    from: name => format(extra.from, { name }),
    duration: minutes => format(extra.duration, { minutes }),
    storyFrom: (creator, recipient) => format(extra.storyFrom, { creator, recipient }),
    replyPrivacy: name => format(extra.replyPrivacy, { name }),
    scene: (number, total) => format(extra.scene, { number, total }),
    hintRemaining: count => format(extra.hintRemaining, { count }),
    reviewGuess: adventure.reviewAnswer,
    contactSender: name => format(supplementary.contactSender, { name }),
    hintsNoCost: adventure.hintHelp,
    hintsExhausted: adventure.allHints,
    adventureStateLabels: { inventory: labels.inventory, discoveries: labels.discoveries, relationships: labels.relationships },
    adventureBudget: (actionsRemaining, budgetRemaining, budget) => format(supplementary.adventureBudget, { actionsRemaining, budgetRemaining, budget }),
    aiActionConsent: adventure.actionConsent,
    yourAction: labels.action,
    continueAdventure: labels.sendAction,
    refreshProgress: adventure.refreshAdventure,
    noActions: adventure.actionLimit
  }
}
