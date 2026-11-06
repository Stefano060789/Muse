import type { StoryLanguageCode } from './storyLanguage'

const english = {
  title: 'AI providers and processing purpose',
  body: 'Story creation and continuation sends the submitted story brief, responses or actions, and any selected personal memories to the server-configured story AI provider (Anthropic by default; OpenAI or Groq can be configured) to generate story content. Optional cloud narration sends selected story text, or prepared scene titles, text and clues, to Google Cloud Text-to-Speech only when Google mode, server credentials, a budget, storage and the required permission are configured. Browser/device narration does not use Muse’s cloud narration endpoint; platform speech handling may vary. Prerecorded demo playback sends no story text. ElevenLabs narration and Runway video generation/provider requests are disabled pending commercial entitlement review; Muse does not send data to those providers. Previously saved private recordings, jobs and clips are not removed.'
}

const copies: Record<StoryLanguageCode, typeof english> = {
  'en-US': english,
  'it-IT': {
    title: 'Fornitori IA e finalità del trattamento',
    body: 'La creazione e la continuazione di una storia inviano la descrizione, le risposte o le azioni inserite e gli eventuali ricordi personali selezionati al fornitore IA configurato sul server (Anthropic per impostazione predefinita; è possibile configurare OpenAI o Groq) per generare il contenuto. La narrazione cloud facoltativa invia il testo selezionato o titoli, testi e indizi delle scene preparate a Google Cloud Text-to-Speech solo quando sono configurati la modalità Google, le credenziali server, un budget, l’archiviazione e il permesso richiesto. La voce del browser/dispositivo non usa l’endpoint cloud di Muse; il trattamento della piattaforma può variare. La riproduzione demo preregistrata non invia testo della storia. La narrazione ElevenLabs e le richieste di generazione video/provider Runway sono disabilitate in attesa della verifica dei diritti commerciali; Muse non invia dati a questi provider. Registrazioni, lavori e video privati già salvati non vengono rimossi.'
  },
  'es-ES': {
    title: 'Proveedores de IA y finalidad del tratamiento',
    body: 'Al crear o continuar una historia, el resumen, las respuestas o acciones enviadas y los recuerdos personales seleccionados se envían al proveedor de IA configurado en el servidor (Anthropic de forma predeterminada; se puede configurar OpenAI o Groq) para generar contenido. La voz opcional en la nube envía el texto seleccionado o los títulos, textos y pistas de escenas preparadas a Google Cloud Text-to-Speech solo si están configurados el modo Google, las credenciales del servidor, un presupuesto, el almacenamiento y el permiso requerido. La voz del navegador/dispositivo no usa el endpoint en la nube de Muse; el tratamiento de la plataforma puede variar. La reproducción de la demo pregrabada no envía texto de la historia. La narración de ElevenLabs y las solicitudes de generación/proveedor de vídeo Runway están desactivadas mientras se revisan los derechos comerciales; Muse no envía datos a esos proveedores. No se eliminan grabaciones, trabajos ni vídeos privados ya guardados.'
  },
  'zh-CN': {
    title: 'AI 服务商与处理目的',
    body: '创建或继续故事时，提交的故事说明、回答或操作以及所选个人记忆会发送至服务器配置的故事 AI 服务商（默认 Anthropic；也可配置 OpenAI 或 Groq）以生成故事内容。只有在配置 Google 模式、服务器凭据、预算、存储并取得所需许可时，可选云端旁白才会将所选故事文本或预制场景标题、正文和线索发送至 Google Cloud Text-to-Speech。浏览器/设备旁白不使用 Muse 云端旁白接口；平台如何处理语音可能有所不同。播放预录演示不会发送故事文本。ElevenLabs 旁白和 Runway 视频生成/服务请求已停用，等待商业授权审查；Muse 不会向这些服务商发送数据。不会删除以前保存的私人录音、任务或视频。'
  },
  'hi-IN': {
    title: 'AI प्रदाता और डेटा संसाधन का उद्देश्य',
    body: 'कहानी बनाने या आगे बढ़ाने के लिए भेजा गया विवरण, जवाब या गतिविधियाँ और चुनी गई निजी यादें कहानी सामग्री बनाने हेतु सर्वर पर कॉन्फ़िगर AI प्रदाता (डिफ़ॉल्ट रूप से Anthropic; OpenAI या Groq भी कॉन्फ़िगर किए जा सकते हैं) को भेजी जाती हैं। वैकल्पिक क्लाउड वाचन में चुना कहानी-पाठ या तैयार दृश्यों के शीर्षक, पाठ और संकेत Google Cloud Text-to-Speech को केवल तभी भेजे जाते हैं जब Google मोड, सर्वर क्रेडेंशियल, बजट, स्टोरेज और आवश्यक अनुमति कॉन्फ़िगर हों। ब्राउज़र/डिवाइस वाचन Muse के क्लाउड एंडपॉइंट का उपयोग नहीं करता; प्लेटफ़ॉर्म का प्रसंस्करण अलग हो सकता है। पहले से रिकॉर्ड किए गए डेमो को सुनने पर कहानी-पाठ नहीं भेजा जाता। ElevenLabs वाचन और Runway वीडियो निर्माण/प्रदाता अनुरोध व्यावसायिक पात्रता समीक्षा तक बंद हैं; Muse इन प्रदाताओं को डेटा नहीं भेजता। पहले से सहेजी निजी रिकॉर्डिंग, कार्य और वीडियो नहीं हटाए जाते।'
  },
  'uk-UA': {
    title: 'Постачальники ШІ та мета обробки',
    body: 'Для створення або продовження історії на сервер налаштованому постачальнику ШІ (Anthropic за замовчуванням; можна налаштувати OpenAI або Groq) надсилаються поданий опис, відповіді чи дії та вибрані особисті спогади, щоб згенерувати текст. Необов’язкове хмарне озвучення надсилає вибраний текст історії або назви, тексти й підказки підготовлених сцен до Google Cloud Text-to-Speech лише за налаштованих режиму Google, серверних облікових даних, бюджету, сховища та потрібного дозволу. Озвучення браузера/пристрою не використовує хмарний endpoint Muse; обробка платформою може відрізнятися. Відтворення попередньо записаного демо не надсилає текст історії. Озвучення ElevenLabs і запити генерації відео/постачальника Runway вимкнені до перевірки комерційних прав; Muse не надсилає цим постачальникам дані. Раніше збережені приватні записи, завдання й відео не видаляються.'
  },
  'ar-SA': {
    title: 'موفرو الذكاء الاصطناعي وغرض المعالجة',
    body: 'عند إنشاء قصة أو متابعتها، يُرسل ملخص القصة والإجابات أو الإجراءات المقدمة والذكريات الشخصية المحددة إلى موفر الذكاء الاصطناعي المهيأ على الخادم (Anthropic افتراضياً؛ ويمكن تهيئة OpenAI أو Groq) لإنشاء محتوى القصة. لا يرسل السرد السحابي الاختياري النص المحدد أو عناوين المشاهد المعدة ونصوصها وتلميحاتها إلى Google Cloud Text-to-Speech إلا عند تهيئة وضع Google وبيانات اعتماد الخادم والميزانية والتخزين والإذن المطلوب. لا يستخدم سرد المتصفح/الجهاز نقطة Muse السحابية؛ وقد تختلف معالجة المنصة. لا يرسل تشغيل العرض التجريبي المسجل مسبقاً نص القصة. تم تعطيل سرد ElevenLabs وطلبات إنشاء الفيديو/الموفر Runway إلى حين مراجعة الاستحقاق التجاري؛ ولا يرسل Muse بيانات إلى هذين الموفرين. لا تُحذف التسجيلات والمهام ومقاطع الفيديو الخاصة المحفوظة سابقاً.'
  }
}

export const providerStatusCopy = (language: StoryLanguageCode) => copies[language]
