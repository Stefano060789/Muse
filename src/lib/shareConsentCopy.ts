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
  'en-US': 'Optional AI sharing-summary permission is stored in your account profile with its version and acceptance date, not granted by registration. It applies across devices and can be revoked in Settings. Only the title, broad mood and requested language are sent for a summary; each generation uses one AI interaction. Other AI and speech permissions remain separate.',
  'it-IT': 'Il consenso facoltativo ai riassunti IA è salvato nel profilo del tuo account con versione e data di accettazione; la registrazione non lo concede. Vale su più dispositivi e si può revocare nelle Impostazioni. Per un riassunto vengono inviati solo titolo, atmosfera generale e lingua richiesta; ogni generazione usa un’interazione IA. Gli altri consensi IA e vocali restano separati.',
  'es-ES': 'El permiso opcional para resúmenes IA se guarda en tu perfil con su versión y fecha de aceptación; el registro no lo concede. Se aplica entre dispositivos y se puede revocar en Ajustes. Solo se envían el título, el ambiente general y el idioma solicitado; cada generación usa una interacción IA. Los demás permisos de IA y voz son independientes.',
  'zh-CN': '可选的 AI 分享摘要许可及其版本和同意日期保存在账户资料中，注册不会自动授予。许可可跨设备使用，并可在设置中撤销。生成摘要时仅发送标题、大致氛围和请求的语言，每次消耗一次 AI 互动。其他 AI 和语音许可保持独立。',
  'hi-IN': 'वैकल्पिक AI सारांश अनुमति उसके संस्करण और स्वीकृति की तारीख के साथ आपके खाते में रखी जाती है; पंजीकरण इसे नहीं देता। यह सभी उपकरणों पर लागू होती है और सेटिंग में वापस ली जा सकती है। सारांश के लिए केवल शीर्षक, सामान्य माहौल और चुनी भाषा भेजे जाते हैं; हर निर्माण एक AI संवाद लेता है। अन्य AI और आवाज़ अनुमतियाँ अलग हैं।',
  'uk-UA': 'Необов’язковий дозвіл на ШІ-підсумки зберігається у профілі акаунта разом із версією та датою прийняття; реєстрація його не надає. Він діє на різних пристроях і відкликається в Налаштуваннях. Для підсумку передаються лише назва, загальний настрій і запитана мова; кожне створення витрачає одну ШІ-взаємодію. Інші дозволи на ШІ та голос залишаються окремими.',
  'ar-SA': 'يُحفظ الإذن الاختياري لملخصات الذكاء الاصطناعي في ملف حسابك مع الإصدار وتاريخ القبول؛ التسجيل لا يمنحه. يسري عبر الأجهزة ويمكن إلغاؤه من الإعدادات. يُرسل فقط العنوان والجو العام واللغة المطلوبة للملخص؛ يستخدم كل إنشاء تفاعلًا واحدًا. تبقى أذونات الذكاء الاصطناعي والصوت الأخرى منفصلة.'
}
export const shareConsentPrivacyCopy = (language: StoryLanguageCode): string => privacy[language]
