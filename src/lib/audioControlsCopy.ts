import type { StoryLanguageCode } from './storyLanguage'
import type { NarrationStyle } from './narration'
const english = {
  settings: 'Audio', device: 'Device voice · free', cloud: 'Cloud voice · paid', style: 'Style',
  language: 'Language', automatic: 'Automatic', voice: 'Voice', preview: 'Preview',
  stop: 'Stop', pause: 'Pause', resume: 'Resume', loading: 'Preparing…',
  ambience: 'Background sound', volume: 'Volume', expressive: 'Natural pacing',
  help: 'Voice quality varies by device.', deviceChoice: 'Use device voice · free'
}
type Copy = typeof english
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': english,
  'it-IT': { settings: 'Audio', device: 'Voce del dispositivo · gratis', cloud: 'Voce cloud · a pagamento', style: 'Stile', language: 'Lingua', automatic: 'Automatico', voice: 'Voce', preview: 'Anteprima', stop: 'Ferma', pause: 'Pausa', resume: 'Riprendi', loading: 'Preparazione…', ambience: 'Suono di sottofondo', volume: 'Volume', expressive: 'Ritmo naturale', help: 'La qualità della voce varia in base al dispositivo.', deviceChoice: 'Usa voce del dispositivo · gratis' },
  'es-ES': { settings: 'Audio', device: 'Voz del dispositivo · gratis', cloud: 'Voz en la nube · de pago', style: 'Estilo', language: 'Idioma', automatic: 'Automático', voice: 'Voz', preview: 'Vista previa', stop: 'Detener', pause: 'Pausa', resume: 'Reanudar', loading: 'Preparando…', ambience: 'Sonido de fondo', volume: 'Volumen', expressive: 'Ritmo natural', help: 'La calidad de voz varía según el dispositivo.', deviceChoice: 'Usar voz del dispositivo · gratis' },
  'zh-CN': { settings: '音频', device: '设备语音 · 免费', cloud: '云语音 · 付费', style: '风格', language: '语言', automatic: '自动', voice: '语音', preview: '试听', stop: '停止', pause: '暂停', resume: '继续', loading: '准备中…', ambience: '背景音', volume: '音量', expressive: '自然节奏', help: '语音质量因设备而异。', deviceChoice: '使用设备语音 · 免费' },
  'hi-IN': { settings: 'ऑडियो', device: 'डिवाइस आवाज़ · मुफ़्त', cloud: 'क्लाउड आवाज़ · सशुल्क', style: 'शैली', language: 'भाषा', automatic: 'स्वचालित', voice: 'आवाज़', preview: 'पूर्वावलोकन', stop: 'रोकें', pause: 'विराम', resume: 'जारी रखें', loading: 'तैयारी…', ambience: 'पृष्ठभूमि ध्वनि', volume: 'आवाज़ स्तर', expressive: 'प्राकृतिक गति', help: 'आवाज़ गुणवत्ता डिवाइस के अनुसार बदलती है।', deviceChoice: 'डिवाइस आवाज़ उपयोग करें · मुफ़्त' },
  'uk-UA': { settings: 'Аудіо', device: 'Голос пристрою · безкоштовно', cloud: 'Хмарний голос · платно', style: 'Стиль', language: 'Мова', automatic: 'Автоматично', voice: 'Голос', preview: 'Прослухати', stop: 'Зупинити', pause: 'Пауза', resume: 'Продовжити', loading: 'Підготовка…', ambience: 'Фоновий звук', volume: 'Гучність', expressive: 'Природний ритм', help: 'Якість голосу залежить від пристрою.', deviceChoice: 'Голос пристрою · безкоштовно' },
  'ar-SA': { settings: 'الصوت', device: 'صوت الجهاز · مجاني', cloud: 'صوت سحابي · مدفوع', style: 'النمط', language: 'اللغة', automatic: 'تلقائي', voice: 'الصوت', preview: 'معاينة', stop: 'إيقاف', pause: 'إيقاف مؤقت', resume: 'استئناف', loading: 'جارٍ التحضير…', ambience: 'صوت الخلفية', volume: 'مستوى الصوت', expressive: 'إيقاع طبيعي', help: 'تختلف جودة الصوت حسب الجهاز.', deviceChoice: 'استخدام صوت الجهاز · مجاني' }
}
const off: Record<StoryLanguageCode, string> = {
  'en-US': 'Off', 'it-IT': 'Disattivato', 'es-ES': 'Desactivado', 'zh-CN': '关闭',
  'hi-IN': 'बंद', 'uk-UA': 'Вимкнено', 'ar-SA': 'متوقف'
}
const listen: Record<StoryLanguageCode, string> = {
  'en-US': 'Listen', 'it-IT': 'Ascolta', 'es-ES': 'Escuchar', 'zh-CN': '听故事',
  'hi-IN': 'सुनें', 'uk-UA': 'Слухати', 'ar-SA': 'استمع'
}
export const audioControlsCopy = (language: StoryLanguageCode) => ({ ...copies[language], off: off[language], listen: listen[language] })

const previews: Record<StoryLanguageCode, string> = {
  'en-US': 'A new story begins. Beyond the door, a small surprise is waiting.',
  'it-IT': 'Una nuova storia inizia. Dietro la porta ti aspetta una piccola sorpresa.',
  'es-ES': 'Comienza una nueva historia. Tras la puerta, te espera una pequeña sorpresa.',
  'zh-CN': '一个新的故事开始了。门后，有一个小小的惊喜等着你。',
  'hi-IN': 'एक नई कहानी शुरू होती है। दरवाज़े के उस पार एक छोटा सा आश्चर्य आपका इंतज़ार कर रहा है।',
  'uk-UA': 'Починається нова історія. За дверима на тебе чекає маленький сюрприз.',
  'ar-SA': 'تبدأ قصة جديدة. خلف الباب تنتظرك مفاجأة صغيرة.'
}
export function narrationPreview(language: string): string {
  if (language.toLowerCase().startsWith('de')) return 'Eine neue Geschichte beginnt. Hinter der Tür wartet eine kleine Überraschung.'
  const code = (Object.keys(previews) as StoryLanguageCode[]).find(code => code.split('-')[0] === language.toLowerCase().split(/[-_]/)[0])
  return previews[code ?? 'en-US']
}
const styles: Record<StoryLanguageCode, Record<NarrationStyle, string>> = {
  'en-US': { calm: 'Calm', warm: 'Warm', curious: 'Curious', adventurous: 'Adventurous', playful: 'Playful', suspenseful: 'Suspenseful' },
  'it-IT': { calm: 'Calmo', warm: 'Caloroso', curious: 'Curioso', adventurous: 'Avventuroso', playful: 'Giocoso', suspenseful: 'Suspense' },
  'es-ES': { calm: 'Tranquilo', warm: 'Cálido', curious: 'Curioso', adventurous: 'Aventurero', playful: 'Juguetón', suspenseful: 'Suspenso' },
  'zh-CN': { calm: '平静', warm: '温暖', curious: '好奇', adventurous: '冒险', playful: '活泼', suspenseful: '悬疑' },
  'hi-IN': { calm: 'शांत', warm: 'आत्मीय', curious: 'जिज्ञासु', adventurous: 'रोमांचक', playful: 'चंचल', suspenseful: 'रहस्यपूर्ण' },
  'uk-UA': { calm: 'Спокійний', warm: 'Теплий', curious: 'Допитливий', adventurous: 'Пригодницький', playful: 'Грайливий', suspenseful: 'З напругою' },
  'ar-SA': { calm: 'هادئ', warm: 'دافئ', curious: 'فضولي', adventurous: 'مغامر', playful: 'مرح', suspenseful: 'مشوق' }
}
export const narrationStyleLabel = (style: NarrationStyle, language: StoryLanguageCode): string => styles[language][style]
