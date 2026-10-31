import type { PersonalStory, PersonalStoryMood } from './story'
import type { StoryLanguageCode } from './storyLanguage'

export type StoryLifeBridgeLocale = 'en-US' | 'it-IT' | 'es-ES' | 'zh-CN' | 'hi-IN' | 'uk-UA' | 'ar-SA'
export type StoryLifeBridgeState = { actionIndex: number; response: 'offered' | 'intended' | 'declined' }
export type StoryLifeBridgeEvent = 'try' | 'another' | 'not-today'

type StoryLifeBridgeCopy = {
  title: string
  description: string
  tryIt: string
  chooseAnother: string
  notToday: string
  intended: string
  declined: string
}

const copy: Record<StoryLifeBridgeLocale, StoryLifeBridgeCopy> = {
  'en-US': {
    title: 'A small step beyond the story',
    description: 'If you like, choose one small, real-world action inspired by your story. This is optional; there is no need to report back.',
    tryIt: 'Try it',
    chooseAnother: 'Choose another',
    notToday: 'Not today',
    intended: 'You made room for this intention. Nothing else is expected.',
    declined: 'That’s completely fine. No action is expected.'
  },
  'it-IT': {
    title: 'Un piccolo passo oltre la storia',
    description: 'Se ti va, scegli una piccola azione nella vita reale ispirata alla tua storia. È facoltativa; non devi raccontarci come va.',
    tryIt: 'Ci provo',
    chooseAnother: 'Scegline un’altra',
    notToday: 'Non oggi',
    intended: 'Hai dato spazio a questa intenzione. Non c’è altro da fare.',
    declined: 'Va benissimo così. Non è richiesta alcuna azione.'
  },
  'es-ES': {
    title: 'Un pequeño paso más allá de la historia',
    description: 'Si te apetece, elige una pequeña acción en la vida real inspirada en tu historia. Es opcional; no hace falta que nos cuentes cómo va.',
    tryIt: 'Lo intentaré',
    chooseAnother: 'Elegir otra',
    notToday: 'Hoy no',
    intended: 'Has dejado espacio para esta intención. No se espera nada más.',
    declined: 'Está perfectamente bien. No se espera ninguna acción.'
  },
  'zh-CN': {
    title: '故事之外的一小步',
    description: '如果你愿意，可以选择一个受故事启发的现实生活小行动。这完全自愿，无需向我们汇报。',
    tryIt: '我愿意尝试',
    chooseAnother: '换一个',
    notToday: '今天不做',
    intended: '你为这个想法留出了空间。不需要再做什么。',
    declined: '完全没关系，不需要采取任何行动。'
  },
  'hi-IN': {
    title: 'कहानी से आगे एक छोटा कदम',
    description: 'अगर आप चाहें, तो कहानी से प्रेरित कोई छोटा-सा वास्तविक कदम चुनें। यह पूरी तरह वैकल्पिक है; हमें बताने की कोई ज़रूरत नहीं।',
    tryIt: 'इसे आज़माऊँगा/आज़माऊँगी',
    chooseAnother: 'दूसरा चुनें',
    notToday: 'आज नहीं',
    intended: 'आपने इस इरादे के लिए जगह बनाई। आगे कुछ करना ज़रूरी नहीं है।',
    declined: 'यह बिल्कुल ठीक है। कुछ करने की अपेक्षा नहीं है।'
  },
  'uk-UA': {
    title: 'Невеликий крок за межі історії',
    description: 'Якщо хочете, оберіть невелику реальну дію, навіяну історією. Це необов’язково; нічого звітувати не потрібно.',
    tryIt: 'Спробувати',
    chooseAnother: 'Обрати іншу',
    notToday: 'Не сьогодні',
    intended: 'Ви дали місце цьому наміру. Більше нічого не очікується.',
    declined: 'Це цілком нормально. Жодних дій не потрібно.'
  },
  'ar-SA': {
    title: 'خطوة صغيرة خارج القصة',
    description: 'إذا رغبت، اختر خطوة بسيطة في الحياة الواقعية استلهمتها من قصتك. هذا اختياري تمامًا، ولا حاجة لإخبارنا بما حدث.',
    tryIt: 'سأجرّبها',
    chooseAnother: 'اختر خطوة أخرى',
    notToday: 'ليس اليوم',
    intended: 'لقد منحت هذه النية مساحة. لا يُتوقع منك أي شيء آخر.',
    declined: 'لا بأس بذلك إطلاقًا. لا يُتوقع منك القيام بأي خطوة.'
  }
}

const actions: Record<PersonalStoryMood, Record<StoryLifeBridgeLocale, [string, string, string]>> = {
  adventure: {
    'en-US': ['Take a different route on a familiar walk.', 'Try one small new thing that interests you.', 'Make a simple plan for a short outing.'],
    'it-IT': ['Fai un percorso diverso durante una passeggiata abituale.', 'Prova una piccola novità che ti incuriosisce.', 'Organizza una breve uscita senza fretta.'],
    'es-ES': ['Prueba una ruta distinta en un paseo que ya conoces.', 'Prueba algo nuevo y pequeño que te interese.', 'Planea una salida breve y sencilla.'],
    'zh-CN': ['在熟悉的散步路线中换一条路走。', '尝试一件让你感兴趣的小事。', '简单计划一次短途出行。'],
    'hi-IN': ['अपनी परिचित सैर के लिए कोई दूसरा रास्ता चुनें।', 'अपनी रुचि की कोई छोटी नई चीज़ आज़माएँ।', 'थोड़ी देर बाहर जाने की एक सरल योजना बनाएँ।'],
    'uk-UA': ['Оберіть інший маршрут для звичної прогулянки.', 'Спробуйте щось нове й невелике, що вас цікавить.', 'Просто сплануйте коротку прогулянку.'],
    'ar-SA': ['اسلك طريقًا مختلفًا في نزهة معتادة.', 'جرّب شيئًا جديدًا وبسيطًا يثير اهتمامك.', 'خطط لنزهة قصيرة وبسيطة.']
  },
  relaxed: {
    'en-US': ['Set aside a few quiet minutes, with no task to finish.', 'Let one non-urgent task wait until later.', 'Enjoy a familiar drink without doing anything else.'],
    'it-IT': ['Ritagliati qualche minuto di quiete, senza nulla da finire.', 'Rimanda più tardi un’attività non urgente.', 'Goditi una bevanda che conosci senza fare altro.'],
    'es-ES': ['Reserva unos minutos de calma, sin nada que terminar.', 'Deja para más tarde una tarea que no sea urgente.', 'Disfruta de una bebida conocida sin hacer nada más.'],
    'zh-CN': ['留几分钟安静时间，不必完成任何事情。', '把一件不着急的事留到之后再做。', '什么也不做，慢慢享用一杯熟悉的饮品。'],
    'hi-IN': ['कुछ शांत मिनट अपने लिए रखें; कुछ पूरा करना ज़रूरी नहीं।', 'किसी गैर-ज़रूरी काम को बाद के लिए छोड़ दें।', 'बिना कुछ और किए अपनी पसंद का पेय पिएँ।'],
    'uk-UA': ['Знайдіть кілька тихих хвилин, нічого не завершуючи.', 'Відкладіть на потім одну необов’язкову справу.', 'Насолодіться звичним напоєм, не займаючись нічим іншим.'],
    'ar-SA': ['خصّص بضع دقائق هادئة دون الحاجة إلى إنجاز شيء.', 'اترك مهمة غير عاجلة لوقت لاحق.', 'استمتع بمشروب مألوف دون القيام بأي شيء آخر.']
  },
  curious: {
    'en-US': ['Spend a few minutes exploring a question that interests you.', 'Ask someone how they learned something you find interesting.', 'Write down one question you would enjoy exploring.'],
    'it-IT': ['Dedica qualche minuto a esplorare una domanda che ti incuriosisce.', 'Chiedi a qualcuno come ha imparato qualcosa che ti interessa.', 'Scrivi una domanda che ti piacerebbe approfondire.'],
    'es-ES': ['Dedica unos minutos a explorar una pregunta que te interese.', 'Pregunta a alguien cómo aprendió algo que te parece interesante.', 'Anota una pregunta que te gustaría explorar.'],
    'zh-CN': ['花几分钟了解一个让你感兴趣的问题。', '问问别人是如何学会一件你感兴趣的事的。', '写下一个你愿意继续探索的问题。'],
    'hi-IN': ['कुछ मिनट किसी ऐसे सवाल को जानने में बिताएँ जो आपको रोचक लगे।', 'किसी से पूछें कि उन्होंने अपनी रुचि की कोई चीज़ कैसे सीखी।', 'एक ऐसा सवाल लिखें जिसे जानना आपको अच्छा लगे।'],
    'uk-UA': ['Присвятіть кілька хвилин питанню, яке вас цікавить.', 'Запитайте когось, як він чи вона навчився чогось цікавого для вас.', 'Запишіть запитання, яке вам хотілося б дослідити.'],
    'ar-SA': ['اقضِ بضع دقائق في استكشاف سؤال يثير اهتمامك.', 'اسأل شخصًا كيف تعلّم أمرًا يهمك.', 'اكتب سؤالًا ترغب في استكشافه.']
  },
  hopeful: {
    'en-US': ['Choose one manageable next step for something you care about.', 'Write yourself a kind, encouraging note.', 'Ask someone you trust for company with a small task.'],
    'it-IT': ['Scegli un prossimo passo semplice per qualcosa a cui tieni.', 'Scriviti un messaggio gentile e incoraggiante.', 'Chiedi a una persona fidata di farti compagnia mentre svolgi una piccola attività.'],
    'es-ES': ['Elige un siguiente paso sencillo para algo que te importa.', 'Escríbete una nota amable y alentadora.', 'Pide a alguien de confianza que te acompañe en una tarea pequeña.'],
    'zh-CN': ['为一件你在意的事选一个容易做到的下一步。', '给自己写一张友善、鼓励的小纸条。', '请一位信任的人陪你做一件小事。'],
    'hi-IN': ['अपनी किसी प्रिय चीज़ के लिए एक आसान अगला कदम चुनें।', 'अपने लिए एक स्नेहभरा और हौसला देने वाला नोट लिखें।', 'किसी भरोसेमंद व्यक्ति से किसी छोटे काम में साथ देने को कहें।'],
    'uk-UA': ['Оберіть простий наступний крок для чогось важливого для вас.', 'Напишіть собі добру й підбадьорливу записку.', 'Попросіть людину, якій довіряєте, побути поруч із вами під час невеликої справи.'],
    'ar-SA': ['اختر خطوة تالية بسيطة لأمر يهمك.', 'اكتب لنفسك رسالة لطيفة ومشجعة.', 'اطلب من شخص تثق به أن يرافقك في مهمة بسيطة.']
  }
}

export function getStoryLifeBridgeCopy(language: StoryLanguageCode | string): StoryLifeBridgeCopy {
  return copy[language as StoryLifeBridgeLocale] ?? copy['en-US']
}

export function getStoryLifeBridgeAction(
  mood: PersonalStoryMood,
  language: StoryLanguageCode | string,
  actionIndex: number
): string {
  const locale = language in actions[mood] ? language as StoryLifeBridgeLocale : 'en-US'
  const options = actions[mood][locale]
  return options[((actionIndex % options.length) + options.length) % options.length]
}

export function createStoryLifeBridgeState(): StoryLifeBridgeState {
  return { actionIndex: 0, response: 'offered' }
}

export function transitionStoryLifeBridge(
  state: StoryLifeBridgeState,
  event: StoryLifeBridgeEvent
): StoryLifeBridgeState {
  if (event === 'try') return { ...state, response: 'intended' }
  if (event === 'not-today') return { ...state, response: 'declined' }
  return { actionIndex: state.actionIndex + 1, response: 'offered' }
}

export function canShowStoryLifeBridge(
  story: PersonalStory | null,
  archiveReading: boolean
): boolean {
  if (!story || archiveReading || story.archived || story.scenes.length === 0) return false
  if (story.journey) return story.journey.status === 'concluded' && !story.journey.pending
  return story.responses.length >= story.scenes.length ||
    (story.generation === 'ai' && story.currentStep === story.scenes.length - 1)
}
