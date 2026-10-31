import type { StoryLanguageCode } from './storyLanguage'

export type DemoScene = { title: string; body: string; clue: string }
export type DemoStory = {
  title: string
  dedication: string
  scenes: [DemoScene, DemoScene]
  answer: string
  message: string
}

export type DemoPageCopy = {
  title: string
  description: string
  sampleNotice: string
  openingPrompt: string
  openStory: string
  durationNotice: string
  revealHeading: string
  revealFor: string
  createGift: string
  tryPersonal: string
  restart: string
  sceneCount: (current: number, total: number) => string
  clueLabel: string
  listenScene: string
  narrationNotice: string
  narrationPreparing: string
  narrationSpeaking: string
  narrationPaused: string
  narrationResume: string
  narrationPause: string
  narrationStop: string
  narrationUnavailable: string
  narrationError: string
  continue: string
  answerQuestion: string
  answerPlaceholder: string
  submitAnswer: string
  incorrectAnswer: string
  hintPrompt: string
  showHint: string
  hint: string
  revealButton: string
  privacyNotice: string
}

export type DemoLocalization = { story: DemoStory; copy: DemoPageCopy }

const english: DemoLocalization = {
  story: {
    title: 'The lantern at the little station',
    dedication: 'For anyone who could use a small, unexpected adventure.',
    scenes: [
      {
        title: 'A ticket with no destination',
        body: 'At a quiet station, Alex finds a paper ticket tucked under a cup of tea. On the back, Sam has written: "No trains today. Follow the little lights instead." Three painted lanterns lead from the platform toward a garden gate.',
        clue: 'Look for a place where people can pause together.'
      },
      {
        title: 'The garden beyond the gate',
        body: 'Inside the garden, a red ribbon is tied around a small wooden bench. Beside it is a covered basket and a note: "You bring the stories. I will bring something warm to drink." A checked blanket peeks out from beneath the lid. Nothing here needs a grand occasion.',
        clue: 'A basket, a blanket, and food shared outside. What has Sam planned?'
      }
    ],
    answer: 'picnic',
    message: 'A picnic, just for us. No rush, no special occasion. Sometimes the best gift is a little time together.'
  },
  copy: {
    title: 'Muse - Try a sample story',
    description: 'Try an original, fictional Muse mystery. No account, AI generation or private recipient data.',
    sampleNotice: 'Sample story - fictional, handcrafted, and free to try. This is not a real gift or an AI-generated result.',
    openingPrompt: 'A little adventure for you',
    openStory: 'Open sample story',
    durationNotice: 'About two minutes. Nothing plays automatically.',
    revealHeading: 'Your sample surprise',
    revealFor: 'This is how a thoughtful gift can end. Your own story can include a private message, photo, video or voice recording.',
    createGift: 'Make a story for someone',
    tryPersonal: 'Or try a story for yourself',
    restart: 'Try the sample again',
    sceneCount: (current, total) => `Scene ${current} of ${total}`,
    clueLabel: 'Clue:',
    listenScene: 'Listen to this scene',
    narrationNotice: 'Prerecorded Google WaveNet voice. Tap Play below; listening is free.',
    narrationPreparing: 'Preparing narration…',
    narrationSpeaking: 'Narrating…',
    narrationPaused: 'Narration paused',
    narrationResume: 'Resume narration',
    narrationPause: 'Pause narration',
    narrationStop: 'Stop narration',
    narrationUnavailable: 'A voice for this language may not be available in your browser or device.',
    narrationError: 'The narration could not be played. You can keep reading.',
    continue: 'Follow the lanterns',
    answerQuestion: 'What has Sam planned?',
    answerPlaceholder: 'Type your answer',
    submitAnswer: 'Try this answer',
    incorrectAnswer: 'Not quite. Think of a meal shared outside. You can try again or open the sample reveal below.',
    hintPrompt: 'Need a little help?',
    showHint: 'Show a hint',
    hint: 'The answer is a picnic. This sample is here to show how Muse works, not to test you.',
    revealButton: 'Open the sample reveal',
    privacyNotice: 'This demo makes no story-generation requests and saves no playthrough. English narration uses public, prerecorded Google WaveNet audio. Listening sends no story text to Google and uses no paid generation allowance.'
  },
}

const localizations: Record<StoryLanguageCode, DemoLocalization> = {
  'en-US': english,
  'it-IT': {
    story: {
      title: 'La lanterna alla piccola stazione',
      dedication: 'Per chi ha voglia di una piccola avventura inaspettata.',
      scenes: [
        {
          title: 'Un biglietto senza destinazione',
          body: 'In una stazione tranquilla, Alex trova un biglietto di carta infilato sotto una tazza di tè. Sul retro, Sam ha scritto: «Oggi non partono treni. Segui invece le piccole luci». Tre lanterne dipinte conducono dal binario a un cancello del giardino.',
          clue: 'Cerca un posto dove fermarsi insieme.'
        },
        {
          title: 'Il giardino oltre il cancello',
          body: 'Nel giardino, un nastro rosso è legato a una piccola panchina di legno. Accanto ci sono un cestino coperto e un biglietto: «Tu porta le storie. Io porterò qualcosa di caldo da bere». Da sotto il coperchio spunta una coperta a quadretti. Non serve un’occasione speciale.',
          clue: 'Un cestino, una coperta e del cibo da condividere all’aperto. Che cosa ha organizzato Sam?'
        }
      ],
      answer: 'picnic',
      message: 'Un picnic, solo per noi. Senza fretta e senza un’occasione speciale. A volte il regalo più bello è un po’ di tempo insieme.'
    },
    copy: {
      title: 'Muse - Prova una storia di esempio',
      description: 'Prova un mistero originale e immaginario di Muse. Nessun account, nessuna generazione con IA e nessun dato privato del destinatario.',
      sampleNotice: 'Storia di esempio: immaginaria, scritta a mano e gratuita. Non è un vero regalo né un risultato generato dall’IA.',
      openingPrompt: 'Una piccola avventura per te',
      openStory: 'Apri la storia di esempio',
      durationNotice: 'Circa due minuti. Nulla si avvia automaticamente.',
      revealHeading: 'La tua sorpresa di esempio',
      revealFor: 'Ecco come può concludersi un regalo pensato con cura. La tua storia può includere un messaggio privato, una foto, un video o una registrazione vocale.',
      createGift: 'Crea una storia per qualcuno',
      tryPersonal: 'Oppure prova una storia per te',
      restart: 'Riprova l’esempio',
      sceneCount: (current, total) => `Scena ${current} di ${total}`,
      clueLabel: 'Indizio:',
      listenScene: 'Ascolta questa scena',
      narrationNotice: 'La voce del browser legge il testo tradotto; disponibilità e pronuncia variano in base al dispositivo. L’audio preregistrato è solo in inglese.',
      narrationPreparing: 'Preparazione della lettura…',
      narrationSpeaking: 'Lettura in corso…',
      narrationPaused: 'Lettura in pausa',
      narrationResume: 'Riprendi la lettura',
      narrationPause: 'Metti in pausa la lettura',
      narrationStop: 'Interrompi la lettura',
      narrationUnavailable: 'Nel browser o dispositivo potrebbe non essere disponibile una voce per questa lingua.',
      narrationError: 'Non è stato possibile avviare la lettura. Puoi continuare a leggere.',
      continue: 'Segui le lanterne',
      answerQuestion: 'Che cosa ha organizzato Sam?',
      answerPlaceholder: 'Scrivi la risposta',
      submitAnswer: 'Prova questa risposta',
      incorrectAnswer: 'Non proprio. Pensa a un pasto condiviso all’aperto. Puoi riprovare o aprire la rivelazione qui sotto.',
      hintPrompt: 'Ti serve un piccolo aiuto?',
      showHint: 'Mostra un indizio',
      hint: 'La risposta è un picnic. Questo esempio mostra come funziona Muse: non è un test.',
      revealButton: 'Apri la rivelazione',
      privacyNotice: 'Questa demo non invia richieste di generazione e non salva la partita. La lettura tradotta usa solo la voce del browser sul dispositivo; nessun testo viene inviato per la sintesi vocale e non si usa generazione a pagamento. L’audio pubblico preregistrato di Google WaveNet è disponibile solo in inglese.'
    }
  },
  'es-ES': {
    story: {
      title: 'La linterna de la pequeña estación',
      dedication: 'Para quien necesite una pequeña aventura inesperada.',
      scenes: [
        {
          title: 'Un billete sin destino',
          body: 'En una estación tranquila, Alex encuentra un billete de papel escondido bajo una taza de té. En el reverso, Sam ha escrito: «Hoy no hay trenes. Sigue las lucecitas». Tres faroles pintados conducen desde el andén hasta la verja de un jardín.',
          clue: 'Busca un lugar donde la gente pueda hacer una pausa en compañía.'
        },
        {
          title: 'El jardín al otro lado de la verja',
          body: 'Dentro del jardín, una cinta roja rodea un pequeño banco de madera. A su lado hay una cesta tapada y una nota: «Tú trae las historias. Yo traeré algo calentito para beber». Bajo la tapa asoma una manta de cuadros. No hace falta ninguna ocasión especial.',
          clue: 'Una cesta, una manta y comida para compartir al aire libre. ¿Qué ha preparado Sam?'
        }
      ],
      answer: 'picnic',
      message: 'Un pícnic, solo para nosotros. Sin prisas ni ocasiones especiales. A veces, el mejor regalo es pasar un ratito juntos.'
    },
    copy: {
      title: 'Muse - Prueba una historia de ejemplo',
      description: 'Prueba un misterio original y ficticio de Muse. Sin cuenta, generación con IA ni datos privados del destinatario.',
      sampleNotice: 'Historia de ejemplo: ficticia, hecha a mano y gratis. No es un regalo real ni un resultado generado por IA.',
      openingPrompt: 'Una pequeña aventura para ti',
      openStory: 'Abrir la historia de ejemplo',
      durationNotice: 'Unos dos minutos. No se reproduce nada automáticamente.',
      revealHeading: 'Tu sorpresa de ejemplo',
      revealFor: 'Así puede terminar un regalo hecho con cariño. Tu historia puede incluir un mensaje privado, una foto, un vídeo o una grabación de voz.',
      createGift: 'Crear una historia para alguien',
      tryPersonal: 'O prueba una historia para ti',
      restart: 'Probar de nuevo',
      sceneCount: (current, total) => `Escena ${current} de ${total}`,
      clueLabel: 'Pista:',
      listenScene: 'Escuchar esta escena',
      narrationNotice: 'La voz del navegador lee el texto traducido; la disponibilidad y la pronunciación dependen del dispositivo. El audio pregrabado solo está en inglés.',
      narrationPreparing: 'Preparando la lectura…',
      narrationSpeaking: 'Leyendo…',
      narrationPaused: 'Lectura en pausa',
      narrationResume: 'Reanudar lectura',
      narrationPause: 'Pausar lectura',
      narrationStop: 'Detener lectura',
      narrationUnavailable: 'Es posible que tu navegador o dispositivo no tenga una voz para este idioma.',
      narrationError: 'No se pudo iniciar la lectura. Puedes seguir leyendo.',
      continue: 'Seguir las linternas',
      answerQuestion: '¿Qué ha preparado Sam?',
      answerPlaceholder: 'Escribe tu respuesta',
      submitAnswer: 'Probar esta respuesta',
      incorrectAnswer: 'No exactamente. Piensa en una comida compartida al aire libre. Puedes volver a intentarlo o ver la revelación de abajo.',
      hintPrompt: '¿Necesitas una pequeña ayuda?',
      showHint: 'Mostrar una pista',
      hint: 'La respuesta es un pícnic. Este ejemplo sirve para mostrar cómo funciona Muse, no para ponerte a prueba.',
      revealButton: 'Ver la revelación',
      privacyNotice: 'Esta demo no envía solicitudes para generar historias ni guarda la partida. La lectura traducida usa solo la voz del navegador en el dispositivo; no se envía texto para sintetizar voz ni se usa generación de pago. El audio público pregrabado de Google WaveNet solo está disponible en inglés.'
    }
  },
  'zh-CN': {
    story: {
      title: '小车站的灯笼',
      dedication: '送给想要一场小小意外冒险的你。',
      scenes: [
        {
          title: '一张没有目的地的车票',
          body: '在一座安静的车站，亚历克斯发现一张纸车票塞在茶杯下面。背面写着萨姆的话：「今天没有火车。跟着这些小灯走吧。」三盏彩绘灯笼从站台一路指向花园的大门。',
          clue: '找一个人们可以一起停下来休息的地方。'
        },
        {
          title: '门那边的花园',
          body: '花园里，一条红丝带系在一张小木长椅上。旁边放着一个盖好的篮子和一张纸条：「你带上故事，我来带些热饮。」一条格子毯从篮盖下露出一角。这里不需要任何隆重的理由。',
          clue: '篮子、毯子，还有在户外分享的食物。萨姆准备了什么？'
        }
      ],
      answer: '野餐',
      message: '一场只属于我们的野餐。不赶时间，也不需要特别的理由。有时候，最好的礼物就是一起度过的一小段时光。'
    },
    copy: {
      title: 'Muse - 试读故事示例',
      description: '体验 Muse 原创虚构谜题故事。无需账户，不会使用 AI 生成，也不会收集收礼人的私人信息。',
      sampleNotice: '故事示例：虚构、手工创作，可免费体验。它不是真正的礼物，也不是 AI 生成的结果。',
      openingPrompt: '一场为你准备的小冒险',
      openStory: '打开故事示例',
      durationNotice: '大约两分钟。不会自动播放任何内容。',
      revealHeading: '你的故事惊喜',
      revealFor: '这就是一份贴心礼物可能的结尾。你自己的故事还可以包含私人留言、照片、视频或语音录音。',
      createGift: '为某人创作故事',
      tryPersonal: '或者体验一个属于自己的故事',
      restart: '再试一次示例',
      sceneCount: (current, total) => `第 ${current} 幕，共 ${total} 幕`,
      clueLabel: '线索：',
      listenScene: '朗读这一幕',
      narrationNotice: '由浏览器在设备上朗读此译文；语音是否可用、发音效果因设备而异。预录音频仅提供英文版。',
      narrationPreparing: '正在准备朗读…',
      narrationSpeaking: '正在朗读…',
      narrationPaused: '朗读已暂停',
      narrationResume: '继续朗读',
      narrationPause: '暂停朗读',
      narrationStop: '停止朗读',
      narrationUnavailable: '你的浏览器或设备可能没有此语言的语音。',
      narrationError: '无法开始朗读，你仍然可以继续阅读。',
      continue: '跟随灯笼前进',
      answerQuestion: '萨姆准备了什么？',
      answerPlaceholder: '输入你的答案',
      submitAnswer: '提交答案',
      incorrectAnswer: '还不太对。想想在户外分享的一顿饭。你可以再试一次，也可以打开下方的故事揭晓。',
      hintPrompt: '需要一点提示吗？',
      showHint: '显示提示',
      hint: '答案是野餐。这个示例是为了展示 Muse 的体验，不是考试。',
      revealButton: '打开故事揭晓',
      privacyNotice: '本演示不会发送故事生成请求，也不会保存游玩记录。译文只由设备上的浏览器语音朗读；不会发送故事文本进行语音合成，也不会使用付费生成。Google WaveNet 公开预录音频仅提供英文版。'
    }
  },
  'hi-IN': {
    story: {
      title: 'छोटे स्टेशन का लालटेन',
      dedication: 'उन सभी के लिए जिन्हें एक छोटे, अनपेक्षित रोमांच की ज़रूरत है।',
      scenes: [
        {
          title: 'बिना मंज़िल का टिकट',
          body: 'एक शांत स्टेशन पर एलेक्स को चाय के कप के नीचे दबा एक कागज़ का टिकट मिलता है। उसके पीछे सैम ने लिखा है: «आज कोई ट्रेन नहीं है। इसके बजाय इन छोटी रोशनियों के पीछे चलो।» तीन रंगे हुए लालटेन प्लेटफ़ॉर्म से बगीचे के फाटक तक रास्ता दिखाते हैं।',
          clue: 'ऐसी जगह ढूँढ़ो जहाँ लोग साथ बैठकर थोड़ा ठहर सकें।'
        },
        {
          title: 'फाटक के पार का बगीचा',
          body: 'बगीचे में लकड़ी की छोटी बेंच पर लाल रिबन बँधा है। पास में ढकी हुई टोकरी और एक पर्ची है: «तुम कहानियाँ लाना। मैं पीने के लिए कुछ गरम लाऊँगा।» टोकरी के ढक्कन के नीचे से चौखानेदार कंबल झाँक रहा है। यहाँ किसी खास मौके की ज़रूरत नहीं।',
          clue: 'टोकरी, कंबल और बाहर साथ बाँटकर खाने का खाना। सैम ने क्या रखा है?'
        }
      ],
      answer: 'पिकनिक',
      message: 'सिर्फ़ हम दोनों के लिए एक पिकनिक। न जल्दी, न कोई खास मौका। कभी-कभी सबसे अच्छा तोहफ़ा साथ बिताया थोड़ा-सा समय होता है।'
    },
    copy: {
      title: 'Muse - नमूना कहानी आज़माएँ',
      description: 'Muse की एक मौलिक, काल्पनिक रहस्य-कहानी आज़माएँ। कोई खाता नहीं, AI से कहानी नहीं बनती और प्राप्तकर्ता का निजी डेटा नहीं लिया जाता।',
      sampleNotice: 'नमूना कहानी काल्पनिक, हाथ से लिखी और आज़माने के लिए मुफ़्त है। यह असली तोहफ़ा या AI से बना परिणाम नहीं है।',
      openingPrompt: 'आपके लिए एक छोटा रोमांच',
      openStory: 'नमूना कहानी खोलें',
      durationNotice: 'लगभग दो मिनट। कुछ भी अपने-आप नहीं चलता।',
      revealHeading: 'आपका नमूना सरप्राइज़',
      revealFor: 'एक सोच-समझकर दिए गए तोहफ़े का अंत कुछ ऐसा हो सकता है। आपकी अपनी कहानी में निजी संदेश, फ़ोटो, वीडियो या आवाज़ की रिकॉर्डिंग हो सकती है।',
      createGift: 'किसी के लिए कहानी बनाएँ',
      tryPersonal: 'या अपने लिए कहानी आज़माएँ',
      restart: 'नमूना फिर से आज़माएँ',
      sceneCount: (current, total) => `दृश्य ${current} / ${total}`,
      clueLabel: 'संकेत:',
      listenScene: 'यह दृश्य सुनें',
      narrationNotice: 'डिवाइस का ब्राउज़र इस अनुवाद को आवाज़ में पढ़ेगा; आवाज़ की उपलब्धता और उच्चारण डिवाइस पर निर्भर हैं। पहले से रिकॉर्ड किया गया ऑडियो केवल अंग्रेज़ी में है।',
      narrationPreparing: 'आवाज़ तैयार हो रही है…',
      narrationSpeaking: 'पढ़ा जा रहा है…',
      narrationPaused: 'पढ़ना रुका हुआ है',
      narrationResume: 'पढ़ना जारी रखें',
      narrationPause: 'पढ़ना रोकें',
      narrationStop: 'पढ़ना बंद करें',
      narrationUnavailable: 'आपके ब्राउज़र या डिवाइस में इस भाषा की आवाज़ उपलब्ध नहीं हो सकती।',
      narrationError: 'आवाज़ शुरू नहीं हो सकी। आप पढ़ना जारी रख सकते हैं।',
      continue: 'लालटेन के पीछे चलें',
      answerQuestion: 'सैम ने क्या रखा है?',
      answerPlaceholder: 'अपना जवाब लिखें',
      submitAnswer: 'यह जवाब आज़माएँ',
      incorrectAnswer: 'अभी नहीं। बाहर साथ बैठकर खाए जाने वाले भोजन के बारे में सोचें। फिर कोशिश करें या नीचे कहानी का अंत खोलें।',
      hintPrompt: 'थोड़ी मदद चाहिए?',
      showHint: 'संकेत दिखाएँ',
      hint: 'जवाब पिकनिक है। यह नमूना Muse का तरीका दिखाने के लिए है, आपकी परीक्षा लेने के लिए नहीं।',
      revealButton: 'नमूना कहानी का अंत खोलें',
      privacyNotice: 'यह डेमो कहानी बनाने का कोई अनुरोध नहीं भेजता और आपकी खेल-प्रगति सहेजता नहीं है। अनुवादित पाठ केवल आपके डिवाइस के ब्राउज़र की आवाज़ से पढ़ा जाता है; आवाज़ बनाने के लिए पाठ कहीं नहीं भेजा जाता और कोई सशुल्क जनरेशन नहीं होती। Google WaveNet की सार्वजनिक रिकॉर्डिंग केवल अंग्रेज़ी में उपलब्ध है।'
    }
  },
  'uk-UA': {
    story: {
      title: 'Ліхтарик на маленькій станції',
      dedication: 'Для тих, кому не завадить маленька несподівана пригода.',
      scenes: [
        {
          title: 'Квиток без пункту призначення',
          body: 'На тихій станції Алекс знаходить паперовий квиток під чашкою чаю. На звороті Сем написав: «Сьогодні поїзди не ходять. Краще йди за маленькими вогниками». Три розмальовані ліхтарі ведуть від платформи до садової хвіртки.',
          clue: 'Знайди місце, де можна разом перепочити.'
        },
        {
          title: 'Сад за хвірткою',
          body: 'У саду червона стрічка пов’язана навколо невеликої дерев’яної лавки. Поруч стоїть накритий кошик і лежить записка: «Ти принеси історії, а я — щось тепле попити». З-під кришки визирає картата ковдра. Для цього не потрібна особлива нагода.',
          clue: 'Кошик, ковдра й їжа, якою діляться просто неба. Що підготував Сем?'
        }
      ],
      answer: 'пікнік',
      message: 'Пікнік — тільки для нас. Без поспіху й без особливої нагоди. Іноді найкращий подарунок — це трохи часу разом.'
    },
    copy: {
      title: 'Muse — Спробуйте історію',
      description: 'Спробуйте оригінальну вигадану загадку Muse. Без облікового запису, генерації ШІ та приватних даних отримувача.',
      sampleNotice: 'Це вигадана історія, створена вручну й доступна безкоштовно. Це не справжній подарунок і не результат генерації ШІ.',
      openingPrompt: 'Невелика пригода для вас',
      openStory: 'Відкрити приклад історії',
      durationNotice: 'Приблизно дві хвилини. Нічого не відтворюється автоматично.',
      revealHeading: 'Ваш сюрприз',
      revealFor: 'Так може завершитися подарунок, створений із турботою. У вашій історії можуть бути приватне повідомлення, фото, відео чи голосовий запис.',
      createGift: 'Створити історію для когось',
      tryPersonal: 'Або спробувати історію для себе',
      restart: 'Спробувати ще раз',
      sceneCount: (current, total) => `Сцена ${current} із ${total}`,
      clueLabel: 'Підказка:',
      listenScene: 'Прослухати сцену',
      narrationNotice: 'Браузер пристрою озвучує цей переклад; доступність голосу й вимова залежать від пристрою. Попередньо записане аудіо є лише англійською.',
      narrationPreparing: 'Підготовка озвучення…',
      narrationSpeaking: 'Озвучення…',
      narrationPaused: 'Озвучення призупинено',
      narrationResume: 'Продовжити озвучення',
      narrationPause: 'Призупинити озвучення',
      narrationStop: 'Зупинити озвучення',
      narrationUnavailable: 'У браузері чи на пристрої може не бути голосу для цієї мови.',
      narrationError: 'Не вдалося почати озвучення. Ви можете продовжити читати.',
      continue: 'Ідіть за ліхтарями',
      answerQuestion: 'Що підготував Сем?',
      answerPlaceholder: 'Введіть відповідь',
      submitAnswer: 'Спробувати відповідь',
      incorrectAnswer: 'Не зовсім. Подумайте про їжу, якою діляться просто неба. Спробуйте ще раз або відкрийте розгадку нижче.',
      hintPrompt: 'Потрібна невелика підказка?',
      showHint: 'Показати підказку',
      hint: 'Відповідь — пікнік. Цей приклад показує, як працює Muse, а не перевіряє вас.',
      revealButton: 'Відкрити розгадку',
      privacyNotice: 'Ця демоверсія не надсилає запитів на створення історій і не зберігає проходження. Переклад озвучує лише браузер на пристрої; текст не передається для синтезу мовлення й не використовується платна генерація. Публічні попередні записи Google WaveNet доступні лише англійською.'
    }
  },
  'ar-SA': {
    story: {
      title: 'الفانوس في المحطة الصغيرة',
      dedication: 'لكل من يرغب في مغامرة صغيرة وغير متوقعة.',
      scenes: [
        {
          title: 'تذكرة بلا وجهة',
          body: 'في محطة هادئة، يجد أليكس تذكرة ورقية تحت فنجان شاي. كتب سام على ظهرها: «لا توجد قطارات اليوم. اتبع الأضواء الصغيرة بدلًا من ذلك». تقود ثلاثة فوانيس مرسومة من الرصيف إلى بوابة حديقة.',
          clue: 'ابحث عن مكان يستطيع فيه الناس التوقف معًا قليلًا.'
        },
        {
          title: 'الحديقة خلف البوابة',
          body: 'في الحديقة، رُبط شريط أحمر حول مقعد خشبي صغير. وبجانبه سلة مغطاة وملاحظة: «أحضر أنت القصص، وسأحضر شيئًا دافئًا للشرب». يظهر طرف بطانية مربعة النقوش من تحت الغطاء. لا تحتاج هذه اللحظة إلى مناسبة كبيرة.',
          clue: 'سلة وبطانية وطعام نتشاركه في الخارج. ماذا أعدّ سام؟'
        }
      ],
      answer: 'نزهة',
      message: 'نزهة لنا وحدنا. بلا استعجال ولا مناسبة خاصة. أحيانًا تكون أجمل هدية هي قليل من الوقت معًا.'
    },
    copy: {
      title: 'Muse - جرّب قصة قصيرة',
      description: 'جرّب لغزًا خياليًا أصليًا من Muse. بلا حساب أو إنشاء بالذكاء الاصطناعي أو بيانات خاصة بالمستلم.',
      sampleNotice: 'قصة تجريبية خيالية ومكتوبة يدويًا ومجانية. ليست هدية حقيقية ولا نتيجة مولّدة بالذكاء الاصطناعي.',
      openingPrompt: 'مغامرة صغيرة من أجلك',
      openStory: 'افتح القصة التجريبية',
      durationNotice: 'نحو دقيقتين. لا يبدأ أي شيء تلقائيًا.',
      revealHeading: 'مفاجأتك في القصة',
      revealFor: 'هكذا يمكن أن تنتهي هدية أُعدّت بعناية. يمكن أن تتضمن قصتك رسالة خاصة أو صورة أو فيديو أو تسجيلًا صوتيًا.',
      createGift: 'أنشئ قصة لشخص ما',
      tryPersonal: 'أو جرّب قصة لنفسك',
      restart: 'جرّب القصة مرة أخرى',
      sceneCount: (current, total) => `المشهد ${current} من ${total}`,
      clueLabel: 'تلميح:',
      listenScene: 'استمع إلى هذا المشهد',
      narrationNotice: 'يقرأ متصفح جهازك النص المترجم؛ ويختلف توفر الصوت والنطق حسب الجهاز. التسجيل الصوتي الجاهز متوفر بالإنجليزية فقط.',
      narrationPreparing: 'جارٍ إعداد القراءة…',
      narrationSpeaking: 'جارٍ القراءة…',
      narrationPaused: 'القراءة متوقفة مؤقتًا',
      narrationResume: 'متابعة القراءة',
      narrationPause: 'إيقاف القراءة مؤقتًا',
      narrationStop: 'إيقاف القراءة',
      narrationUnavailable: 'قد لا يتوفر صوت بهذه اللغة في المتصفح أو الجهاز.',
      narrationError: 'تعذّر بدء القراءة. يمكنك متابعة القراءة بنفسك.',
      continue: 'اتبع الفوانيس',
      answerQuestion: 'ماذا أعدّ سام؟',
      answerPlaceholder: 'اكتب إجابتك',
      submitAnswer: 'جرّب هذه الإجابة',
      incorrectAnswer: 'ليس تمامًا. فكّر في وجبة نتشاركها في الخارج. يمكنك المحاولة مجددًا أو فتح كشف القصة أدناه.',
      hintPrompt: 'هل تحتاج إلى مساعدة بسيطة؟',
      showHint: 'أظهر تلميحًا',
      hint: 'الإجابة هي نزهة. هذا المثال ليوضح طريقة عمل Muse، وليس لاختبارك.',
      revealButton: 'افتح كشف القصة',
      privacyNotice: 'لا يرسل هذا العرض أي طلبات لإنشاء قصة ولا يحفظ تقدّمك. يقرأ متصفح جهازك النص المترجم محليًا؛ ولا يُرسل النص لتوليد الصوت ولا تُستخدم خدمة مدفوعة. التسجيلات العامة الجاهزة من Google WaveNet متاحة بالإنجليزية فقط.'
    }
  }
}

export function demoLocalization(language: StoryLanguageCode): DemoLocalization {
  return localizations[language]
}
