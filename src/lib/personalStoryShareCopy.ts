import type { StoryLanguageCode } from './storyLanguage'
import type { PersonalStoryMood } from './story'

const english = {
  shareStoryTitle: 'Share your story',
  shareStoryDescription: 'Create a spoiler-free card that celebrates the story you made.',
  shareCardTagline: 'A story shaped around you.',
  shareTextFooter: 'Made with Muse. Create your own story at',
  teaserConsent: 'Let Muse send only this story title and its broad mood to AI to write a short spoiler-free teaser. Scenes, answers, choices, and saved memories are not sent. This uses one AI interaction.',
  createTeaser: 'Create share teaser',
  creatingTeaser: 'Writing your teaser…',
  teaserLabel: 'Spoiler-free teaser',
  shareOnSocial: 'Share with another app',
  copySummary: 'Copy share text',
  downloadCard: 'Download share card',
  shareReady: 'Share card ready.',
  copiedShare: 'Share text copied.',
  shareError: 'Could not complete sharing. You can try downloading the card or copying the text.',
  moodAdventure: 'Adventure',
  moodRelaxed: 'Relaxed',
  moodCurious: 'Curious',
  moodHopeful: 'Hopeful'
} as const

type ShareCopy = Record<keyof typeof english, string>

const copies: Record<StoryLanguageCode, ShareCopy> = {
  'en-US': english,
  'it-IT': {
    shareStoryTitle: 'Condividi la tua storia', shareStoryDescription: 'Crea una scheda senza spoiler per celebrare la storia che hai creato.', shareCardTagline: 'Una storia plasmata intorno a te.', shareTextFooter: 'Creato con Muse. Crea la tua storia su',
    teaserConsent: 'Consenti a Muse di inviare all’IA solo il titolo e l’atmosfera generale della storia per scrivere un breve testo senza spoiler. Scene, risposte, scelte e ricordi salvati non vengono inviati. Usa un’interazione IA.',
    createTeaser: 'Crea il testo da condividere', creatingTeaser: 'Il testo è in preparazione…', teaserLabel: 'Anteprima senza spoiler',
    shareOnSocial: 'Condividi con un’altra app', copySummary: 'Copia il testo', downloadCard: 'Scarica la scheda', shareReady: 'Scheda pronta da condividere.', copiedShare: 'Testo copiato.', shareError: 'Impossibile completare la condivisione. Puoi scaricare la scheda o copiare il testo.',
    moodAdventure: 'Avventura', moodRelaxed: 'Relax', moodCurious: 'Curiosità', moodHopeful: 'Speranza'
  },
  'es-ES': {
    shareStoryTitle: 'Comparte tu historia', shareStoryDescription: 'Crea una tarjeta sin spoilers para celebrar la historia que has creado.', shareCardTagline: 'Una historia hecha a tu medida.', shareTextFooter: 'Creado con Muse. Crea tu propia historia en',
    teaserConsent: 'Permite que Muse envíe a la IA solo el título y el estado de ánimo general para escribir un breve avance sin spoilers. No se envían escenas, respuestas, elecciones ni recuerdos guardados. Usa una interacción de IA.',
    createTeaser: 'Crear avance para compartir', creatingTeaser: 'Preparando el avance…', teaserLabel: 'Avance sin spoilers',
    shareOnSocial: 'Compartir con otra aplicación', copySummary: 'Copiar texto', downloadCard: 'Descargar tarjeta', shareReady: 'Tarjeta lista para compartir.', copiedShare: 'Texto copiado.', shareError: 'No se pudo completar el envío. Puedes descargar la tarjeta o copiar el texto.',
    moodAdventure: 'Aventura', moodRelaxed: 'Relajación', moodCurious: 'Curiosidad', moodHopeful: 'Esperanza'
  },
  'zh-CN': {
    shareStoryTitle: '分享你的故事', shareStoryDescription: '创建一张无剧透卡片，分享你创作的故事。', shareCardTagline: '为你量身打造的故事。', shareTextFooter: '由 Muse 创作。来这里创作你自己的故事：',
    teaserConsent: '允许 Muse 仅将故事标题和大致心情发送给 AI，以撰写简短的无剧透简介。不会发送场景、回答、选择或已保存的回忆。每次使用一项 AI 互动额度。',
    createTeaser: '生成分享简介', creatingTeaser: '正在撰写简介…', teaserLabel: '无剧透简介',
    shareOnSocial: '分享到其他应用', copySummary: '复制分享文字', downloadCard: '下载分享卡片', shareReady: '分享卡片已准备好。', copiedShare: '分享文字已复制。', shareError: '无法完成分享。你可以下载卡片或复制文字。',
    moodAdventure: '冒险', moodRelaxed: '放松', moodCurious: '好奇', moodHopeful: '希望'
  },
  'hi-IN': {
    shareStoryTitle: 'अपनी कहानी साझा करें', shareStoryDescription: 'अपनी बनाई कहानी के लिए बिना स्पॉइलर वाला कार्ड बनाएँ।', shareCardTagline: 'आपके इर्द-गिर्द गढ़ी गई कहानी।', shareTextFooter: 'Muse के साथ बनाई गई। अपनी कहानी यहाँ बनाएँ:',
    teaserConsent: 'Muse को छोटा, बिना स्पॉइलर वाला टीज़र लिखने के लिए केवल कहानी का शीर्षक और सामान्य मनोभाव AI को भेजने दें। दृश्य, उत्तर, विकल्प और सहेजी यादें नहीं भेजी जाएँगी। इसमें एक AI इंटरैक्शन लगेगा।',
    createTeaser: 'साझा करने का टीज़र बनाएँ', creatingTeaser: 'टीज़र लिखा जा रहा है…', teaserLabel: 'बिना स्पॉइलर का टीज़र',
    shareOnSocial: 'दूसरे ऐप में साझा करें', copySummary: 'साझा करने का पाठ कॉपी करें', downloadCard: 'साझा कार्ड डाउनलोड करें', shareReady: 'साझा कार्ड तैयार है।', copiedShare: 'साझा पाठ कॉपी हो गया।', shareError: 'साझा नहीं हो सका। कार्ड डाउनलोड करें या पाठ कॉपी करें।',
    moodAdventure: 'रोमांच', moodRelaxed: 'सुकून', moodCurious: 'जिज्ञासा', moodHopeful: 'आशा'
  },
  'uk-UA': {
    shareStoryTitle: 'Поділіться своєю історією', shareStoryDescription: 'Створіть картку без спойлерів і розкажіть про свою історію.', shareCardTagline: 'Історія, створена навколо вас.', shareTextFooter: 'Створено з Muse. Створіть власну історію тут:',
    teaserConsent: 'Дозвольте Muse надіслати ШІ лише назву історії та загальний настрій, щоб створити короткий анонс без спойлерів. Сцени, відповіді, вибори та збережені спогади не надсилаються. Це використає одну взаємодію ШІ.',
    createTeaser: 'Створити анонс', creatingTeaser: 'Анонс створюється…', teaserLabel: 'Анонс без спойлерів',
    shareOnSocial: 'Поділитися в іншому застосунку', copySummary: 'Копіювати текст', downloadCard: 'Завантажити картку', shareReady: 'Картка готова до поширення.', copiedShare: 'Текст скопійовано.', shareError: 'Не вдалося поділитися. Спробуйте завантажити картку або скопіювати текст.',
    moodAdventure: 'Пригода', moodRelaxed: 'Спокій', moodCurious: 'Цікавість', moodHopeful: 'Надія'
  },
  'ar-SA': {
    shareStoryTitle: 'شارك قصتك', shareStoryDescription: 'أنشئ بطاقة خالية من الحرق للاحتفاء بالقصة التي صنعتها.', shareCardTagline: 'قصة صيغت حولك.', shareTextFooter: 'صُنعت مع Muse. أنشئ قصتك الخاصة هنا:',
    teaserConsent: 'اسمح لـ Muse بإرسال عنوان القصة ومزاجها العام فقط إلى الذكاء الاصطناعي لكتابة نبذة قصيرة خالية من الحرق. لن تُرسل المشاهد أو الإجابات أو الاختيارات أو الذكريات المحفوظة. يستخدم ذلك تفاعلاً واحداً من الذكاء الاصطناعي.',
    createTeaser: 'إنشاء نبذة للمشاركة', creatingTeaser: 'جارٍ كتابة النبذة…', teaserLabel: 'نبذة خالية من الحرق',
    shareOnSocial: 'المشاركة عبر تطبيق آخر', copySummary: 'نسخ نص المشاركة', downloadCard: 'تنزيل بطاقة المشاركة', shareReady: 'بطاقة المشاركة جاهزة.', copiedShare: 'تم نسخ نص المشاركة.', shareError: 'تعذرت المشاركة. يمكنك تنزيل البطاقة أو نسخ النص.',
    moodAdventure: 'مغامرة', moodRelaxed: 'استرخاء', moodCurious: 'فضول', moodHopeful: 'أمل'
  }
}

const moodKeys: Record<PersonalStoryMood, keyof ShareCopy> = {
  adventure: 'moodAdventure',
  relaxed: 'moodRelaxed',
  curious: 'moodCurious',
  hopeful: 'moodHopeful'
}

export function personalStoryShareText(key: keyof typeof english, language: StoryLanguageCode): string {
  return copies[language][key]
}

export function personalStoryMoodText(mood: PersonalStoryMood, language: StoryLanguageCode): string {
  return copies[language][moodKeys[mood]]
}
