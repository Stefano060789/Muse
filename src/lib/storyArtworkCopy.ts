import type { StoryLanguageCode } from './storyLanguage'

const copies = {
  'en-US': { label: 'Story animation', map: 'Map in the wind', sword: 'Sword of light', doorway: 'An opening doorway', ocean: 'Moonlit voyage', light: 'Soft starlight',
    note: 'Original story-object templates, animated on your device with no paid AI generation. Choose a different motif in Customize. Play the clip to see the movement; PNG is a still illustration. MP4 is preferred; some browsers export WebM. Nothing is posted automatically.' },
  'it-IT': { label: 'Animazione della storia', map: 'Mappa nel vento', sword: 'Spada di luce', doorway: 'Una porta che si apre', ocean: 'Viaggio al chiaro di luna', light: 'Luce delle stelle',
    note: 'Modelli originali con oggetti della storia, animati sul dispositivo senza generazioni IA a pagamento. Cambia motivo in Personalizza. Guarda il video per vedere il movimento; PNG è un’illustrazione statica. Preferiamo MP4; alcuni browser esportano WebM. Nulla viene pubblicato automaticamente.' },
  'es-ES': { label: 'Animación de la historia', map: 'Mapa al viento', sword: 'Espada de luz', doorway: 'Una puerta que se abre', ocean: 'Viaje bajo la luna', light: 'Luz de estrellas',
    note: 'Plantillas originales con objetos de la historia, animadas en tu dispositivo sin generación IA de pago. Cambia el motivo en Personalizar. Reproduce el vídeo para ver el movimiento; PNG es una ilustración fija. Se prefiere MP4; algunos navegadores exportan WebM. Nada se publica automáticamente.' },
  'zh-CN': { label: '故事动画', map: '风中的地图', sword: '光之剑', doorway: '开启的门', ocean: '月下航行', light: '柔和星光',
    note: '原创故事物件模板在本机生成动画，无需付费 AI。可在自定义中更换主题。播放短片查看运动；PNG 为静态插画。优先 MP4，部分浏览器导出 WebM。不会自动发布。' },
  'hi-IN': { label: 'कहानी का एनीमेशन', map: 'हवा में नक्शा', sword: 'प्रकाश की तलवार', doorway: 'खुलता दरवाज़ा', ocean: 'चाँदनी यात्रा', light: 'मंद तारों की रोशनी',
    note: 'कहानी की वस्तुओं के मौलिक टेम्पलेट आपके डिवाइस पर चलते हैं, बिना भुगतान वाले AI के। बदलाव में विषय चुनें। गति देखने के लिए क्लिप चलाएँ; PNG स्थिर चित्र है। MP4 प्राथमिक है; कुछ ब्राउज़र WebM देते हैं। कुछ भी अपने आप पोस्ट नहीं होता।' },
  'uk-UA': { label: 'Анімація історії', map: 'Мапа на вітрі', sword: 'Меч світла', doorway: 'Двері, що відчиняються', ocean: 'Місячна подорож', light: 'М’яке сяйво зірок',
    note: 'Оригінальні шаблони з предметами історії анімуються на пристрої без платної генерації ШІ. Змініть мотив у налаштуванні. Відтворіть кліп для руху; PNG — статична ілюстрація. Бажано MP4; деякі браузери експортують WebM. Автоматичної публікації немає.' },
  'ar-SA': { label: 'حركة القصة', map: 'خريطة في الريح', sword: 'سيف النور', doorway: 'باب ينفتح', ocean: 'رحلة تحت القمر', light: 'ضوء نجوم هادئ',
    note: 'قوالب أصلية لعناصر القصة تتحرك على جهازك دون توليد ذكاء اصطناعي مدفوع. غيّر النمط في التخصيص. شغّل المقطع لرؤية الحركة؛ PNG رسم ثابت. نفضّل MP4؛ بعض المتصفحات تصدّر WebM. لا يُنشر شيء تلقائيًا.' }
} satisfies Record<StoryLanguageCode, Record<'label' | 'map' | 'sword' | 'doorway' | 'ocean' | 'light' | 'note', string>>

export const storyArtworkCopy = (language: StoryLanguageCode) => copies[language]
