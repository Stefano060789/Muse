import type { SharedStoryBrief } from './sharedStory'
import type { StoryLanguageCode } from './storyLanguage'

const copies = {
  'en-US': {
    title: 'Five minutes together', intro: 'A small adventure to share with someone you choose. Play across devices; either person can pass or leave.',
    start: 'Start a story for two', customize: 'More options', confirm: 'Use the short adventure template? Names, personal details and your message stay; other story settings and hints will be replaced.',
    memory: 'A shared memory', message: 'A message for them', prepare: 'Prepare our story',
    limits: 'About five minutes, not a timer. Preparation and up to 6 live AI actions use paid attempts; failures may count. Cooperative play supports 2–20 people, so share the link only with your chosen person.',
    setting: 'Two friends explore a peaceful lantern garden from different places. They take turns choosing small, welcoming discoveries. Use any supplied shared memory gently; do not assume romance, diagnose feelings or pressure either player.',
    goal: 'Find a lantern marked with the word together. Offer small choices and reveal this word clearly in the final scene.',
    solution: 'together', narration: 'Warm, unhurried and welcoming. No threats or frightening scenes.',
    defaultMessage: 'I made this little adventure so we could share a moment. No need to reply right away.'
  },
  'it-IT': {
    title: 'Cinque minuti insieme', intro: 'Una piccola avventura con una persona scelta da te. Giocate da dispositivi diversi; entrambi potete passare o uscire.',
    start: 'Crea una storia per due', customize: 'Altre opzioni', confirm: 'Usare il modello breve? Nomi, dettagli personali e messaggio restano; le altre impostazioni e gli indizi saranno sostituiti.',
    memory: 'Un ricordo condiviso', message: 'Un messaggio per questa persona', prepare: 'Prepara la nostra storia',
    limits: 'Circa cinque minuti, senza timer. La preparazione e fino a 6 azioni IA usano tentativi a pagamento; anche i fallimenti possono contare. Il gioco cooperativo ammette 2–20 persone: condividi il link solo con chi hai scelto.',
    setting: 'Due amici esplorano da luoghi diversi un tranquillo giardino di lanterne. A turno scelgono piccole scoperte accoglienti. Usa con delicatezza i ricordi condivisi forniti, senza presumere romanticismo, diagnosticare emozioni o fare pressione.',
    goal: 'Trovare una lanterna con la parola insieme. Offri piccole scelte e mostra chiaramente questa parola nella scena finale.',
    solution: 'insieme', narration: 'Caloroso, tranquillo e accogliente. Nessuna minaccia o scena spaventosa.',
    defaultMessage: 'Ho creato questa piccola avventura per condividere un momento. Non serve rispondere subito.'
  },
  'es-ES': {
    title: 'Cinco minutos juntos', intro: 'Una pequeña aventura con alguien que tú eliges. Jugad desde distintos dispositivos; podéis pasar o salir.',
    start: 'Crear una historia para dos', customize: 'Más opciones', confirm: '¿Usar la plantilla breve? Se conservan nombres, detalles personales y mensaje; se reemplazan los demás ajustes y pistas.',
    memory: 'Un recuerdo compartido', message: 'Un mensaje para esa persona', prepare: 'Preparar nuestra historia',
    limits: 'Unos cinco minutos, sin temporizador. Preparar y hasta 6 acciones de IA usan intentos de pago; los fallos pueden contar. El modo cooperativo admite 2–20 personas: comparte el enlace solo con quien elijas.',
    setting: 'Dos amigos exploran un tranquilo jardín de faroles desde lugares distintos. Se turnan para elegir pequeños descubrimientos acogedores. Usa con cuidado los recuerdos aportados; no supongas romance, diagnostiques sentimientos ni presiones.',
    goal: 'Encontrar un farol con la palabra juntos. Ofrece pequeñas decisiones y muestra claramente esa palabra en la escena final.',
    solution: 'juntos', narration: 'Cálido, pausado y acogedor. Sin amenazas ni escenas aterradoras.',
    defaultMessage: 'Creé esta pequeña aventura para compartir un momento. No hace falta responder enseguida.'
  },
  'zh-CN': {
    title: '一起度过五分钟', intro: '与自己选择的人分享一段小冒险。在不同设备上轮流参与；任何人都可跳过或离开。',
    start: '创建双人故事', customize: '更多选项', confirm: '使用简短模板？保留姓名、个人细节和留言；其他设置与提示将被替换。',
    memory: '共同回忆', message: '给对方的留言', prepare: '准备我们的故事',
    limits: '大约五分钟，没有倒计时。准备和最多6次实时AI行动使用付费次数；失败也可能计入。合作模式支持2–20人，请仅向选定的人分享链接。',
    setting: '两位朋友从不同地方探索宁静的灯笼花园，轮流选择温暖的小发现。温柔使用提供的共同回忆；不假设浪漫、不诊断情绪、不向参与者施压。',
    goal: '找到写着一起的灯笼。提供简单选择，并在最后场景清楚显示这个词。',
    solution: '一起', narration: '温暖、舒缓、友好，没有威胁或恐怖场景。',
    defaultMessage: '我做了这个小冒险，想和你分享片刻。不必马上回复。'
  },
  'hi-IN': {
    title: 'पाँच मिनट साथ', intro: 'अपने चुने हुए व्यक्ति के साथ छोटा रोमांच। अलग डिवाइस से खेलें; कोई भी बारी छोड़ या बाहर जा सकता है।',
    start: 'दो लोगों की कहानी बनाएँ', customize: 'अधिक विकल्प', confirm: 'छोटा प्रारूप उपयोग करें? नाम, निजी विवरण और संदेश रहेंगे; अन्य सेटिंग और संकेत बदलेंगे।',
    memory: 'साझा याद', message: 'उनके लिए संदेश', prepare: 'हमारी कहानी तैयार करें',
    limits: 'लगभग पाँच मिनट, कोई टाइमर नहीं। तैयारी और अधिकतम 6 AI कार्रवाइयाँ सशुल्क प्रयास हैं; विफलता भी गिनी जा सकती है। सहयोगी खेल 2–20 लोगों के लिए है; लिंक केवल चुने व्यक्ति को दें।',
    setting: 'दो मित्र अलग जगहों से एक शांत लालटेन उद्यान खोजते हैं। बारी-बारी छोटे स्वागतपूर्ण खोज चुनते हैं। दी गई साझा यादों का ध्यान से उपयोग करें; रोमांस न मानें, भावनाओं का निदान या दबाव न डालें।',
    goal: 'साथ लिखी लालटेन खोजें। छोटे विकल्प दें और अंतिम दृश्य में यह शब्द स्पष्ट दिखाएँ।',
    solution: 'साथ', narration: 'आत्मीय, धीमा और स्वागतपूर्ण। धमकी या डरावने दृश्य नहीं।',
    defaultMessage: 'मैंने साथ कुछ समय बिताने के लिए यह छोटा रोमांच बनाया। तुरंत जवाब देना ज़रूरी नहीं।'
  },
  'uk-UA': {
    title: 'П’ять хвилин разом', intro: 'Маленька пригода з обраною людиною. Грайте з різних пристроїв; кожен може пропустити хід або вийти.',
    start: 'Створити історію для двох', customize: 'Більше опцій', confirm: 'Використати короткий шаблон? Імена, особисті деталі й повідомлення залишаться; інші налаштування та підказки буде замінено.',
    memory: 'Спільний спогад', message: 'Повідомлення для цієї людини', prepare: 'Підготувати нашу історію',
    limits: 'Близько п’яти хвилин, без таймера. Підготовка й до 6 дій ШІ використовують платні спроби; невдачі можуть рахуватися. Кооперативна гра підтримує 2–20 людей: поширюйте посилання лише обраній людині.',
    setting: 'Двоє друзів із різних місць досліджують тихий сад ліхтарів. По черзі вибирають маленькі доброзичливі відкриття. Обережно використовуйте надані спогади; не припускайте романтики, не діагностуйте почуття й не тисніть.',
    goal: 'Знайти ліхтар зі словом разом. Запропонуйте прості вибори й чітко покажіть це слово у фінальній сцені.',
    solution: 'разом', narration: 'Теплий, неквапливий і привітний. Без загроз чи страшних сцен.',
    defaultMessage: 'Я створив цю маленьку пригоду, щоб поділитися миттю. Не потрібно відповідати одразу.'
  },
  'ar-SA': {
    title: 'خمس دقائق معًا', intro: 'مغامرة صغيرة مع شخص تختاره. العبوا من أجهزة مختلفة؛ يمكن لأي شخص تجاوز دوره أو المغادرة.',
    start: 'أنشئ قصة لشخصين', customize: 'خيارات إضافية', confirm: 'استخدام القالب القصير؟ تبقى الأسماء والتفاصيل والرسالة؛ تُستبدل الإعدادات والتلميحات الأخرى.',
    memory: 'ذكرى مشتركة', message: 'رسالة لهذا الشخص', prepare: 'جهّز قصتنا',
    limits: 'نحو خمس دقائق، دون مؤقت. الإعداد وحتى 6 أفعال ذكاء تستخدم محاولات مدفوعة؛ قد تُحتسب الإخفاقات. اللعب التعاوني يدعم 2–20 شخصًا؛ شارك الرابط مع الشخص المختار فقط.',
    setting: 'صديقان يستكشفان حديقة فوانيس هادئة من مكانين مختلفين. يتناوبان اختيار اكتشافات صغيرة ودودة. استخدم الذكريات المقدمة بلطف؛ لا تفترض الرومانسية ولا تشخص المشاعر ولا تضغط على اللاعبين.',
    goal: 'اعثروا على فانوس يحمل كلمة معًا. قدم خيارات بسيطة وأظهر الكلمة بوضوح في المشهد الأخير.',
    solution: 'معًا', narration: 'دافئ وهادئ وودود. دون تهديدات أو مشاهد مخيفة.',
    defaultMessage: 'صنعت هذه المغامرة الصغيرة لنشارك لحظة. لا حاجة للرد فورًا.'
  }
}

export const togetherStoryCopy = (language: StoryLanguageCode) => copies[language]

export function togetherStoryBrief(current: SharedStoryBrief): SharedStoryBrief {
  const language = current.language ?? 'en-US'
  const copy = togetherStoryCopy(language)
  return {
    creatorName: current.creatorName, recipientName: current.recipientName, language,
    recipientHints: current.recipientHints, message: current.message.trim() ? current.message : copy.defaultMessage,
    durationMinutes: 5, setting: copy.setting, goal: copy.goal, narration: copy.narration,
    solution: copy.solution, answerType: 'phrase', unlockPolicy: 'allow-skip',
    assistanceHints: [], alternativeAnswers: [],
    adventure: { actionBudget: 6, choiceMode: 'suggested', cooperative: true },
    gift: { occasion: 'just-because', dedication: current.gift?.dedication ?? '', allowReply: true }
  }
}
