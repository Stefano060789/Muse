import type { StoryLanguageCode } from './storyLanguage'

const copies = {
  'en-US': {
    title: 'Stories',
    subtitle: 'Choose who the story is for.',
    personalTitle: 'My Story',
    personalDescription: 'Create a story for yourself and continue it with new chapters. Personal memories are optional.',
    personalAction: 'Open My stories',
    sharedTitle: 'Shared Story',
    sharedDescription: 'Create an interactive story for someone else and share it with a private link. You can also choose a two-person version and take part together.',
    sharedAllowance: 'Included in Muse Plus. Shares the package allowance of 10 new stories and 120 AI interactions with My Story.',
    sharedAction: 'Create a Shared Story',
  },
  'it-IT': {
    title: 'Storie',
    subtitle: 'Scegli per chi creare la storia.',
    personalTitle: 'La mia storia',
    personalDescription: 'Crea una storia per te e continua con nuovi capitoli. I ricordi personali sono facoltativi.',
    personalAction: 'Apri Le mie storie',
    sharedTitle: 'Storia condivisa',
    sharedDescription: 'Crea una storia interattiva per qualcun altro e condividila con un link privato. Puoi anche scegliere la modalità per due e partecipare insieme.',
    sharedAllowance: 'Inclusa in Muse Plus. Condivide con La mia storia il limite del pacchetto: 10 nuove storie e 120 interazioni IA.',
    sharedAction: 'Crea una storia condivisa',
  },
  'es-ES': {
    title: 'Historias',
    subtitle: 'Elige para quién es la historia.',
    personalTitle: 'Mi historia',
    personalDescription: 'Crea una historia para ti y continúa con nuevos capítulos. Los recuerdos personales son opcionales.',
    personalAction: 'Abrir Mis historias',
    sharedTitle: 'Historia compartida',
    sharedDescription: 'Crea una historia interactiva para otra persona y compártela con un enlace privado. También puedes elegir la versión para dos y participar juntos.',
    sharedAllowance: 'Incluida en Muse Plus. Comparte con Mi historia el límite del paquete: 10 historias nuevas y 120 interacciones IA.',
    sharedAction: 'Crear una historia compartida',
  },
  'zh-CN': {
    title: '故事',
    subtitle: '选择故事是为谁创作。',
    personalTitle: '我的故事',
    personalDescription: '为自己创作故事，并通过新章节继续。个人回忆可选。',
    personalAction: '打开我的故事',
    sharedTitle: '共享故事',
    sharedDescription: '为他人创作互动故事，并通过私密链接分享。也可选择双人模式，一起参与。',
    sharedAllowance: '包含在 Muse Plus 中。与我的故事共用每期 10 个新故事和 120 次 AI 互动额度。',
    sharedAction: '创建共享故事',
  },
  'hi-IN': {
    title: 'कहानियाँ',
    subtitle: 'चुनें कि कहानी किसके लिए है।',
    personalTitle: 'My Story',
    personalDescription: 'अपने लिए कहानी बनाएँ और नए अध्यायों से आगे बढ़ाएँ। निजी यादें जोड़ना वैकल्पिक है।',
    personalAction: 'मेरी कहानियाँ खोलें',
    sharedTitle: 'Shared Story',
    sharedDescription: 'किसी और के लिए इंटरैक्टिव कहानी बनाएँ और निजी लिंक से साझा करें। दो लोगों वाला विकल्प चुनकर आप साथ में भी भाग ले सकते हैं।',
    sharedAllowance: 'Muse Plus में शामिल। My Story के साथ 10 नई कहानियों और 120 AI संवादों की साझा सीमा।',
    sharedAction: 'Shared Story बनाएँ',
  },
  'uk-UA': {
    title: 'Історії',
    subtitle: 'Оберіть, для кого створюєте історію.',
    personalTitle: 'Моя історія',
    personalDescription: 'Створюйте історію для себе й продовжуйте її новими розділами. Особисті спогади — за бажанням.',
    personalAction: 'Відкрити мої історії',
    sharedTitle: 'Спільна історія',
    sharedDescription: 'Створіть інтерактивну історію для когось і поділіться приватним посиланням. Можна обрати режим для двох і брати участь разом.',
    sharedAllowance: 'Входить до Muse Plus. Спільний ліміт із «Моєю історією»: 10 нових історій і 120 взаємодій ШІ.',
    sharedAction: 'Створити спільну історію',
  },
  'ar-SA': {
    title: 'القصص',
    subtitle: 'اختر لمن تكتب القصة.',
    personalTitle: 'قصتي',
    personalDescription: 'أنشئ قصة لنفسك وتابعها بفصول جديدة. إضافة الذكريات الشخصية اختيارية.',
    personalAction: 'افتح قصصي',
    sharedTitle: 'قصة مشتركة',
    sharedDescription: 'أنشئ قصة تفاعلية لشخص آخر وشاركها عبر رابط خاص. ويمكنك اختيار نسخة لشخصين والمشاركة معًا.',
    sharedAllowance: 'مشمولة في Muse Plus. تتشارك مع قصتي حد الباقة: 10 قصص جديدة و120 تفاعلًا بالذكاء الاصطناعي.',
    sharedAction: 'أنشئ قصة مشتركة',
  }
} satisfies Record<StoryLanguageCode, Record<string, string>>

export type StoriesHubCopy = typeof copies['en-US']

export function storiesHubCopy(language: StoryLanguageCode): StoriesHubCopy {
  return copies[language]
}
