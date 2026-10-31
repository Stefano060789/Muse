import type { StoryLanguageCode } from './storyLanguage'

const copies: Record<StoryLanguageCode, { close: string; restore: string; busy: string; error: string; local: string }> = {
  'en-US': { close: 'Close story', restore: 'Restore to My stories', busy: 'Saving…', error: 'Could not move this story. Try again.', local: 'Browser-only story: this move stays in this browser.' },
  'it-IT': { close: 'Chiudi storia', restore: 'Riporta nelle mie storie', busy: 'Salvataggio…', error: 'Impossibile spostare la storia. Riprova.', local: 'Storia locale: lo spostamento vale solo in questo browser.' },
  'es-ES': { close: 'Cerrar historia', restore: 'Volver a Mis historias', busy: 'Guardando…', error: 'No se pudo mover la historia. Inténtalo de nuevo.', local: 'Historia local: este cambio solo se guarda en este navegador.' },
  'zh-CN': { close: '关闭故事', restore: '恢复到我的故事', busy: '保存中…', error: '无法移动故事，请重试。', local: '本地故事：此更改仅保存在当前浏览器。' },
  'hi-IN': { close: 'कहानी बंद करें', restore: 'मेरी कहानियों में वापस लाएँ', busy: 'सहेजा जा रहा है…', error: 'कहानी स्थानांतरित नहीं हुई। फिर कोशिश करें।', local: 'स्थानीय कहानी: यह बदलाव केवल इस ब्राउज़र में रहेगा।' },
  'uk-UA': { close: 'Закрити історію', restore: 'Повернути до Моїх історій', busy: 'Збереження…', error: 'Не вдалося перемістити історію. Спробуйте ще раз.', local: 'Локальна історія: зміна зберігається лише в цьому браузері.' },
  'ar-SA': { close: 'إغلاق القصة', restore: 'إعادة إلى قصصي', busy: 'جارٍ الحفظ…', error: 'تعذر نقل القصة. حاول مجددًا.', local: 'قصة محلية: يُحفظ هذا التغيير في هذا المتصفح فقط.' }
}
export const storyArchiveCopy = (language: StoryLanguageCode) => copies[language]

const unavailable: Record<StoryLanguageCode, { notice: string; move: string }> = {
  'en-US': { notice: 'This story is unavailable in your current account. You can move the browser copy only; saved scenes are kept, but continuing requires access to the online story.', move: 'Move browser copy only' },
  'it-IT': { notice: 'Questa storia non è disponibile nell’account attuale. Puoi spostare solo la copia del browser: le scene restano, ma per continuare serve accesso alla storia online.', move: 'Sposta solo la copia del browser' },
  'es-ES': { notice: 'Esta historia no está disponible en tu cuenta actual. Puedes mover solo la copia del navegador; las escenas se conservan, pero continuar requiere acceso a la historia en línea.', move: 'Mover solo la copia del navegador' },
  'zh-CN': { notice: '当前账号无法访问此故事。可仅移动浏览器副本并保留场景，但继续故事需要访问在线故事。', move: '仅移动浏览器副本' },
  'hi-IN': { notice: 'यह कहानी वर्तमान खाते में उपलब्ध नहीं है। केवल ब्राउज़र की प्रति स्थानांतरित कर सकते हैं; दृश्य सुरक्षित रहेंगे, लेकिन जारी रखने के लिए ऑनलाइन कहानी तक पहुँच चाहिए।', move: 'केवल ब्राउज़र की प्रति स्थानांतरित करें' },
  'uk-UA': { notice: 'Історія недоступна в поточному обліковому записі. Можна перемістити лише копію браузера: сцени збережуться, але продовження потребує доступу до онлайн-історії.', move: 'Перемістити лише копію браузера' },
  'ar-SA': { notice: 'هذه القصة غير متاحة في حسابك الحالي. يمكنك نقل نسخة المتصفح فقط مع حفظ المشاهد، لكن المتابعة تتطلب الوصول إلى القصة عبر الإنترنت.', move: 'نقل نسخة المتصفح فقط' }
}
export const storyArchiveUnavailableCopy = (language: StoryLanguageCode) => unavailable[language]
