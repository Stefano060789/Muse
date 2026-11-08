import type { PersonalStory } from './story'
import type { LibraryEntry } from './storyLibrary'
import type { StoryLanguageCode } from './storyLanguage'

export type StoryRecapChapter = {
  id: string
  number: number
  title: string
  highlights: Array<{ kind: 'opening' | 'alongWay' | 'latest'; title: string; text: string }>
  recentActions: string[]
}

const copy: Record<StoryLanguageCode, {
  show: string
  hide: string
  heading: string
  intro: string
  noRecap: string
  opening: string
  alongWay: string
  latest: string
  actions: string
  loadError: string
}> = {
  'en-US': {
    show: 'Show story recap', hide: 'Hide story recap', heading: 'Previously in this story',
    intro: 'A quick reminder made from your saved chapters. It stays in this browser and uses no AI interaction.',
    noRecap: 'There are no saved scenes to recap yet.', opening: 'At the beginning', alongWay: 'Along the way',
    latest: 'Most recently', actions: 'Your recent actions', loadError: 'The saved story recap could not be loaded.'
  },
  'it-IT': {
    show: 'Mostra il riepilogo', hide: 'Nascondi il riepilogo', heading: 'Finora nella storia',
    intro: 'Un breve promemoria creato dai capitoli salvati. Resta in questo browser e non usa interazioni IA.',
    noRecap: 'Non ci sono ancora scene salvate da riepilogare.', opening: 'All’inizio', alongWay: 'Lungo il percorso',
    latest: 'Più di recente', actions: 'Le tue azioni recenti', loadError: 'Impossibile caricare il riepilogo della storia salvata.'
  },
  'es-ES': {
    show: 'Mostrar resumen', hide: 'Ocultar resumen', heading: 'Hasta ahora en esta historia',
    intro: 'Un recordatorio breve creado con tus capítulos guardados. Se queda en este navegador y no usa interacciones de IA.',
    noRecap: 'Aún no hay escenas guardadas para resumir.', opening: 'Al principio', alongWay: 'Por el camino',
    latest: 'Más recientemente', actions: 'Tus acciones recientes', loadError: 'No se pudo cargar el resumen de la historia guardada.'
  },
  'zh-CN': {
    show: '显示故事回顾', hide: '隐藏故事回顾', heading: '故事回顾',
    intro: '根据已保存章节整理的简短回顾。内容保留在此浏览器中，不会消耗 AI 互动次数。',
    noRecap: '暂无已保存场景可供回顾。', opening: '故事开端', alongWay: '途中', latest: '最近进展',
    actions: '你最近的行动', loadError: '无法加载已保存的故事回顾。'
  },
  'hi-IN': {
    show: 'कहानी का सार दिखाएँ', hide: 'कहानी का सार छिपाएँ', heading: 'अब तक की कहानी',
    intro: 'आपके सहेजे अध्यायों से बना एक छोटा स्मरण। यह इसी ब्राउज़र में रहता है और AI संवाद का उपयोग नहीं करता।',
    noRecap: 'अभी सार के लिए कोई सहेजे दृश्य नहीं हैं।', opening: 'शुरुआत में', alongWay: 'आगे की कहानी',
    latest: 'सबसे हाल में', actions: 'आपकी हाल की कार्रवाइयाँ', loadError: 'सहेजी कहानी का सार लोड नहीं हो सका।'
  },
  'uk-UA': {
    show: 'Показати короткий зміст', hide: 'Сховати короткий зміст', heading: 'Раніше в цій історії',
    intro: 'Коротке нагадування зі збережених розділів. Воно залишається в цьому браузері й не витрачає взаємодії ШІ.',
    noRecap: 'Ще немає збережених сцен для короткого змісту.', opening: 'На початку', alongWay: 'Далі',
    latest: 'Найновіше', actions: 'Ваші останні дії', loadError: 'Не вдалося завантажити короткий зміст збереженої історії.'
  },
  'ar-SA': {
    show: 'عرض ملخص القصة', hide: 'إخفاء ملخص القصة', heading: 'ما حدث في القصة',
    intro: 'تذكير موجز من الفصول المحفوظة. يبقى في هذا المتصفح ولا يستهلك تفاعلًا مع الذكاء الاصطناعي.',
    noRecap: 'لا توجد مشاهد محفوظة لتلخيصها بعد.', opening: 'في البداية', alongWay: 'خلال الرحلة',
    latest: 'الأحدث', actions: 'إجراءاتك الأخيرة', loadError: 'تعذّر تحميل ملخص القصة المحفوظة.'
  }
}

function excerpt(value: string): string {
  const text = value.trim().replace(/\s+/g, ' ')
  const sentence = text.match(/^.*?[.!?؟。！？](?:\s|$)/u)?.[0].trim() || text
  if (sentence.length <= 240) return sentence
  const shortened = sentence.slice(0, 237)
  const boundary = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, boundary > 170 ? boundary : 237).trimEnd()}…`
}

export function createStoryRecap(story: PersonalStory, entries: LibraryEntry[]): StoryRecapChapter[] {
  const rootId = story.chapter?.rootId ?? story.id
  const currentChapter = story.chapter?.number ?? 1
  const chapters = new Map<string, PersonalStory>()
  for (const entry of entries) {
    if (entry.kind !== 'personal') continue
    const candidateRoot = entry.story.chapter?.rootId ?? entry.story.id
    if (candidateRoot === rootId && (entry.story.chapter?.number ?? 1) <= currentChapter) {
      chapters.set(entry.id, entry.story)
    }
  }
  chapters.set(story.id, story)
  return [...chapters.values()]
    .sort((first, second) =>
      (first.chapter?.number ?? 1) - (second.chapter?.number ?? 1) ||
      Date.parse(first.createdAt) - Date.parse(second.createdAt)
    )
    .map(chapter => {
      const scenes = chapter.id === story.id ? chapter.scenes.slice(0, story.currentStep + 1) : chapter.scenes
      const indexes = [...new Set([0, Math.floor((scenes.length - 1) / 2), scenes.length - 1])]
        .filter(index => index >= 0 && scenes[index])
      return {
        id: chapter.id,
        number: chapter.chapter?.number ?? 1,
        title: chapter.title,
        highlights: indexes.map((index, position) => ({
          kind: position === 0 ? 'opening' : index === scenes.length - 1 ? 'latest' : 'alongWay',
          title: scenes[index].title,
          text: excerpt(scenes[index].body)
        })),
        recentActions: chapter.responses.slice(-2).map(action => excerpt(action))
      }
    })
}

export function storyRecapCopy(language: StoryLanguageCode) {
  return copy[language]
}
