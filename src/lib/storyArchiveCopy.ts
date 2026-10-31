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
