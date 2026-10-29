import { useEffect, useState } from 'react'
import { STORY_LANGUAGES, type StoryLanguageCode } from './storyLanguage'

export const INTERFACE_LANGUAGE_KEY = 'muse-interface-language'
export const INTERFACE_LANGUAGE_CHANGE_EVENT = 'muse-interface-language-changed'
const english = {
  navHome: 'Home',
  navMyself: 'Myself',
  navMyStories: 'My stories',
  navCreateGift: 'Create a gift story',
  navArchive: 'Archive',
  navSettings: 'Settings',
  museHome: 'Muse home',
  settingsEyebrow: 'Your Muse preferences',
  settingsTitle: 'Settings',
  settingsSubtitle: 'Manage your account, profile, language and notification preferences.',
  profileHeading: 'Your profile',
  profileNameLabel: 'Your name',
  profileNameHelp: 'Used as your name when you create a shared story and when you take part in cooperative stories.',
  saveProfile: 'Save name',
  profileSaved: 'Your name is saved.',
  languageHeading: 'Muse language',
  interfaceLanguageLabel: 'Interface language',
  interfaceLanguageHelp: 'Changes navigation, Home, Settings, key headings and actions in Myself, My stories, Archive, and story-creation screens. Some form details, help, status messages, and story-reader text may remain in English. English is the default.',
  storyLanguageLabel: 'Default story language',
  storyLanguageHelp: 'Sets the language used to generate new stories. Individual stories can use another language.',
  languageSaved: 'Language preference saved.',
  notificationsHeading: 'Shared-story notifications',
  notificationsHelp: 'When enabled, Muse can notify you in this browser when someone opens a shared story, reaches a progress milestone, or completes it. Notifications are checked while Muse is open and you are signed in; they are not email or browser push alerts.',
  notificationsEnabled: 'Enable in-app shared-story notifications',
  accountHeading: 'Account',
  accountHelp: 'Sign in to create and manage your stories.',
  localAccount: 'Local development is using local story storage. No account sign-in is needed in this development environment.',
  signIn: 'Sign in',
  createAccount: 'Create account',
  signedIn: 'You’re signed in',
  savedStories: 'Go to saved stories',
  signOut: 'Sign out',
  email: 'Email',
  password: 'Password',
  welcomeEyebrow: 'Small adventures. Personal meaning.',
  homeTitle: 'A story to get lost in.',
  homeGiftTitle: 'A gift story they’ll remember.',
  homeSubtitle: 'Muse turns your memories, interests, and relationships into stories you can keep building together.',
  homeMyself: 'Myself',
  homeJustForYou: 'Just for you',
  homeForSomeone: 'For someone else',
  homeCreatePersonal: 'My stories',
  homeCreatePersonalHelp: 'Choose how you want to feel, then write or speak your choices as Muse builds your personal adventure.',
  homeOpenPersonal: 'Open My stories',
  homeShareTogether: 'Share a story & play together',
  homeShareHelp: 'Create an interactive story and send your group a private link. Invite Muse members and guests to share progress and take turns across devices.',
  homeCreateGift: 'Create & share a story',
  sample: 'Try a 2-minute sample',
  sampleNote: 'Free, handcrafted, no account needed.'
} as const

export type InterfaceCopyKey = keyof typeof english
type InterfaceCopy = Record<InterfaceCopyKey, string>

const copies: Record<StoryLanguageCode, InterfaceCopy> = {
  'en-US': english,
  'it-IT': {
    navHome: 'Home', navMyself: 'Io', navMyStories: 'Le mie storie', navCreateGift: 'Crea una storia regalo', navArchive: 'Archivio', navSettings: 'Impostazioni', museHome: 'Home di Muse',
    settingsEyebrow: 'Le tue preferenze Muse', settingsTitle: 'Impostazioni', settingsSubtitle: 'Gestisci account, profilo, lingua e notifiche.',
    profileHeading: 'Il tuo profilo', profileNameLabel: 'Il tuo nome', profileNameHelp: 'Viene usato come nome quando crei una storia condivisa e partecipi a storie cooperative.', saveProfile: 'Salva nome', profileSaved: 'Il tuo nome è stato salvato.',
    languageHeading: 'Lingua di Muse', interfaceLanguageLabel: 'Lingua dell’interfaccia', interfaceLanguageHelp: 'Cambia la navigazione, la Home e le Impostazioni, oltre a titoli e azioni principali nelle sezioni Io, Le mie storie, Archivio e creazione. Alcuni dettagli dei moduli, aiuti, stati e testi del lettore potrebbero restare in inglese. L’inglese è la lingua predefinita.', storyLanguageLabel: 'Lingua predefinita delle storie', storyLanguageHelp: 'Imposta la lingua usata per generare nuove storie. Ogni storia può usare un’altra lingua.', languageSaved: 'Preferenza della lingua salvata.',
    notificationsHeading: 'Notifiche delle storie condivise', notificationsHelp: 'Se attive, Muse può avvisarti in questo browser quando qualcuno apre una storia condivisa, raggiunge un traguardo o la completa. Gli avvisi vengono controllati mentre Muse è aperto e hai effettuato l’accesso; non sono email né notifiche push.', notificationsEnabled: 'Attiva le notifiche in-app delle storie condivise',
    accountHeading: 'Account', accountHelp: 'Accedi per creare e gestire le tue storie.', localAccount: 'Lo sviluppo locale usa l’archiviazione locale delle storie. In questo ambiente non serve accedere.', signIn: 'Accedi', createAccount: 'Crea account', signedIn: 'Accesso effettuato', savedStories: 'Vai alle storie salvate', signOut: 'Esci', email: 'Email', password: 'Password',
    welcomeEyebrow: 'Piccole avventure. Significati personali.', homeTitle: 'Una storia in cui perdersi.', homeGiftTitle: 'Una storia regalo da ricordare.', homeSubtitle: 'Muse trasforma ricordi, interessi e relazioni in storie da costruire insieme.', homeMyself: 'Io', homeJustForYou: 'Solo per te', homeForSomeone: 'Per qualcun altro', homeCreatePersonal: 'Le mie storie', homeCreatePersonalHelp: 'Scegli come vuoi sentirti e scrivi o racconta le tue scelte mentre Muse crea la tua avventura.', homeOpenPersonal: 'Apri Le mie storie', homeShareTogether: 'Condividi una storia e gioca insieme', homeShareHelp: 'Crea una storia interattiva e invia al gruppo un link privato. Invita membri Muse e ospiti a condividere i progressi e alternarsi da dispositivi diversi.', homeCreateGift: 'Crea e condividi una storia', sample: 'Prova un esempio di 2 minuti', sampleNote: 'Gratis, creato a mano, senza account.'
  },
  'es-ES': {
    navHome: 'Inicio', navMyself: 'Yo', navMyStories: 'Mis historias', navCreateGift: 'Crear una historia de regalo', navArchive: 'Archivo', navSettings: 'Ajustes', museHome: 'Inicio de Muse',
    settingsEyebrow: 'Tus preferencias de Muse', settingsTitle: 'Ajustes', settingsSubtitle: 'Gestiona tu cuenta, perfil, idioma y notificaciones.',
    profileHeading: 'Tu perfil', profileNameLabel: 'Tu nombre', profileNameHelp: 'Se usa como tu nombre al crear historias compartidas y participar en historias cooperativas.', saveProfile: 'Guardar nombre', profileSaved: 'Tu nombre se ha guardado.',
    languageHeading: 'Idioma de Muse', interfaceLanguageLabel: 'Idioma de la interfaz', interfaceLanguageHelp: 'Cambia la navegación, Inicio y Ajustes, además de los títulos y acciones principales de Yo, Mis historias, Archivo y las pantallas de creación. Algunos detalles de formularios, ayudas, estados y textos del lector pueden seguir en inglés. El inglés es el idioma predeterminado.', storyLanguageLabel: 'Idioma predeterminado de las historias', storyLanguageHelp: 'Establece el idioma para generar historias nuevas. Cada historia puede usar otro idioma.', languageSaved: 'Preferencia de idioma guardada.',
    notificationsHeading: 'Notificaciones de historias compartidas', notificationsHelp: 'Si están activadas, Muse puede avisarte en este navegador cuando alguien abra una historia compartida, alcance un hito o la complete. Se comprueban mientras Muse está abierto y has iniciado sesión; no son correos ni notificaciones push.', notificationsEnabled: 'Activar notificaciones dentro de Muse',
    accountHeading: 'Cuenta', accountHelp: 'Inicia sesión para crear y gestionar tus historias.', localAccount: 'El desarrollo local usa almacenamiento local de historias. No es necesario iniciar sesión en este entorno.', signIn: 'Iniciar sesión', createAccount: 'Crear cuenta', signedIn: 'Has iniciado sesión', savedStories: 'Ir a historias guardadas', signOut: 'Cerrar sesión', email: 'Correo electrónico', password: 'Contraseña',
    welcomeEyebrow: 'Pequeñas aventuras. Significado personal.', homeTitle: 'Una historia para perderse.', homeGiftTitle: 'Una historia-regalo para recordar.', homeSubtitle: 'Muse convierte tus recuerdos, intereses y relaciones en historias que podéis seguir creando juntos.', homeMyself: 'Yo', homeJustForYou: 'Solo para ti', homeForSomeone: 'Para otra persona', homeCreatePersonal: 'Mis historias', homeCreatePersonalHelp: 'Elige cómo quieres sentirte y escribe o dicta tus decisiones mientras Muse crea tu aventura personal.', homeOpenPersonal: 'Abrir Mis historias', homeShareTogether: 'Comparte una historia y jugad juntos', homeShareHelp: 'Crea una historia interactiva y envía un enlace privado al grupo. Invita a miembros de Muse y a invitados a compartir el progreso y turnarse desde distintos dispositivos.', homeCreateGift: 'Crear y compartir una historia', sample: 'Prueba una muestra de 2 minutos', sampleNote: 'Gratis, creada a mano y sin cuenta.'
  },
  'zh-CN': {
    navHome: '首页', navMyself: '自我', navMyStories: '我的故事', navCreateGift: '创建礼物故事', navArchive: '故事库', navSettings: '设置', museHome: 'Muse 首页',
    settingsEyebrow: 'Muse 偏好设置', settingsTitle: '设置', settingsSubtitle: '管理账户、个人资料、语言和通知偏好。',
    profileHeading: '个人资料', profileNameLabel: '你的名字', profileNameHelp: '创建共享故事或参与合作故事时会使用此名称。', saveProfile: '保存姓名', profileSaved: '姓名已保存。',
    languageHeading: 'Muse 语言', interfaceLanguageLabel: '界面语言', interfaceLanguageHelp: '更改导航、首页、设置以及关于我、我的故事、档案和故事创建页面的主要标题与操作。部分表单详情、帮助、状态和阅读器文字可能仍为英语。英语为默认语言。', storyLanguageLabel: '默认故事语言', storyLanguageHelp: '设置新故事生成时使用的语言。每个故事也可使用其他语言。', languageSaved: '语言偏好已保存。',
    notificationsHeading: '共享故事通知', notificationsHelp: '启用后，当有人打开共享故事、达到进度节点或完成故事时，Muse 会在此浏览器中通知你。Muse 页面保持打开且你已登录时会检查通知；这不是电子邮件或浏览器推送通知。', notificationsEnabled: '启用 Muse 内的共享故事通知',
    accountHeading: '账户', accountHelp: '登录以创建和管理故事。', localAccount: '本地开发使用本地故事存储。在此开发环境中无需登录。', signIn: '登录', createAccount: '创建账户', signedIn: '已登录', savedStories: '查看已保存的故事', signOut: '退出登录', email: '电子邮箱', password: '密码',
    welcomeEyebrow: '小小冒险，个人意义。', homeTitle: '沉浸于一个故事。', homeGiftTitle: '一份令人难忘的故事礼物。', homeSubtitle: 'Muse 将回忆、兴趣和关系变成可以一起续写的故事。', homeMyself: '自我', homeJustForYou: '只为你', homeForSomeone: '送给某人', homeCreatePersonal: '我的故事', homeCreatePersonalHelp: '选择你想感受的心情，然后写下或说出选择，让 Muse 为你构建专属冒险。', homeOpenPersonal: '打开我的故事', homeShareTogether: '分享故事，一起游玩', homeShareHelp: '创建互动故事并发送私人链接。邀请 Muse 成员和访客在不同设备上共享进度、轮流行动。', homeCreateGift: '创建并分享故事', sample: '体验 2 分钟示例', sampleNote: '免费、手工制作，无需账户。'
  },
  'hi-IN': {
    navHome: 'होम', navMyself: 'मैं', navMyStories: 'मेरी कहानियाँ', navCreateGift: 'उपहार कहानी बनाएँ', navArchive: 'संग्रह', navSettings: 'सेटिंग्स', museHome: 'Muse होम',
    settingsEyebrow: 'आपकी Muse प्राथमिकताएँ', settingsTitle: 'सेटिंग्स', settingsSubtitle: 'अपना खाता, प्रोफ़ाइल, भाषा और सूचनाएँ प्रबंधित करें।',
    profileHeading: 'आपकी प्रोफ़ाइल', profileNameLabel: 'आपका नाम', profileNameHelp: 'साझा कहानी बनाने और सहयोगी कहानियों में भाग लेने पर यही नाम दिखेगा।', saveProfile: 'नाम सहेजें', profileSaved: 'आपका नाम सहेज लिया गया है।',
    languageHeading: 'Muse भाषा', interfaceLanguageLabel: 'इंटरफ़ेस भाषा', interfaceLanguageHelp: 'नेविगेशन, होम और सेटिंग्स के साथ मेरे बारे में, मेरी कहानियाँ, संग्रह और कहानी-निर्माण स्क्रीन के मुख्य शीर्षक व क्रियाएँ बदलें। फ़ॉर्म के कुछ विवरण, सहायता, स्थिति और कहानी-पाठक के शब्द अंग्रेज़ी में रह सकते हैं। डिफ़ॉल्ट भाषा अंग्रेज़ी है।', storyLanguageLabel: 'डिफ़ॉल्ट कहानी भाषा', storyLanguageHelp: 'नई कहानियाँ बनाने की भाषा चुनें। हर कहानी में दूसरी भाषा भी चुनी जा सकती है।', languageSaved: 'भाषा प्राथमिकता सहेजी गई।',
    notificationsHeading: 'साझा कहानी सूचनाएँ', notificationsHelp: 'चालू होने पर, कोई साझा कहानी खोलता है, प्रगति का पड़ाव पार करता है या उसे पूरा करता है तो Muse इस ब्राउज़र में सूचना दे सकता है। Muse खुला रहने और आपके साइन इन होने पर जाँच होती है; ये ईमेल या पुश सूचनाएँ नहीं हैं।', notificationsEnabled: 'Muse के भीतर साझा कहानी सूचनाएँ चालू करें',
    accountHeading: 'खाता', accountHelp: 'कहानियाँ बनाने और प्रबंधित करने के लिए साइन इन करें।', localAccount: 'स्थानीय विकास में स्थानीय कहानी संग्रह का उपयोग होता है। इस वातावरण में साइन इन आवश्यक नहीं है।', signIn: 'साइन इन', createAccount: 'खाता बनाएँ', signedIn: 'आप साइन इन हैं', savedStories: 'सहेजी कहानियाँ देखें', signOut: 'साइन आउट', email: 'ईमेल', password: 'पासवर्ड',
    welcomeEyebrow: 'छोटे रोमांच। निजी मायने।', homeTitle: 'एक कहानी जिसमें खो जाएँ।', homeGiftTitle: 'याद रहने वाली उपहार कहानी।', homeSubtitle: 'Muse आपकी यादों, रुचियों और रिश्तों को ऐसी कहानियों में बदलता है जिन्हें आप साथ मिलकर आगे बढ़ा सकते हैं।', homeMyself: 'मैं', homeJustForYou: 'सिर्फ़ आपके लिए', homeForSomeone: 'किसी और के लिए', homeCreatePersonal: 'मेरी कहानियाँ', homeCreatePersonalHelp: 'अपनी मनचाही भावना चुनें और Muse के साथ अपनी निजी कहानी बनाने के लिए लिखें या बोलें।', homeOpenPersonal: 'मेरी कहानियाँ खोलें', homeShareTogether: 'कहानी साझा करें और साथ खेलें', homeShareHelp: 'इंटरैक्टिव कहानी बनाएँ और समूह को निजी लिंक भेजें। Muse सदस्यों और मेहमानों को अलग-अलग डिवाइस से प्रगति साझा करने और बारी लेने के लिए आमंत्रित करें।', homeCreateGift: 'कहानी बनाएँ और साझा करें', sample: '2 मिनट का नमूना आज़माएँ', sampleNote: 'मुफ़्त, हाथ से बनाया गया, खाता आवश्यक नहीं।'
  },
  'uk-UA': {
    navHome: 'Головна', navMyself: 'Я', navMyStories: 'Мої історії', navCreateGift: 'Створити історію-подарунок', navArchive: 'Архів', navSettings: 'Налаштування', museHome: 'Головна Muse',
    settingsEyebrow: 'Ваші налаштування Muse', settingsTitle: 'Налаштування', settingsSubtitle: 'Керуйте обліковим записом, профілем, мовою та сповіщеннями.',
    profileHeading: 'Ваш профіль', profileNameLabel: 'Ваше ім’я', profileNameHelp: 'Це ім’я використовуватиметься під час створення спільної історії та участі в кооперативних історіях.', saveProfile: 'Зберегти ім’я', profileSaved: 'Ваше ім’я збережено.',
    languageHeading: 'Мова Muse', interfaceLanguageLabel: 'Мова інтерфейсу', interfaceLanguageHelp: 'Змінює навігацію, головну сторінку й налаштування, а також основні заголовки та дії в розділах «Про мене», «Мої історії», «Архів» і на екранах створення. Деякі деталі форм, довідка, статуси та текст читача можуть залишатися англійською. Типово використовується англійська.', storyLanguageLabel: 'Мова нових історій', storyLanguageHelp: 'Мова для створення нових історій. Для кожної історії можна вибрати іншу мову.', languageSaved: 'Мовні налаштування збережено.',
    notificationsHeading: 'Сповіщення про спільні історії', notificationsHelp: 'Якщо ввімкнено, Muse сповіщатиме в цьому браузері, коли хтось відкриє спільну історію, досягне етапу або завершить її. Перевірка відбувається, коли Muse відкрита і ви ввійшли в обліковий запис; це не електронна пошта й не push-сповіщення.', notificationsEnabled: 'Увімкнути сповіщення в Muse',
    accountHeading: 'Обліковий запис', accountHelp: 'Увійдіть, щоб створювати історії та керувати ними.', localAccount: 'Локальне середовище розробки використовує локальне сховище історій. Вхід тут не потрібен.', signIn: 'Увійти', createAccount: 'Створити обліковий запис', signedIn: 'Ви ввійшли', savedStories: 'Перейти до збережених історій', signOut: 'Вийти', email: 'Електронна пошта', password: 'Пароль',
    welcomeEyebrow: 'Невеликі пригоди. Особливий сенс.', homeTitle: 'Історія, у якій можна загубитися.', homeGiftTitle: 'Історія-подарунок, яку пам’ятатимуть.', homeSubtitle: 'Muse перетворює спогади, інтереси та стосунки на історії, які можна розвивати разом.', homeMyself: 'Я', homeJustForYou: 'Лише для вас', homeForSomeone: 'Для когось іншого', homeCreatePersonal: 'Мої історії', homeCreatePersonalHelp: 'Оберіть настрій, а потім пишіть або промовляйте рішення, поки Muse створює вашу пригоду.', homeOpenPersonal: 'Відкрити мої історії', homeShareTogether: 'Поділіться історією та грайте разом', homeShareHelp: 'Створіть інтерактивну історію та надішліть групі приватне посилання. Запросіть учасників Muse і гостей спільно проходити історію та ходити по черзі з різних пристроїв.', homeCreateGift: 'Створити й поширити історію', sample: 'Спробувати 2-хвилинний приклад', sampleNote: 'Безкоштовно, створено вручну, без облікового запису.'
  },
  'ar-SA': {
    navHome: 'الرئيسية', navMyself: 'أنا', navMyStories: 'قصصي', navCreateGift: 'أنشئ قصة كهدية', navArchive: 'الأرشيف', navSettings: 'الإعدادات', museHome: 'الصفحة الرئيسية لـ Muse',
    settingsEyebrow: 'تفضيلات Muse الخاصة بك', settingsTitle: 'الإعدادات', settingsSubtitle: 'أدر حسابك وملفك الشخصي ولغتك وإشعاراتك.',
    profileHeading: 'ملفك الشخصي', profileNameLabel: 'اسمك', profileNameHelp: 'يُستخدم هذا الاسم عند إنشاء قصة مشتركة والمشاركة في القصص التعاونية.', saveProfile: 'حفظ الاسم', profileSaved: 'تم حفظ اسمك.',
    languageHeading: 'لغة Muse', interfaceLanguageLabel: 'لغة الواجهة', interfaceLanguageHelp: 'تغيّر لغة التنقل والصفحة الرئيسية والإعدادات والعناوين والإجراءات الأساسية في نبذة عني وقصصي والأرشيف وشاشات إنشاء القصص. قد تبقى بعض تفاصيل النماذج والمساعدة والحالات ونصوص قارئ القصص بالإنجليزية. الإنجليزية هي الافتراضية.', storyLanguageLabel: 'لغة القصص الافتراضية', storyLanguageHelp: 'تحدد اللغة المستخدمة لإنشاء القصص الجديدة. ويمكن اختيار لغة أخرى لكل قصة.', languageSaved: 'تم حفظ تفضيل اللغة.',
    notificationsHeading: 'إشعارات القصص المشتركة', notificationsHelp: 'عند التفعيل، يمكن لـ Muse إشعارك في هذا المتصفح عندما يفتح شخص قصة مشتركة أو يصل إلى مرحلة تقدم أو يكملها. يتم التحقق من الإشعارات عندما يكون Muse مفتوحًا وأنت مسجل الدخول؛ وهي ليست بريدًا إلكترونيًا أو إشعارات دفع.', notificationsEnabled: 'تفعيل إشعارات القصص داخل Muse',
    accountHeading: 'الحساب', accountHelp: 'سجّل الدخول لإنشاء قصصك وإدارتها.', localAccount: 'يستخدم التطوير المحلي تخزين القصص المحلي. لا يلزم تسجيل الدخول في بيئة التطوير هذه.', signIn: 'تسجيل الدخول', createAccount: 'إنشاء حساب', signedIn: 'تم تسجيل الدخول', savedStories: 'الانتقال إلى القصص المحفوظة', signOut: 'تسجيل الخروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    welcomeEyebrow: 'مغامرات صغيرة. معنى شخصي.', homeTitle: 'قصة تأخذك إلى عالمها.', homeGiftTitle: 'قصة هدية لا تُنسى.', homeSubtitle: 'يحوّل Muse ذكرياتك واهتماماتك وعلاقاتك إلى قصص يمكنك مواصلتها معًا.', homeMyself: 'أنا', homeJustForYou: 'لك وحدك', homeForSomeone: 'لشخص آخر', homeCreatePersonal: 'قصصي', homeCreatePersonalHelp: 'اختر ما تريد أن تشعر به، ثم اكتب اختياراتك أو أمْلِها بينما يبني Muse مغامرتك الشخصية.', homeOpenPersonal: 'افتح قصصي', homeShareTogether: 'شارك قصة والعبوا معًا', homeShareHelp: 'أنشئ قصة تفاعلية وأرسل لمجموعتك رابطًا خاصًا. ادعُ أعضاء Muse والضيوف لمشاركة التقدم وتبادل الأدوار عبر أجهزتهم.', homeCreateGift: 'أنشئ قصة وشاركها', sample: 'جرّب عينة لمدة دقيقتين', sampleNote: 'مجانية ومصنوعة يدويًا ولا تتطلب حسابًا.'
  }
}

export function loadInterfaceLanguage(): StoryLanguageCode {
  if (typeof window === 'undefined') return 'en-US'
  const saved = window.localStorage.getItem(INTERFACE_LANGUAGE_KEY)
  return STORY_LANGUAGES.some(language => language.code === saved) ? saved as StoryLanguageCode : 'en-US'
}

export function saveInterfaceLanguage(value: string): StoryLanguageCode {
  if (!STORY_LANGUAGES.some(language => language.code === value)) throw new Error('Choose a supported Muse interface language.')
  const language = value as StoryLanguageCode
  window.localStorage.setItem(INTERFACE_LANGUAGE_KEY, language)
  window.dispatchEvent(new Event(INTERFACE_LANGUAGE_CHANGE_EVENT))
  return language
}

export function interfaceText(key: InterfaceCopyKey, language: StoryLanguageCode): string {
  return copies[language][key]
}

export function useInterfaceLanguage(): StoryLanguageCode {
  const [language, setLanguage] = useState<StoryLanguageCode>('en-US')
  useEffect(() => {
    const update = () => {
      try {
        const next = loadInterfaceLanguage()
        setLanguage(next)
        const definition = STORY_LANGUAGES.find(option => option.code === next)!
        document.documentElement.lang = next
        document.documentElement.dir = definition.dir
      } catch {
        setLanguage('en-US')
      }
    }
    update()
    window.addEventListener('storage', update)
    window.addEventListener(INTERFACE_LANGUAGE_CHANGE_EVENT, update)
    return () => {
      window.removeEventListener('storage', update)
      window.removeEventListener(INTERFACE_LANGUAGE_CHANGE_EVENT, update)
    }
  }, [])
  return language
}
