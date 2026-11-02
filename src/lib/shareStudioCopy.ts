import type { StoryLanguageCode } from './storyLanguage'

const english = {
  intro: 'A little proof of how far you have come.',
  privacy: 'Only the title, progress and words you choose below appear on your card. Check for personal details before sharing. Editing and downloading stay on this device and use no AI allowance.',
  passage: 'A moment worth keeping',
  scene: 'Choose a saved scene',
  noPassage: 'Progress only',
  reflection: 'What will you take with you? (optional)',
  style: 'Card style',
  format: 'Social format',
  starlight: 'Starlight',
  paper: 'Paper & ink',
  dawn: 'First light',
  portrait: 'Feed · 4:5',
  story: 'Story · 9:16',
  square: 'Square · 1:1',
  preview: 'Your share preview',
  previewButton: 'Preview before sharing',
  backToEdit: 'Back to editing',
  captionPreview: 'Caption shared with other apps',
  previewNote: 'Preview has gentle animation. Downloads are still PNG images, ready to upload to your favourite app.',
  chapter: 'Chapter {number}',
  scenes: '{number} scenes saved',
  complete: 'Chapter complete',
  active: 'My story so far',
  downloaded: 'Image downloaded. Add it to your post or story in your favourite app.',
  optionalAI: 'Optional: write a spoiler-free caption with AI',
  caption: 'Use this caption on my card'
}
type Copy = Record<keyof typeof english, string>
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': english,
  'it-IT': {
    intro: 'Un piccolo ricordo di quanta strada hai fatto.',
    privacy: 'La scheda mostra solo titolo, progressi e parole che scegli qui. Controlla i dettagli personali prima di condividerla. Modifiche e download restano sul dispositivo e non usano tentativi IA.',
    passage: 'Un momento da custodire', scene: 'Scegli una scena salvata', noPassage: 'Solo i progressi',
    reflection: 'Cosa porti con te? (facoltativo)', style: 'Stile della scheda', format: 'Formato social',
    starlight: 'Luce di stelle', paper: 'Carta e inchiostro', dawn: 'Prima luce', portrait: 'Post · 4:5', story: 'Storia · 9:16', square: 'Quadrato · 1:1',
    preview: 'Anteprima da condividere', previewNote: 'L’anteprima ha animazioni delicate. Il download è un’immagine PNG statica, pronta per la tua app preferita.',
    previewButton: 'Anteprima prima di condividere', backToEdit: 'Torna alle modifiche', captionPreview: 'Didascalia condivisa con le altre app',
    chapter: 'Capitolo {number}', scenes: '{number} scene salvate', complete: 'Capitolo completato', active: 'La mia storia finora',
    downloaded: 'Immagine scaricata. Aggiungila al tuo post o alla tua storia nell’app che preferisci.',
    optionalAI: 'Facoltativo: crea una didascalia senza spoiler con l’IA', caption: 'Usa questa didascalia sulla scheda'
  },
  'es-ES': {
    intro: 'Un pequeño recuerdo de lo lejos que has llegado.',
    privacy: 'La tarjeta solo muestra el título, el progreso y las palabras que elijas aquí. Revisa los datos personales antes de compartir. Editar y descargar es local y no usa interacciones de IA.',
    passage: 'Un momento para recordar', scene: 'Elige una escena guardada', noPassage: 'Solo el progreso',
    reflection: '¿Qué te llevas contigo? (opcional)', style: 'Estilo', format: 'Formato social',
    starlight: 'Luz de estrellas', paper: 'Papel y tinta', dawn: 'Primera luz', portrait: 'Publicación · 4:5', story: 'Historia · 9:16', square: 'Cuadrado · 1:1',
    preview: 'Vista previa', previewNote: 'La vista previa tiene animaciones suaves. La descarga es una imagen PNG estática, lista para tu aplicación favorita.',
    previewButton: 'Vista previa antes de compartir', backToEdit: 'Volver a editar', captionPreview: 'Texto compartido con otras aplicaciones',
    chapter: 'Capítulo {number}', scenes: '{number} escenas guardadas', complete: 'Capítulo completado', active: 'Mi historia hasta ahora',
    downloaded: 'Imagen descargada. Añádela a tu publicación o historia en tu aplicación favorita.',
    optionalAI: 'Opcional: crea un texto sin spoilers con IA', caption: 'Usar este texto en la tarjeta'
  },
  'zh-CN': {
    intro: '留住一路走来的小小印记。',
    privacy: '卡片只显示标题、进度和你在此选择的文字。分享前请检查个人信息。编辑和下载均在本机完成，不消耗 AI 额度。',
    passage: '值得珍藏的片刻', scene: '选择已保存的场景', noPassage: '仅分享进度',
    reflection: '你想带走什么感悟？（可选）', style: '卡片风格', format: '社交媒体尺寸',
    starlight: '星光', paper: '纸与墨', dawn: '晨光', portrait: '帖子 · 4:5', story: '动态 · 9:16', square: '方形 · 1:1',
    preview: '分享预览', previewNote: '预览含轻柔动画。下载为静态 PNG 图片，可上传到喜欢的应用。',
    previewButton: '分享前预览', backToEdit: '返回编辑', captionPreview: '分享到其他应用的文案',
    chapter: '第 {number} 章', scenes: '已保存 {number} 个场景', complete: '章节已完成', active: '我的故事足迹',
    downloaded: '图片已下载。可添加到喜欢的应用中的帖子或动态。',
    optionalAI: '可选：用 AI 生成无剧透文案', caption: '将此文案用于卡片'
  },
  'hi-IN': {
    intro: 'आपके अब तक के सफ़र की एक छोटी याद।',
    privacy: 'कार्ड में केवल शीर्षक, प्रगति और आपके चुने शब्द दिखेंगे। साझा करने से पहले निजी जानकारी जाँचें। संपादन और डाउनलोड इसी डिवाइस पर होते हैं और AI खर्च नहीं होता।',
    passage: 'सहेजने लायक एक पल', scene: 'सहेजा दृश्य चुनें', noPassage: 'केवल प्रगति',
    reflection: 'आप क्या साथ ले जाएँगे? (वैकल्पिक)', style: 'कार्ड शैली', format: 'सोशल आकार',
    starlight: 'तारों की रोशनी', paper: 'कागज़ और स्याही', dawn: 'पहली किरण', portrait: 'पोस्ट · 4:5', story: 'स्टोरी · 9:16', square: 'वर्ग · 1:1',
    preview: 'साझा करने का पूर्वावलोकन', previewNote: 'पूर्वावलोकन में हल्का एनिमेशन है। डाउनलोड एक स्थिर PNG चित्र है, जिसे अपने पसंदीदा ऐप पर डाल सकते हैं।',
    previewButton: 'साझा करने से पहले देखें', backToEdit: 'संपादन पर वापस जाएँ', captionPreview: 'अन्य ऐप के साथ साझा होने वाला कैप्शन',
    chapter: 'अध्याय {number}', scenes: '{number} दृश्य सहेजे', complete: 'अध्याय पूरा', active: 'मेरी अब तक की कहानी',
    downloaded: 'चित्र डाउनलोड हुआ। अपने पसंदीदा ऐप में पोस्ट या स्टोरी में जोड़ें।',
    optionalAI: 'वैकल्पिक: AI से बिना स्पॉइलर का कैप्शन बनाएँ', caption: 'यह कैप्शन कार्ड पर लगाएँ'
  },
  'uk-UA': {
    intro: 'Маленька згадка про пройдений шлях.',
    privacy: 'На картці лише назва, поступ і вибрані вами слова. Перевірте особисті дані перед поширенням. Редагування й завантаження локальні та не витрачають ШІ.',
    passage: 'Мить, яку хочеться зберегти', scene: 'Оберіть збережену сцену', noPassage: 'Лише поступ',
    reflection: 'Що ви візьмете із собою? (необов’язково)', style: 'Стиль картки', format: 'Формат для соцмереж',
    starlight: 'Зоряне сяйво', paper: 'Папір і чорнило', dawn: 'Перше світло', portrait: 'Допис · 4:5', story: 'Сторіз · 9:16', square: 'Квадрат · 1:1',
    preview: 'Попередній перегляд', previewNote: 'Перегляд має легку анімацію. Завантажується статичне зображення PNG для улюбленого застосунку.',
    previewButton: 'Переглянути перед поширенням', backToEdit: 'Повернутися до редагування', captionPreview: 'Підпис для інших застосунків',
    chapter: 'Розділ {number}', scenes: '{number} сцен збережено', complete: 'Розділ завершено', active: 'Моя історія досі',
    downloaded: 'Зображення завантажено. Додайте його до допису чи сторіз.',
    optionalAI: 'Необов’язково: створити підпис без спойлерів із ШІ', caption: 'Використати цей підпис на картці'
  },
  'ar-SA': {
    intro: 'ذكرى صغيرة للطريق الذي قطعته.',
    privacy: 'تُظهر البطاقة العنوان والتقدم والكلمات التي تختارها هنا فقط. راجع التفاصيل الشخصية قبل المشاركة. التعديل والتنزيل محليان ولا يستهلكان رصيد الذكاء الاصطناعي.',
    passage: 'لحظة تستحق الاحتفاظ بها', scene: 'اختر مشهدًا محفوظًا', noPassage: 'التقدم فقط',
    reflection: 'ماذا ستأخذ معك؟ (اختياري)', style: 'نمط البطاقة', format: 'مقاس المشاركة',
    starlight: 'ضوء النجوم', paper: 'ورق وحبر', dawn: 'أول ضوء', portrait: 'منشور · 4:5', story: 'قصة · 9:16', square: 'مربع · 1:1',
    preview: 'معاينة المشاركة', previewNote: 'تحتوي المعاينة على حركة لطيفة. التنزيل صورة PNG ثابتة جاهزة لتطبيقك المفضل.',
    previewButton: 'معاينة قبل المشاركة', backToEdit: 'العودة إلى التعديل', captionPreview: 'التعليق المشارك مع التطبيقات الأخرى',
    chapter: 'الفصل {number}', scenes: 'تم حفظ {number} مشاهد', complete: 'اكتمل الفصل', active: 'قصتي حتى الآن',
    downloaded: 'تم تنزيل الصورة. أضفها إلى منشورك أو قصتك في تطبيقك المفضل.',
    optionalAI: 'اختياري: أنشئ تعليقًا دون حرق بالذكاء الاصطناعي', caption: 'استخدم هذا التعليق على البطاقة'
  }
}
export const shareStudioCopy = (language: StoryLanguageCode) => copies[language]
