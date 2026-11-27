import type { StoryLanguageCode } from './storyLanguage'

const copies = {
  'en-US': {
    title: 'Stories',
    subtitle: 'Choose who the story is for.',
    personalTitle: 'My Story',
    personalDescription: 'Your own adventure, with optional memories and new chapters.',
    personalAction: 'Open My stories',
    sharedTitle: 'Shared Story',
    sharedDescription: 'Share a story by private link, or play together.',
    sharedAllowance: 'Included in Muse Plus. Shares the package allowance of 10 new stories and 120 AI interactions with My Story.',
    sharedAction: 'Create a Shared Story',
  },
  'it-IT': {
    title: 'Storie',
    subtitle: 'Scegli per chi creare la storia.',
    personalTitle: 'La mia storia',
    personalDescription: 'La tua avventura, con ricordi facoltativi e nuovi capitoli.',
    personalAction: 'Apri Le mie storie',
    sharedTitle: 'Storia condivisa',
    sharedDescription: 'Condividi una storia con un link privato o giocate insieme.',
    sharedAllowance: 'Inclusa in Muse Plus. Condivide con La mia storia il limite del pacchetto: 10 nuove storie e 120 interazioni IA.',
    sharedAction: 'Crea una storia condivisa',
  },
  'es-ES': {
    title: 'Historias',
    subtitle: 'Elige para quién es la historia.',
    personalTitle: 'Mi historia',
    personalDescription: 'Tu propia aventura, con recuerdos opcionales y nuevos capítulos.',
    personalAction: 'Abrir Mis historias',
    sharedTitle: 'Historia compartida',
    sharedDescription: 'Comparte una historia con un enlace privado o jugad juntos.',
    sharedAllowance: 'Incluida en Muse Plus. Comparte con Mi historia el límite del paquete: 10 historias nuevas y 120 interacciones IA.',
    sharedAction: 'Crear una historia compartida',
  },
  'zh-CN': {
    title: '故事',
    subtitle: '选择故事是为谁创作。',
    personalTitle: '我的故事',
    personalDescription: '你的专属冒险，可加入回忆并继续新章节。',
    personalAction: '打开我的故事',
    sharedTitle: '共享故事',
    sharedDescription: '通过私密链接分享故事，或一起游玩。',
    sharedAllowance: '包含在 Muse Plus 中。与我的故事共用每期 10 个新故事和 120 次 AI 互动额度。',
    sharedAction: '创建共享故事',
  },
  'hi-IN': {
    title: 'कहानियाँ',
    subtitle: 'चुनें कि कहानी किसके लिए है।',
    personalTitle: 'My Story',
    personalDescription: 'आपका अपना रोमांच, नए अध्यायों और वैकल्पिक यादों के साथ।',
    personalAction: 'मेरी कहानियाँ खोलें',
    sharedTitle: 'Shared Story',
    sharedDescription: 'निजी लिंक से कहानी साझा करें या साथ खेलें।',
    sharedAllowance: 'Muse Plus में शामिल। My Story के साथ 10 नई कहानियों और 120 AI संवादों की साझा सीमा।',
    sharedAction: 'Shared Story बनाएँ',
  },
  'uk-UA': {
    title: 'Історії',
    subtitle: 'Оберіть, для кого створюєте історію.',
    personalTitle: 'Моя історія',
    personalDescription: 'Ваша пригода з новими розділами та спогадами за бажанням.',
    personalAction: 'Відкрити мої історії',
    sharedTitle: 'Спільна історія',
    sharedDescription: 'Поділіться історією приватним посиланням або грайте разом.',
    sharedAllowance: 'Входить до Muse Plus. Спільний ліміт із «Моєю історією»: 10 нових історій і 120 взаємодій ШІ.',
    sharedAction: 'Створити спільну історію',
  },
  'ar-SA': {
    title: 'القصص',
    subtitle: 'اختر لمن تكتب القصة.',
    personalTitle: 'قصتي',
    personalDescription: 'مغامرتك الخاصة بفصول جديدة وذكريات اختيارية.',
    personalAction: 'افتح قصصي',
    sharedTitle: 'قصة مشتركة',
    sharedDescription: 'شارك قصة برابط خاص أو العبوا معًا.',
    sharedAllowance: 'مشمولة في Muse Plus. تتشارك مع قصتي حد الباقة: 10 قصص جديدة و120 تفاعلًا بالذكاء الاصطناعي.',
    sharedAction: 'أنشئ قصة مشتركة',
  }
} satisfies Record<StoryLanguageCode, Record<string, string>>

export type StoriesHubCopy = typeof copies['en-US']

export function storiesHubCopy(language: StoryLanguageCode): StoriesHubCopy {
  return copies[language]
}
