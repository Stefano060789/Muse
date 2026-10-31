import type { StoryLanguageCode } from './storyLanguage'

type PublicNavigationCopy = {
  sample: string; plans: string; support: string; privacy: string; terms: string
  navigation: string; information: string; operator: string; supportEmail: string
  preview: string; contactPending: string
}

const copies: Record<StoryLanguageCode, PublicNavigationCopy> = {
  'en-US': {
    sample: 'Try a sample', plans: 'Plans & pricing', support: 'Help & support', privacy: 'Privacy', terms: 'Terms',
    navigation: 'Information and support', information: 'Help, privacy and about Muse', operator: 'Operator', supportEmail: 'Support',
    preview: 'Muse preview', contactPending: 'Contact details pending'
  },
  'it-IT': {
    sample: 'Prova un esempio', plans: 'Piani e prezzi', support: 'Aiuto e supporto', privacy: 'Privacy', terms: 'Condizioni',
    navigation: 'Informazioni e supporto', information: 'Aiuto, privacy e informazioni su Muse', operator: 'Gestore', supportEmail: 'Supporto',
    preview: 'Anteprima Muse', contactPending: 'Contatti non ancora disponibili'
  },
  'es-ES': {
    sample: 'Prueba un ejemplo', plans: 'Planes y precios', support: 'Ayuda y soporte', privacy: 'Privacidad', terms: 'Condiciones',
    navigation: 'Información y soporte', information: 'Ayuda, privacidad y acerca de Muse', operator: 'Operador', supportEmail: 'Soporte',
    preview: 'Vista previa de Muse', contactPending: 'Datos de contacto pendientes'
  },
  'zh-CN': {
    sample: '试读示例', plans: '方案与价格', support: '帮助与支持', privacy: '隐私', terms: '条款',
    navigation: '信息与支持', information: '帮助、隐私与关于 Muse', operator: '运营方', supportEmail: '支持',
    preview: 'Muse 预览版', contactPending: '联系信息尚未提供'
  },
  'hi-IN': {
    sample: 'नमूना आज़माएँ', plans: 'योजनाएँ और कीमतें', support: 'सहायता और संपर्क', privacy: 'गोपनीयता', terms: 'शर्तें',
    navigation: 'जानकारी और सहायता', information: 'सहायता, गोपनीयता और Muse के बारे में', operator: 'संचालक', supportEmail: 'सहायता',
    preview: 'Muse पूर्वावलोकन', contactPending: 'संपर्क विवरण अभी उपलब्ध नहीं हैं'
  },
  'uk-UA': {
    sample: 'Спробувати приклад', plans: 'Плани й ціни', support: 'Допомога й підтримка', privacy: 'Конфіденційність', terms: 'Умови',
    navigation: 'Інформація й підтримка', information: 'Допомога, конфіденційність і про Muse', operator: 'Оператор', supportEmail: 'Підтримка',
    preview: 'Попередня версія Muse', contactPending: 'Контактні дані ще не доступні'
  },
  'ar-SA': {
    sample: 'جرّب نموذجًا', plans: 'الخطط والأسعار', support: 'المساعدة والدعم', privacy: 'الخصوصية', terms: 'الشروط',
    navigation: 'المعلومات والدعم', information: 'المساعدة والخصوصية وعن Muse', operator: 'المشغّل', supportEmail: 'الدعم',
    preview: 'نسخة Muse التجريبية', contactPending: 'تفاصيل الاتصال غير متاحة بعد'
  }
}

export const publicNavigationCopy = (language: StoryLanguageCode): PublicNavigationCopy => copies[language]
