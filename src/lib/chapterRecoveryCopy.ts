import type { StoryLanguageCode } from './storyLanguage'
type Copy = { recover: string; help: string; exhausted: string; limit: string }
const copies: Record<StoryLanguageCode, Copy> = {
  'en-US': { recover: 'Retry closing scene', help: 'Muse creates a final scene from what has happened. The chapter completes only if this succeeds; then you can choose whether to start the next chapter. Up to two extra attempts per chapter, within plan and daily limits.', exhausted: 'Ending not completed · saved scenes kept', limit: 'Extra ending attempts are used. The chapter stays open; saved scenes remain available.' },
  'it-IT': { recover: 'Riprova la scena finale', help: 'Muse crea una scena finale basata su quanto è successo. Il capitolo si conclude solo se la generazione riesce; poi puoi scegliere se iniziare il successivo. Fino a due tentativi extra per capitolo, entro i limiti del piano e giornalieri.', exhausted: 'Finale non completato · scene salvate', limit: 'Tentativi extra esauriti. Il capitolo resta aperto; le scene sono salvate.' },
  'es-ES': { recover: 'Reintentar escena final', help: 'Muse crea una escena final con lo ocurrido. El capítulo solo se completa si se genera correctamente; después decides si empiezas el siguiente. Hasta dos intentos extra por capítulo, dentro de los límites del plan y diarios.', exhausted: 'Final sin completar · escenas guardadas', limit: 'Se agotaron los intentos extra. El capítulo sigue abierto; las escenas están guardadas.' },
  'zh-CN': { recover: '重试生成结尾场景', help: 'Muse 会根据已发生的故事生成结尾场景。只有生成成功，本章才算完成；之后你可以选择是否开始下一章。每章最多额外尝试两次，仍受套餐和每日限额限制。', exhausted: '结局未完成 · 场景已保存', limit: '结尾额外尝试已用完。本章仍未结束，已保存场景仍可查看。' },
  'hi-IN': { recover: 'अंतिम दृश्य फिर बनाएँ', help: 'Muse अब तक की कहानी से अंतिम दृश्य बनाएगा। सफल होने पर ही अध्याय पूरा होगा; फिर आप अगला अध्याय शुरू करने का निर्णय ले सकते हैं। योजना और दैनिक सीमा के भीतर हर अध्याय में अधिकतम दो अतिरिक्त प्रयास।', exhausted: 'अंत अधूरा · दृश्य सहेजे गए', limit: 'अंतिम दृश्य के अतिरिक्त प्रयास समाप्त। अध्याय खुला है; सहेजे दृश्य उपलब्ध हैं।' },
  'uk-UA': { recover: 'Повторити фінальну сцену', help: 'Muse створить фінальну сцену на основі подій. Розділ завершиться лише після успішної генерації; потім ви вирішите, чи починати наступний. До двох додаткових спроб на розділ у межах тарифу й денного ліміту.', exhausted: 'Завершення не створено · сцени збережено', limit: 'Додаткові спроби фіналу вичерпано. Розділ залишається відкритим; сцени збережено.' },
  'ar-SA': { recover: 'إعادة محاولة مشهد الختام', help: 'ينشئ Muse مشهدًا ختاميًا استنادًا إلى ما حدث. يكتمل الفصل فقط عند نجاح الإنشاء؛ وبعدها يمكنك اختيار بدء الفصل التالي. حتى محاولتين إضافيتين لكل فصل ضمن حدود الخطة والحدود اليومية.', exhausted: 'النهاية غير مكتملة · المشاهد محفوظة', limit: 'انتهت محاولات الختام الإضافية. لا يزال الفصل مفتوحًا والمشاهد محفوظة.' }
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
