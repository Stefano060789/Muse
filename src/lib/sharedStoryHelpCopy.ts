import type { StoryLanguageCode } from './storyLanguage'

export type HelpCopy = {
  attempt: (used: number, total: number) => string
  title: string
  body: string
  requestId: string
  codeLabel: string
  redeem: string
  redeemed: string
}

const copies: Record<StoryLanguageCode, HelpCopy> = {
  'en-US': {
    attempt: (used, total) => `Answers tried: ${Math.min(used, total)} of ${total}`,
    title: 'Stuck? Ask the sender for a help code',
    body: 'Send the sender this request ID. They can reply with a code that opens the ending.',
    requestId: 'Request ID', codeLabel: 'Help code from the sender', redeem: 'Use help code', redeemed: 'The sender’s help code opened the ending.'
  },
  'it-IT': {
    attempt: (used, total) => `Risposte provate: ${Math.min(used, total)} di ${total}`,
    title: 'Sei bloccato? Chiedi un codice di aiuto al mittente',
    body: 'Invia al mittente questo ID richiesta. Potrà risponderti con un codice che apre il finale.',
    requestId: 'ID richiesta', codeLabel: 'Codice di aiuto del mittente', redeem: 'Usa il codice', redeemed: 'Il codice del mittente ha aperto il finale.'
  },
  'es-ES': {
    attempt: (used, total) => `Respuestas probadas: ${Math.min(used, total)} de ${total}`,
    title: '¿Atascado? Pide un código de ayuda a quien te la envió',
    body: 'Envía este ID de solicitud. Esa persona puede responder con un código que abre el final.',
    requestId: 'ID de solicitud', codeLabel: 'Código de ayuda', redeem: 'Usar código', redeemed: 'El código de ayuda abrió el final.'
  },
  'zh-CN': {
    attempt: (used, total) => `已尝试答案：${Math.min(used, total)}/${total}`,
    title: '卡住了？向发送者索取帮助码',
    body: '把这个请求编号发给发送者，对方可以回复一个解锁结局的代码。',
    requestId: '请求编号', codeLabel: '发送者提供的帮助码', redeem: '使用帮助码', redeemed: '发送者的帮助码已解锁结局。'
  },
  'hi-IN': {
    attempt: (used, total) => `आज़माए गए उत्तर: ${Math.min(used, total)} / ${total}`,
    title: 'अटक गए? भेजने वाले से सहायता कोड माँगें',
    body: 'भेजने वाले को यह अनुरोध आईडी भेजें। वे अंत खोलने वाला कोड भेज सकते हैं।',
    requestId: 'अनुरोध आईडी', codeLabel: 'भेजने वाले का सहायता कोड', redeem: 'कोड उपयोग करें', redeemed: 'सहायता कोड से अंत खुल गया।'
  },
  'uk-UA': {
    attempt: (used, total) => `Спроб відповіді: ${Math.min(used, total)} із ${total}`,
    title: 'Застрягли? Попросіть код допомоги в відправника',
    body: 'Надішліть відправнику цей ідентифікатор запиту. Він може відповісти кодом, що відкриє фінал.',
    requestId: 'Ідентифікатор запиту', codeLabel: 'Код допомоги від відправника', redeem: 'Використати код', redeemed: 'Код допомоги відкрив фінал.'
  },
  'ar-SA': {
    attempt: (used, total) => `الإجابات المجرَّبة: ${Math.min(used, total)} من ${total}`,
    title: 'عالق؟ اطلب رمز مساعدة من المرسل',
    body: 'أرسل معرّف الطلب هذا إلى المرسل. يمكنه الرد برمز يفتح النهاية.',
    requestId: 'معرّف الطلب', codeLabel: 'رمز المساعدة من المرسل', redeem: 'استخدام الرمز', redeemed: 'فتح رمز المرسل النهاية.'
  }
}

export const helpCopy = (language: StoryLanguageCode = 'en-US') => copies[language] ?? copies['en-US']
