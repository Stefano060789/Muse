import type { StoryLanguageCode } from './storyLanguage'

type Copy = { title: string; allow: string; remembered: string; error: string }
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': { title: 'AI sharing summaries', allow: 'Remember my permission for AI sharing summaries', remembered: 'Permission saved to your account. Revoke it in Settings. Each summary uses one AI interaction.', error: 'Could not load or save permission. Sign in and try again.' },
  'it-IT': { title: 'Riassunti IA da condividere', allow: 'Ricorda il mio consenso per i riassunti IA da condividere', remembered: 'Consenso salvato nel tuo account. Puoi revocarlo nelle Impostazioni. Ogni riassunto usa un’interazione IA.', error: 'Impossibile caricare o salvare il consenso. Accedi e riprova.' },
  'es-ES': { title: 'Resúmenes IA para compartir', allow: 'Recordar mi permiso para resúmenes IA', remembered: 'Permiso guardado en tu cuenta. Puedes revocarlo en Ajustes. Cada resumen usa una interacción IA.', error: 'No se pudo cargar o guardar el permiso. Inicia sesión e inténtalo de nuevo.' },
  'zh-CN': { title: 'AI 分享摘要', allow: '记住我对 AI 分享摘要的许可', remembered: '许可已保存到你的账户，可在设置中撤销。每个摘要消耗一次 AI 互动。', error: '无法读取或保存许可，请登录后重试。' },
  'hi-IN': { title: 'साझा करने के लिए AI सारांश', allow: 'AI सारांश के लिए मेरी अनुमति याद रखें', remembered: 'अनुमति आपके खाते में सहेजी गई। सेटिंग में वापस ले सकते हैं। हर सारांश एक AI संवाद लेता है।', error: 'अनुमति लोड या सहेज नहीं सके। साइन इन करके फिर कोशिश करें।' },
  'uk-UA': { title: 'ШІ-підсумки для поширення', allow: 'Запам’ятати мій дозвіл на ШІ-підсумки', remembered: 'Дозвіл збережено в акаунті. Його можна відкликати в Налаштуваннях. Кожен підсумок витрачає одну ШІ-взаємодію.', error: 'Не вдалося завантажити чи зберегти дозвіл. Увійдіть і спробуйте ще раз.' },
  'ar-SA': { title: 'ملخصات المشاركة بالذكاء الاصطناعي', allow: 'تذكّر إذني لملخصات المشاركة بالذكاء الاصطناعي', remembered: 'حُفظ الإذن في حسابك. يمكنك إلغاؤه من الإعدادات. يستخدم كل ملخص تفاعل ذكاء اصطناعي واحدًا.', error: 'تعذّر تحميل الإذن أو حفظه. سجّل الدخول وحاول مجددًا.' }
}
export const shareConsentCopy = (language: StoryLanguageCode): Copy => copies[language]

const privacy: Record<StoryLanguageCode, string> = {
  'en-US': 'New accounts include AI sharing summaries in the processing permission accepted at registration. Existing accounts keep their separate optional sharing permission. Account permissions are saved with version and acceptance date, apply across devices and can be revoked in Settings. Summaries send only title, broad mood and requested language; each generation uses one AI interaction.',
  'it-IT': 'I nuovi account includono i riassunti IA nel consenso al trattamento accettato alla registrazione. Gli account esistenti mantengono il consenso facoltativo separato. I consensi sono salvati con versione e data, valgono su più dispositivi e si revocano nelle Impostazioni. I riassunti inviano solo titolo, atmosfera generale e lingua richiesta; ogni generazione usa un’interazione IA.',
  'es-ES': 'Las cuentas nuevas incluyen los resúmenes IA en el permiso aceptado al registrarse. Las cuentas existentes mantienen su permiso opcional separado. Los permisos se guardan con versión y fecha, se aplican entre dispositivos y se revocan en Ajustes. Los resúmenes envían solo título, ambiente general e idioma solicitado; cada generación usa una interacción IA.',
  'zh-CN': '新账户的注册处理许可包含 AI 分享摘要。已有账户保留独立的可选分享许可。账户许可连同版本和同意日期保存，可跨设备使用并在设置中撤销。摘要仅发送标题、大致氛围和请求的语言，每次生成消耗一次 AI 互动。',
  'hi-IN': 'नए खातों में AI साझा सारांश पंजीकरण पर स्वीकार की गई प्रसंस्करण अनुमति में शामिल हैं। मौजूदा खातों की अलग वैकल्पिक अनुमति बनी रहती है। अनुमतियाँ संस्करण और तारीख के साथ सहेजी जाती हैं, सभी उपकरणों पर लागू होती हैं और सेटिंग में वापस ली जा सकती हैं। सारांश केवल शीर्षक, सामान्य माहौल और चुनी भाषा भेजते हैं; हर निर्माण एक AI संवाद लेता है।',
  'uk-UA': 'Нові акаунти включають ШІ-підсумки в дозвіл на обробку, прийнятий при реєстрації. Наявні акаунти зберігають окремий необов’язковий дозвіл. Дозволи зберігаються з версією й датою, діють на різних пристроях і відкликаються в Налаштуваннях. Для підсумку надсилаються лише назва, загальний настрій і запитана мова; кожне створення витрачає одну ШІ-взаємодію.',
  'ar-SA': 'تشمل الحسابات الجديدة ملخصات المشاركة ضمن إذن المعالجة المقبول عند التسجيل. تحتفظ الحسابات الحالية بإذنها الاختياري المنفصل. تُحفظ الأذونات مع الإصدار والتاريخ وتسري عبر الأجهزة ويمكن إلغاؤها من الإعدادات. تُرسل للملخصات فقط العنوان والجو العام واللغة المطلوبة؛ يستخدم كل إنشاء تفاعلًا واحدًا.'
}
export const shareConsentPrivacyCopy = (language: StoryLanguageCode): string => privacy[language]
