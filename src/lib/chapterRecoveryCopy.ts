import type { StoryLanguageCode } from './storyLanguage'
type Copy = { recover: string; help: string; exhausted: string; limit: string }
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': { recover: 'Recover the ending', help: 'Write the ending from saved scenes. Up to two extra attempts per chapter, within your plan and daily limits. A successful ending unlocks the next chapter.', exhausted: 'Ending not completed · saved scenes kept', limit: 'Ending recovery attempts used. Saved scenes remain available.' },
  'it-IT': { recover: 'Recupera il finale', help: 'Scrivi il finale dalle scene salvate. Fino a due tentativi extra per capitolo, entro i limiti del piano e giornalieri. Un finale riuscito sblocca il capitolo successivo.', exhausted: 'Finale non completato · scene conservate', limit: 'Tentativi di recupero del finale esauriti. Le scene salvate restano disponibili.' },
  'es-ES': { recover: 'Recuperar el final', help: 'Escribe el final con las escenas guardadas. Hasta dos intentos extra por capítulo, dentro de los límites del plan y diarios. Un final completado desbloquea el siguiente capítulo.', exhausted: 'Final sin completar · escenas guardadas', limit: 'Intentos de recuperación agotados. Las escenas guardadas siguen disponibles.' },
  'zh-CN': { recover: '恢复结局', help: '根据已保存场景生成结局。每章最多额外尝试两次，仍受套餐和每日限额限制。成功后解锁下一章。', exhausted: '结局未完成 · 场景已保存', limit: '结局恢复次数已用完，仍可阅读已保存场景。' },
  'hi-IN': { recover: 'अंत पूरा करें', help: 'सहेजे दृश्यों से अंत लिखें। हर अध्याय में अधिकतम दो अतिरिक्त प्रयास, योजना और दैनिक सीमा के भीतर। सफल अंत अगला अध्याय खोलता है।', exhausted: 'अंत अधूरा · दृश्य सहेजे गए', limit: 'अंत पूरा करने के प्रयास समाप्त। सहेजे दृश्य उपलब्ध हैं।' },
  'uk-UA': { recover: 'Відновити завершення', help: 'Напишіть завершення зі збережених сцен. До двох додаткових спроб на розділ у межах тарифу й денного ліміту. Успішне завершення відкриє наступний розділ.', exhausted: 'Завершення не створено · сцени збережено', limit: 'Спроби відновлення вичерпано. Збережені сцени доступні.' },
  'ar-SA': { recover: 'استعادة النهاية', help: 'اكتب النهاية من المشاهد المحفوظة. حتى محاولتين إضافيتين لكل فصل ضمن حدود الخطة والحدود اليومية. تفتح النهاية الناجحة الفصل التالي.', exhausted: 'النهاية غير مكتملة · المشاهد محفوظة', limit: 'استُخدمت محاولات استعادة النهاية. تبقى المشاهد المحفوظة متاحة.' }
}
const consent: Record<StoryLanguageCode, string> = {
  'en-US': 'I agree to send this chapter’s settings, selected memories, recent narration, actions and story state to Muse AI to write its ending. Each attempt uses one AI interaction, even if it fails.',
  'it-IT': 'Acconsento a inviare impostazioni del capitolo, ricordi selezionati, narrazione recente, azioni e stato della storia all’IA di Muse per scrivere il finale. Ogni tentativo usa un’interazione IA, anche se fallisce.',
  'es-ES': 'Acepto enviar los ajustes del capítulo, recuerdos seleccionados, narración reciente, acciones y estado de la historia a la IA de Muse para escribir el final. Cada intento usa una interacción IA, aunque falle.',
  'zh-CN': '我同意将本章设置、选定的记忆、近期叙述、动作与故事状态发送给 Muse AI 以生成结局。每次尝试均消耗一次 AI 互动，即使失败。',
  'hi-IN': 'मैं अध्याय की सेटिंग, चुनी यादें, हाल की कहानी, कार्रवाइयाँ और स्थिति Muse AI को अंत लिखने के लिए भेजने की सहमति देता/देती हूँ। हर प्रयास एक AI संवाद लेता है, विफल होने पर भी।',
  'uk-UA': 'Погоджуюся надіслати налаштування розділу, вибрані спогади, останню оповідь, дії та стан історії до ШІ Muse для написання завершення. Кожна спроба витрачає одну ШІ-взаємодію, навіть невдала.',
  'ar-SA': 'أوافق على إرسال إعدادات الفصل والذكريات المختارة والسرد الأخير والإجراءات وحالة القصة إلى ذكاء Muse لكتابة النهاية. تستخدم كل محاولة تفاعلًا واحدًا حتى عند فشلها.'
}
export const chapterRecoveryCopy = (language: StoryLanguageCode): Copy & { consent: string } => ({
  ...copies[language], consent: consent[language]
})
