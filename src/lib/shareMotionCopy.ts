import type { StoryLanguageCode } from './storyLanguage'

const english = {
  automatic: 'A highlight, ready for you.',
  notice: 'Muse has selected a passage from your latest saved scene and matched the style to your story. Review it for personal details before sharing. Nothing is posted automatically.',
  customize: 'Customize this highlight',
  regenerate: 'Prepare a fresh highlight',
  animate: 'Create animated preview',
  creating: 'Creating your clip — keep this tab open',
  cancel: 'Cancel',
  cancelled: 'Clip cancelled. Your card is still here.',
  download: 'Download animated clip',
  share: 'Share animated clip',
  ready: 'Play the clip below before sharing. It has no audio.',
  unsupported: 'This browser cannot create a video clip. You can still download the image, or try a current Safari or Chrome browser.',
  error: 'Could not create the clip. Keep this tab visible and try again, or download the still image.',
  fileUnsupported: 'This browser cannot share video files directly. Download the clip and upload it in your social app.',
  note: 'Your short clip is prepared automatically with drifting light, golden sparkles and flowing lines. MP4 is preferred; some browsers export WebM, which not all social apps accept. Still PNG images are also available. All rendering stays on this device.',
  downloaded: 'Clip downloaded. Upload it in your favourite social app.',
  video: 'Animated story highlight'
}
type Copy = Record<keyof typeof english, string>
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': english,
  'it-IT': {
    automatic: 'Un momento speciale, pronto per te.',
    notice: 'Muse ha scelto un passaggio dalla tua ultima scena salvata e uno stile abbinato alla storia. Controlla i dettagli personali prima di condividerlo. Non viene pubblicato nulla automaticamente.',
    customize: 'Personalizza questo ricordo', regenerate: 'Prepara un nuovo ricordo',
    animate: 'Crea anteprima animata', creating: 'Creazione del video — tieni aperta questa scheda',
    cancel: 'Annulla', cancelled: 'Video annullato. La scheda è ancora qui.',
    download: 'Scarica il video animato', share: 'Condividi il video animato',
    ready: 'Guarda il video qui sotto prima di condividerlo. Non contiene audio.',
    unsupported: 'Questo browser non può creare video. Puoi scaricare l’immagine o provare una versione recente di Safari o Chrome.',
    error: 'Impossibile creare il video. Mantieni visibile questa scheda e riprova, oppure scarica l’immagine statica.',
    fileUnsupported: 'Questo browser non può condividere direttamente video. Scaricalo e caricalo nella tua app social.',
    note: 'Il breve video viene preparato automaticamente con luce in movimento, scintille dorate e linee fluide. Preferiamo MP4; alcuni browser esportano WebM, non accettato da tutte le app. Puoi anche scaricare immagini PNG statiche. Tutto viene elaborato sul dispositivo.',
    downloaded: 'Video scaricato. Caricalo nella tua app social preferita.', video: 'Ricordo animato della storia'
  },
  'es-ES': {
    automatic: 'Un momento especial, listo para ti.',
    notice: 'Muse ha elegido un pasaje de tu última escena guardada y un estilo para tu historia. Revisa los datos personales antes de compartir. Nada se publica automáticamente.',
    customize: 'Personalizar este recuerdo', regenerate: 'Preparar un nuevo recuerdo',
    animate: 'Crear vista animada', creating: 'Creando el vídeo — mantén esta pestaña abierta',
    cancel: 'Cancelar', cancelled: 'Vídeo cancelado. Tu tarjeta sigue aquí.',
    download: 'Descargar vídeo animado', share: 'Compartir vídeo animado',
    ready: 'Reproduce el vídeo antes de compartirlo. No tiene audio.',
    unsupported: 'Este navegador no puede crear vídeo. Descarga la imagen o prueba Safari o Chrome actualizado.',
    error: 'No se pudo crear el vídeo. Mantén visible la pestaña y reinténtalo, o descarga la imagen.',
    fileUnsupported: 'Este navegador no puede compartir vídeos directamente. Descarga el archivo y súbelo a tu aplicación.',
    note: 'El vídeo corto se prepara automáticamente con luz flotante, destellos dorados y líneas fluidas. Se prefiere MP4; algunos navegadores exportan WebM, no admitido por todas las aplicaciones. También hay imágenes PNG. Todo se procesa en este dispositivo.',
    downloaded: 'Vídeo descargado. Súbelo a tu aplicación favorita.', video: 'Recuerdo animado de la historia'
  },
  'zh-CN': {
    automatic: '已为你准备好精彩片刻。',
    notice: 'Muse 已从最新保存的场景中选取片段，并搭配故事风格。分享前请检查个人信息。不会自动发布。',
    customize: '自定义此片刻', regenerate: '重新准备片刻', animate: '生成动画预览',
    creating: '正在生成短片，请保持此标签页打开', cancel: '取消', cancelled: '短片已取消，卡片仍然保留。',
    download: '下载动画短片', share: '分享动画短片', ready: '分享前请播放下方短片。短片无音频。',
    unsupported: '此浏览器无法生成视频。你仍可下载图片，或尝试新版 Safari 或 Chrome。',
    error: '无法生成短片。请保持标签页可见并重试，或下载静态图片。',
    fileUnsupported: '此浏览器无法直接分享视频文件。请下载后上传到社交应用。',
    note: '自动生成带有流光、金色星点和流动线条的短片。优先使用 MP4；部分浏览器导出 WebM，并非所有应用都支持。也可下载静态 PNG 图片。所有处理均在本机进行。',
    downloaded: '短片已下载。可上传到喜欢的社交应用。', video: '故事动画片刻'
  },
  'hi-IN': {
    automatic: 'आपके लिए एक खास पल तैयार है।',
    notice: 'Muse ने आपके नवीनतम सहेजे दृश्य से अंश और कहानी से मेल खाती शैली चुनी है। साझा करने से पहले निजी जानकारी जाँचें। कुछ भी अपने आप पोस्ट नहीं होता।',
    customize: 'इस पल को बदलें', regenerate: 'नया पल तैयार करें', animate: 'एनिमेटेड पूर्वावलोकन बनाएँ',
    creating: 'क्लिप बन रही है — यह टैब खुला रखें', cancel: 'रद्द करें', cancelled: 'क्लिप रद्द हुई। आपका कार्ड सुरक्षित है।',
    download: 'एनिमेटेड क्लिप डाउनलोड करें', share: 'एनिमेटेड क्लिप साझा करें', ready: 'साझा करने से पहले नीचे क्लिप चलाएँ। इसमें आवाज़ नहीं है।',
    unsupported: 'यह ब्राउज़र वीडियो नहीं बना सकता। चित्र डाउनलोड करें या नया Safari या Chrome आज़माएँ।',
    error: 'क्लिप नहीं बन सकी। टैब दिखाई देते हुए फिर कोशिश करें या स्थिर चित्र डाउनलोड करें।',
    fileUnsupported: 'यह ब्राउज़र वीडियो सीधे साझा नहीं कर सकता। क्लिप डाउनलोड करके सोशल ऐप में डालें।',
    note: 'तैरती रोशनी, सुनहरी चमक और बहती रेखाओं की छोटी क्लिप अपने आप तैयार होती है। MP4 को प्राथमिकता है; कुछ ब्राउज़र WebM बनाते हैं, जिसे सभी ऐप नहीं लेते। स्थिर PNG भी उपलब्ध है। सब इसी डिवाइस पर होता है।',
    downloaded: 'क्लिप डाउनलोड हुई। इसे अपने पसंदीदा सोशल ऐप में डालें।', video: 'कहानी का एनिमेटेड पल'
  },
  'uk-UA': {
    automatic: 'Особлива мить уже готова.',
    notice: 'Muse вибрав уривок з останньої збереженої сцени та стиль для історії. Перевірте особисті дані перед поширенням. Нічого не публікується автоматично.',
    customize: 'Налаштувати цю мить', regenerate: 'Підготувати нову мить', animate: 'Створити анімований перегляд',
    creating: 'Створення кліпу — тримайте вкладку відкритою', cancel: 'Скасувати', cancelled: 'Кліп скасовано. Картка збережена.',
    download: 'Завантажити анімований кліп', share: 'Поширити анімований кліп', ready: 'Перегляньте кліп перед поширенням. Він без звуку.',
    unsupported: 'Цей браузер не може створити відео. Завантажте зображення або спробуйте сучасний Safari чи Chrome.',
    error: 'Не вдалося створити кліп. Залиште вкладку видимою й повторіть або завантажте зображення.',
    fileUnsupported: 'Браузер не підтримує поширення відеофайлів. Завантажте кліп і додайте в соціальний застосунок.',
    note: 'Короткий кліп із рухомим світлом, золотими іскрами та плавними лініями готується автоматично. Перевага MP4; деякі браузери створюють WebM, який приймають не всі застосунки. Доступний також PNG. Усе обробляється на пристрої.',
    downloaded: 'Кліп завантажено. Додайте його до соціального застосунку.', video: 'Анімована мить історії'
  },
  'ar-SA': {
    automatic: 'لحظة مميزة جاهزة لك.',
    notice: 'اختار Muse مقطعًا من أحدث مشهد محفوظ ونمطًا يناسب قصتك. راجع التفاصيل الشخصية قبل المشاركة. لا يُنشر أي شيء تلقائيًا.',
    customize: 'تخصيص هذه اللحظة', regenerate: 'إعداد لحظة جديدة', animate: 'إنشاء معاينة متحركة',
    creating: 'جارٍ إنشاء المقطع — أبقِ علامة التبويب مفتوحة', cancel: 'إلغاء', cancelled: 'أُلغي المقطع. بطاقتك ما زالت هنا.',
    download: 'تنزيل المقطع المتحرك', share: 'مشاركة المقطع المتحرك', ready: 'شاهد المقطع أدناه قبل مشاركته. لا يحتوي على صوت.',
    unsupported: 'لا يمكن لهذا المتصفح إنشاء فيديو. نزّل الصورة أو جرّب إصدارًا حديثًا من Safari أو Chrome.',
    error: 'تعذر إنشاء المقطع. أبقِ علامة التبويب ظاهرة وحاول مجددًا أو نزّل الصورة الثابتة.',
    fileUnsupported: 'لا يدعم المتصفح مشاركة الفيديو مباشرة. نزّل المقطع وارفعه في تطبيقك الاجتماعي.',
    note: 'يُجهّز مقطع قصير تلقائيًا بالضوء المتحرك واللمعان الذهبي والخطوط الانسيابية. نفضّل MP4؛ تصدّر بعض المتصفحات WebM الذي لا تقبله كل التطبيقات. تتوفر أيضًا صور PNG ثابتة. كل المعالجة محلية.',
    downloaded: 'تم تنزيل المقطع. ارفعه إلى تطبيقك الاجتماعي المفضل.', video: 'لحظة متحركة من القصة'
  }
}
export const shareMotionCopy = (language: StoryLanguageCode) => copies[language]
