import type { StoryLanguageCode } from './storyLanguage'

export type DemoScene = { title: string; body: string; question: string; choices: [string, string, string] }
export type DemoStory = {
  title: string
  dedication: string
  scenes: [DemoScene, DemoScene, DemoScene]
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
  yourChoices: string
  choiceEcho: string
  createGift: string
  tryPersonal: string
  restart: string
  sceneCount: (current: number, total: number) => string
  clueLabel: string
  listenScene: string
  narrationNotice: string
  narrationSettings: string
  narrationTroubleshooting: string
  narrationMuted: string
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
        body: 'At a quiet station, Alex finds a paper ticket tucked under a cup of tea. On the back, Sam has written: "No trains today. Follow the little lights instead." Three painted lanterns lead from the platform toward a garden gate. The evening is still young, and there is no need to decide where it will lead.',
        question: 'What would you like to do first?',
        choices: ['Follow the lanterns', 'Read Sam’s note again', 'Take the ticket to the garden']
      },
      {
        title: 'The garden beyond the gate',
        body: 'Inside the garden, a red ribbon is tied around a small wooden bench. Beside it is a covered basket and a note: "You bring the stories. I will bring something warm to drink." A checked blanket peeks out from beneath the lid. Sam arrives with two cups, smiling as if this quiet plan has been waiting all week.',
        question: 'What would you bring into this moment?',
        choices: ['A story from today', 'A song you both know', 'A question for Sam']
      },
      {
        title: 'An evening without a hurry',
        body: 'The basket holds a simple picnic. You settle beneath the lanterns, sharing warm tea and the small details of your day. The garden grows quieter around you; nothing needs solving, and neither of you has to hurry home just yet.',
        question: 'How would you like to remember the evening?',
        choices: ['Stay a little longer', 'Leave a note for next time', 'Carry the quiet feeling home']
      }
    ],
    message: 'The lanterns stay lit as you walk home. It was only a picnic, but it gave the two of you a little time that belonged to no one else.'
  },
  copy: {
    title: 'Muse - Try a sample story',
    description: 'Try an original, fictional Muse story. No account, AI generation or private recipient data.',
    sampleNotice: 'A three-scene, handcrafted story with choices and a gentle ending. Fictional and free to try.',
    openingPrompt: 'A little adventure for you',
    openStory: 'Open sample story',
    durationNotice: 'About five minutes. Nothing plays automatically.',
    revealHeading: 'A little time together',
    revealFor: 'Your own Muse story can include a private message, photo, video or voice recording.',
    yourChoices: 'Your choices',
    choiceEcho: 'You chose: {choice}',
    createGift: 'Make a story for someone',
    tryPersonal: 'Or try a story for yourself',
    restart: 'Try the sample again',
    sceneCount: (current, total) => `Scene ${current} of ${total}`,
    clueLabel: 'Clue:',
    listenScene: 'Listen to this scene',
    narrationNotice: 'This sample uses your browser’s built-in voice, not Google Chirp. Available voices vary; nothing is sent for narration.',
    narrationSettings: 'Voice and volume settings',
    narrationTroubleshooting: 'If you see narration status but hear nothing, check your device media volume and the voice volume setting here.',
    narrationMuted: 'Voice volume is 0%. Raise it in Audio settings to hear narration.',
    narrationPreparing: 'Preparing narration…',
    narrationSpeaking: 'Narrating…',
    narrationPaused: 'Narration paused',
    narrationResume: 'Resume narration',
    narrationPause: 'Pause narration',
    narrationStop: 'Stop narration',
    narrationUnavailable: 'A voice for this language may not be available in your browser or device.',
    narrationError: 'The narration could not be played. You can keep reading.',
    continue: 'Continue story',
    answerQuestion: 'What has Sam planned?',
    answerPlaceholder: 'Type your answer',
    submitAnswer: 'Try this answer',
    incorrectAnswer: 'Not quite. Think of a meal shared outside. You can try again or open the sample reveal below.',
    hintPrompt: 'Need a little help?',
    showHint: 'Show a hint',
    hint: 'The answer is a picnic. This sample is here to show how Muse works, not to test you.',
    revealButton: 'Finish story',
    privacyNotice: 'This demo makes no story-generation requests and saves no playthrough. Narration uses browser speech on your device; story text is not sent to a speech service.'
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
          body: 'In una stazione tranquilla, Alex trova un biglietto di carta infilato sotto una tazza di tè. Sul retro, Sam ha scritto: «Oggi non partono treni. Segui invece le piccole luci». Tre lanterne dipinte conducono dal binario a un cancello del giardino. La sera è ancora giovane e non serve decidere dove porterà la strada.',
          question: 'Che cosa vuoi fare per prima cosa?',
          choices: ['Seguire le lanterne', 'Rileggere il biglietto di Sam', 'Portare il biglietto in giardino']
        },
        {
          title: 'Il giardino oltre il cancello',
          body: 'Nel giardino, un nastro rosso è legato a una piccola panchina di legno. Accanto ci sono un cestino coperto e un biglietto: «Tu porta le storie. Io porterò qualcosa di caldo da bere». Da sotto il coperchio spunta una coperta a quadretti. Sam arriva con due tazze e un sorriso, come se questo piccolo piano aspettasse da tutta la settimana.',
          question: 'Che cosa porteresti in questo momento?',
          choices: ['Un racconto della giornata', 'Una canzone che conoscete entrambi', 'Una domanda per Sam']
        },
        {
          title: 'Una sera senza fretta',
          body: 'Nel cestino c’è un picnic semplice. Vi sistemate sotto le lanterne, condividendo tè caldo e i piccoli dettagli della giornata. Il giardino intorno a voi diventa più silenzioso: non c’è niente da risolvere e nessuno dei due deve ancora correre a casa.',
          question: 'Come vuoi ricordare questa sera?',
          choices: ['Restare ancora un po’', 'Lasciare un biglietto per la prossima volta', 'Portare a casa quella sensazione di quiete']
        }
      ],
      message: 'Le lanterne restano accese mentre tornate a casa. È stato solo un picnic, ma vi ha regalato un po’ di tempo tutto vostro.'
    },
    copy: {
      title: 'Muse - Prova una storia di esempio',
      description: 'Prova una storia originale e immaginaria di Muse. Nessun account, nessuna generazione con IA e nessun dato privato del destinatario.',
      sampleNotice: 'Una storia di tre scene, scritta a mano, con scelte e un finale delicato. Immaginaria e gratuita.',
      openingPrompt: 'Una piccola avventura per te',
      openStory: 'Apri la storia di esempio',
      durationNotice: 'Circa cinque minuti. Nulla si avvia automaticamente.',
      revealHeading: 'Un po’ di tempo insieme',
      revealFor: 'La tua storia Muse può includere un messaggio privato, una foto, un video o una registrazione vocale.',
      yourChoices: 'Le tue scelte',
      choiceEcho: 'Hai scelto: {choice}',
      createGift: 'Crea una storia per qualcuno',
      tryPersonal: 'Oppure prova una storia per te',
      restart: 'Riprova l’esempio',
      sceneCount: (current, total) => `Scena ${current} di ${total}`,
      clueLabel: 'Indizio:',
      listenScene: 'Ascolta questa scena',
      narrationNotice: 'Questo esempio usa la voce integrata nel browser, non Google Chirp. Le voci disponibili variano; il testo non viene inviato.',
      narrationSettings: 'Impostazioni voce e volume',
      narrationTroubleshooting: 'Se vedi lo stato della lettura ma non senti nulla, controlla il volume del dispositivo e quello della voce qui.',
      narrationMuted: 'Il volume della voce è allo 0%. Aumentalo nelle impostazioni Audio.',
      narrationPreparing: 'Preparazione della lettura…',
      narrationSpeaking: 'Lettura in corso…',
      narrationPaused: 'Lettura in pausa',
      narrationResume: 'Riprendi la lettura',
      narrationPause: 'Metti in pausa la lettura',
      narrationStop: 'Interrompi la lettura',
      narrationUnavailable: 'Nel browser o dispositivo potrebbe non essere disponibile una voce per questa lingua.',
      narrationError: 'Non è stato possibile avviare la lettura. Puoi continuare a leggere.',
      continue: 'Continua la storia',
      answerQuestion: 'Che cosa ha organizzato Sam?',
      answerPlaceholder: 'Scrivi la risposta',
      submitAnswer: 'Prova questa risposta',
      incorrectAnswer: 'Non proprio. Pensa a un pasto condiviso all’aperto. Puoi riprovare o aprire la rivelazione qui sotto.',
      hintPrompt: 'Ti serve un piccolo aiuto?',
      showHint: 'Mostra un indizio',
      hint: 'La risposta è un picnic. Questo esempio mostra come funziona Muse: non è un test.',
      revealButton: 'Concludi la storia',
      privacyNotice: 'Questa demo non invia richieste di generazione e non salva la partita. La lettura usa la voce del browser sul dispositivo; il testo della storia non viene inviato a un servizio di sintesi vocale.'
    }
  },
  'es-ES': {
    story: {
      title: 'La linterna de la pequeña estación',
      dedication: 'Para quien necesite una pequeña aventura inesperada.',
      scenes: [
        {
          title: 'Un billete sin destino',
          body: 'En una estación tranquila, Alex encuentra un billete de papel escondido bajo una taza de té. En el reverso, Sam ha escrito: «Hoy no hay trenes. Sigue las lucecitas». Tres faroles pintados conducen desde el andén hasta la verja de un jardín. La tarde aún es joven y no hace falta saber adónde llevará el camino.',
          question: '¿Qué te gustaría hacer primero?',
          choices: ['Seguir los faroles', 'Leer otra vez la nota de Sam', 'Llevar el billete hasta el jardín']
        },
        {
          title: 'El jardín al otro lado de la verja',
          body: 'Dentro del jardín, una cinta roja rodea un pequeño banco de madera. A su lado hay una cesta tapada y una nota: «Tú trae las historias. Yo traeré algo calentito para beber». Bajo la tapa asoma una manta de cuadros. Sam llega con dos tazas y una sonrisa, como si este pequeño plan llevara toda la semana esperando.',
          question: '¿Qué traerías a este momento?',
          choices: ['Una historia de hoy', 'Una canción que ambos conozcáis', 'Una pregunta para Sam']
        },
        {
          title: 'Una tarde sin prisas',
          body: 'La cesta guarda un pícnic sencillo. Os acomodáis bajo los faroles, compartiendo té caliente y los pequeños detalles del día. El jardín se vuelve más silencioso a vuestro alrededor; no hay nada que resolver ni necesidad de volver corriendo a casa.',
          question: '¿Cómo te gustaría recordar la tarde?',
          choices: ['Quedarte un poco más', 'Dejar una nota para la próxima vez', 'Llevarte a casa esa sensación de calma']
        }
      ],
      message: 'Los faroles siguen encendidos mientras volvéis a casa. Solo fue un pícnic, pero os regaló un rato que os pertenecía por completo.'
    },
    copy: {
      title: 'Muse - Prueba una historia de ejemplo',
      description: 'Prueba una historia original y ficticia de Muse. Sin cuenta, generación con IA ni datos privados del destinatario.',
      sampleNotice: 'Una historia artesanal de tres escenas, con decisiones y un final tranquilo. Ficticia y gratuita.',
      openingPrompt: 'Una pequeña aventura para ti',
      openStory: 'Abrir la historia de ejemplo',
      durationNotice: 'Unos cinco minutos. No se reproduce nada automáticamente.',
      revealHeading: 'Un rato para compartir',
      revealFor: 'Tu historia de Muse puede incluir un mensaje privado, una foto, un vídeo o una grabación de voz.',
      yourChoices: 'Tus decisiones',
      choiceEcho: 'Elegiste: {choice}',
      createGift: 'Crear una historia para alguien',
      tryPersonal: 'O prueba una historia para ti',
      restart: 'Probar de nuevo',
      sceneCount: (current, total) => `Escena ${current} de ${total}`,
      clueLabel: 'Pista:',
      listenScene: 'Escuchar esta escena',
      narrationNotice: 'Esta muestra usa la voz integrada del navegador, no Google Chirp. Las voces disponibles varían; el texto no se envía.',
      narrationSettings: 'Ajustes de voz y volumen',
      narrationTroubleshooting: 'Si aparece el estado de narración pero no oyes nada, comprueba el volumen multimedia del dispositivo y el volumen de voz aquí.',
      narrationMuted: 'El volumen de voz está al 0 %. Súbelo en los ajustes de audio.',
      narrationPreparing: 'Preparando la lectura…',
      narrationSpeaking: 'Leyendo…',
      narrationPaused: 'Lectura en pausa',
      narrationResume: 'Reanudar lectura',
      narrationPause: 'Pausar lectura',
      narrationStop: 'Detener lectura',
      narrationUnavailable: 'Es posible que tu navegador o dispositivo no tenga una voz para este idioma.',
      narrationError: 'No se pudo iniciar la lectura. Puedes seguir leyendo.',
      continue: 'Continuar la historia',
      answerQuestion: '¿Qué ha preparado Sam?',
      answerPlaceholder: 'Escribe tu respuesta',
      submitAnswer: 'Probar esta respuesta',
      incorrectAnswer: 'No exactamente. Piensa en una comida compartida al aire libre. Puedes volver a intentarlo o ver la revelación de abajo.',
      hintPrompt: '¿Necesitas una pequeña ayuda?',
      showHint: 'Mostrar una pista',
      hint: 'La respuesta es un pícnic. Este ejemplo sirve para mostrar cómo funciona Muse, no para ponerte a prueba.',
      revealButton: 'Terminar la historia',
      privacyNotice: 'Esta demo no envía solicitudes para generar historias ni guarda la partida. La narración usa la voz del navegador en tu dispositivo; el texto no se envía a un servicio de voz.'
    }
  },
  'zh-CN': {
    story: {
      title: '小车站的灯笼',
      dedication: '送给想要一场小小意外冒险的你。',
      scenes: [
        {
          title: '一张没有目的地的车票',
          body: '在一座安静的车站，亚历克斯发现一张纸车票塞在茶杯下面。背面写着萨姆的话：「今天没有火车。跟着这些小灯走吧。」三盏彩绘灯笼从站台一路指向花园的大门。夜色还早，不必急着决定这条路会通向哪里。',
          question: '你想先做什么？',
          choices: ['跟着灯笼走', '再读一遍萨姆的纸条', '带着车票去花园']
        },
        {
          title: '门那边的花园',
          body: '花园里，一条红丝带系在一张小木长椅上。旁边放着一个盖好的篮子和一张纸条：「你带上故事，我来带些热饮。」一条格子毯从篮盖下露出一角。萨姆带着两杯热茶走来，笑容仿佛这个小小的计划已经等了一整周。',
          question: '你想为这个时刻带来什么？',
          choices: ['今天发生的一件小事', '你们都熟悉的一首歌', '一个想问萨姆的问题']
        },
        {
          title: '不必匆忙的夜晚',
          body: '篮子里是一顿简单的野餐。你们坐在灯笼下，分享热茶和一天里那些微小的事情。花园渐渐安静下来，没有什么需要解决，也不必急着回家。',
          question: '你想怎样记住这个夜晚？',
          choices: ['再多待一会儿', '留张纸条给下次见面', '把这份宁静带回家']
        }
      ],
      message: '回家的路上，灯笼仍亮着。这只是一场野餐，却给了你们一段只属于彼此的时光。'
    },
    copy: {
      title: 'Muse - 试读故事示例',
      description: '体验 Muse 原创虚构故事。无需账户，不会使用 AI 生成，也不会收集收礼人的私人信息。',
      sampleNotice: '这是一段手工创作的三幕故事，包含选择和温柔的结尾。内容虚构，可免费体验。',
      openingPrompt: '一场为你准备的小冒险',
      openStory: '打开故事示例',
      durationNotice: '大约五分钟。不会自动播放任何内容。',
      revealHeading: '共度一段时光',
      revealFor: '你自己的 Muse 故事还可以包含私人留言、照片、视频或语音录音。',
      yourChoices: '你的选择',
      choiceEcho: '你选择了：{choice}',
      createGift: '为某人创作故事',
      tryPersonal: '或者体验一个属于自己的故事',
      restart: '再试一次示例',
      sceneCount: (current, total) => `第 ${current} 幕，共 ${total} 幕`,
      clueLabel: '线索：',
      listenScene: '朗读这一幕',
      narrationNotice: '此示例使用浏览器内置语音，而非 Google Chirp。可用语音因设备而异；故事文本不会发送。',
      narrationSettings: '语音和音量设置',
      narrationTroubleshooting: '如果显示朗读状态但听不到声音，请检查设备媒体音量和此处的语音音量。',
      narrationMuted: '语音音量为 0%。请在音频设置中调高音量。',
      narrationPreparing: '正在准备朗读…',
      narrationSpeaking: '正在朗读…',
      narrationPaused: '朗读已暂停',
      narrationResume: '继续朗读',
      narrationPause: '暂停朗读',
      narrationStop: '停止朗读',
      narrationUnavailable: '你的浏览器或设备可能没有此语言的语音。',
      narrationError: '无法开始朗读，你仍然可以继续阅读。',
      continue: '继续故事',
      answerQuestion: '萨姆准备了什么？',
      answerPlaceholder: '输入你的答案',
      submitAnswer: '提交答案',
      incorrectAnswer: '还不太对。想想在户外分享的一顿饭。你可以再试一次，也可以打开下方的故事揭晓。',
      hintPrompt: '需要一点提示吗？',
      showHint: '显示提示',
      hint: '答案是野餐。这个示例是为了展示 Muse 的体验，不是考试。',
      revealButton: '结束故事',
      privacyNotice: '本演示不会发送故事生成请求，也不会保存游玩记录。朗读使用设备上的浏览器语音；故事文本不会发送到语音服务。'
    }
  },
  'hi-IN': {
    story: {
      title: 'छोटे स्टेशन का लालटेन',
      dedication: 'उन सभी के लिए जिन्हें एक छोटे, अनपेक्षित रोमांच की ज़रूरत है।',
      scenes: [
        {
          title: 'बिना मंज़िल का टिकट',
          body: 'एक शांत स्टेशन पर एलेक्स को चाय के कप के नीचे दबा एक कागज़ का टिकट मिलता है। उसके पीछे सैम ने लिखा है: «आज कोई ट्रेन नहीं है। इसके बजाय इन छोटी रोशनियों के पीछे चलो।» तीन रंगे हुए लालटेन प्लेटफ़ॉर्म से बगीचे के फाटक तक रास्ता दिखाते हैं। शाम अभी बाकी है; यह तय करना ज़रूरी नहीं कि रास्ता कहाँ ले जाएगा।',
          question: 'आप सबसे पहले क्या करना चाहेंगे?',
          choices: ['लालटेनों के पीछे चलना', 'सैम की पर्ची फिर से पढ़ना', 'टिकट लेकर बगीचे तक जाना']
        },
        {
          title: 'फाटक के पार का बगीचा',
          body: 'बगीचे में लकड़ी की छोटी बेंच पर लाल रिबन बँधा है। पास में ढकी हुई टोकरी और एक पर्ची है: «तुम कहानियाँ लाना। मैं पीने के लिए कुछ गरम लाऊँगा।» टोकरी के ढक्कन के नीचे से चौखानेदार कंबल झाँक रहा है। सैम दो कप लेकर आता है और मुस्कराता है, जैसे यह छोटा-सा इरादा पूरे हफ़्ते से इंतज़ार कर रहा हो।',
          question: 'इस पल में आप क्या साथ लाएँगे?',
          choices: ['आज की एक कहानी', 'आप दोनों का पसंदीदा गीत', 'सैम से पूछने के लिए एक सवाल']
        },
        {
          title: 'बिना जल्दबाज़ी की शाम',
          body: 'टोकरी में एक साधारण पिकनिक है। आप लालटेनों के नीचे बैठकर गरम चाय और दिन की छोटी-छोटी बातें बाँटते हैं। बगीचा धीरे-धीरे शांत हो जाता है; कुछ भी सुलझाना नहीं है और घर लौटने की जल्दी भी नहीं।',
          question: 'आप इस शाम को कैसे याद रखना चाहेंगे?',
          choices: ['थोड़ी देर और रुकना', 'अगली बार के लिए एक पर्ची छोड़ना', 'इस सुकून को साथ घर ले जाना']
        }
      ],
      message: 'घर लौटते समय लालटेन जलती रहती हैं। यह बस एक पिकनिक थी, लेकिन इसने आपको साथ बिताने के लिए थोड़ा-सा समय दिया।'
    },
    copy: {
      title: 'Muse - नमूना कहानी आज़माएँ',
      description: 'Muse की एक मौलिक, काल्पनिक कहानी आज़माएँ। कोई खाता नहीं, AI से कहानी नहीं बनती और प्राप्तकर्ता का निजी डेटा नहीं लिया जाता।',
      sampleNotice: 'तीन दृश्यों की यह हाथ से लिखी कहानी विकल्पों और कोमल अंत के साथ आती है। काल्पनिक और मुफ़्त।',
      openingPrompt: 'आपके लिए एक छोटा रोमांच',
      openStory: 'नमूना कहानी खोलें',
      durationNotice: 'लगभग पाँच मिनट। कुछ भी अपने-आप नहीं चलता।',
      revealHeading: 'साथ बिताया थोड़ा समय',
      revealFor: 'आपकी अपनी Muse कहानी में निजी संदेश, फ़ोटो, वीडियो या आवाज़ की रिकॉर्डिंग हो सकती है।',
      yourChoices: 'आपके विकल्प',
      choiceEcho: 'आपने चुना: {choice}',
      createGift: 'किसी के लिए कहानी बनाएँ',
      tryPersonal: 'या अपने लिए कहानी आज़माएँ',
      restart: 'नमूना फिर से आज़माएँ',
      sceneCount: (current, total) => `दृश्य ${current} / ${total}`,
      clueLabel: 'संकेत:',
      listenScene: 'यह दृश्य सुनें',
      narrationNotice: 'यह नमूना ब्राउज़र की अंतर्निहित आवाज़ का उपयोग करता है, Google Chirp का नहीं। आवाज़ें डिवाइस के अनुसार बदलती हैं; पाठ कहीं नहीं भेजा जाता।',
      narrationSettings: 'आवाज़ और वॉल्यूम सेटिंग',
      narrationTroubleshooting: 'अगर पढ़ने का स्टेटस दिखे लेकिन आवाज़ न आए, तो डिवाइस का मीडिया वॉल्यूम और यहाँ आवाज़ का वॉल्यूम जाँचें।',
      narrationMuted: 'आवाज़ का वॉल्यूम 0% है। सुनने के लिए ऑडियो सेटिंग में इसे बढ़ाएँ।',
      narrationPreparing: 'आवाज़ तैयार हो रही है…',
      narrationSpeaking: 'पढ़ा जा रहा है…',
      narrationPaused: 'पढ़ना रुका हुआ है',
      narrationResume: 'पढ़ना जारी रखें',
      narrationPause: 'पढ़ना रोकें',
      narrationStop: 'पढ़ना बंद करें',
      narrationUnavailable: 'आपके ब्राउज़र या डिवाइस में इस भाषा की आवाज़ उपलब्ध नहीं हो सकती।',
      narrationError: 'आवाज़ शुरू नहीं हो सकी। आप पढ़ना जारी रख सकते हैं।',
      continue: 'कहानी जारी रखें',
      answerQuestion: 'सैम ने क्या रखा है?',
      answerPlaceholder: 'अपना जवाब लिखें',
      submitAnswer: 'यह जवाब आज़माएँ',
      incorrectAnswer: 'अभी नहीं। बाहर साथ बैठकर खाए जाने वाले भोजन के बारे में सोचें। फिर कोशिश करें या नीचे कहानी का अंत खोलें।',
      hintPrompt: 'थोड़ी मदद चाहिए?',
      showHint: 'संकेत दिखाएँ',
      hint: 'जवाब पिकनिक है। यह नमूना Muse का तरीका दिखाने के लिए है, आपकी परीक्षा लेने के लिए नहीं।',
      revealButton: 'कहानी समाप्त करें',
      privacyNotice: 'यह डेमो कहानी बनाने का अनुरोध नहीं भेजता और आपकी प्रगति सहेजता नहीं है। आवाज़ आपके डिवाइस के ब्राउज़र से आती है; कहानी का पाठ किसी आवाज़ सेवा को नहीं भेजा जाता।'
    }
  },
  'uk-UA': {
    story: {
      title: 'Ліхтарик на маленькій станції',
      dedication: 'Для тих, кому не завадить маленька несподівана пригода.',
      scenes: [
        {
          title: 'Квиток без пункту призначення',
          body: 'На тихій станції Алекс знаходить паперовий квиток під чашкою чаю. На звороті Сем написав: «Сьогодні поїзди не ходять. Краще йди за маленькими вогниками». Три розмальовані ліхтарі ведуть від платформи до садової хвіртки. Вечір тільки починається, і не обов’язково знати, куди приведе ця дорога.',
          question: 'Що хочеться зробити спочатку?',
          choices: ['Піти за ліхтарями', 'Ще раз прочитати записку Сема', 'Взяти квиток із собою до саду']
        },
        {
          title: 'Сад за хвірткою',
          body: 'У саду червона стрічка пов’язана навколо невеликої дерев’яної лавки. Поруч стоїть накритий кошик і лежить записка: «Ти принеси історії, а я — щось тепле попити». З-під кришки визирає картата ковдра. Сем приходить із двома горнятками й усмішкою, ніби цей невеликий задум чекав цілий тиждень.',
          question: 'Що ти принесеш у цю мить?',
          choices: ['Історію про сьогодні', 'Пісню, яку ви обоє знаєте', 'Запитання до Сема']
        },
        {
          title: 'Вечір без поспіху',
          body: 'У кошику — простий пікнік. Ви вмощуєтеся під ліхтарями, п’єте теплий чай і ділитеся дрібницями дня. Навколо стає тихіше; нічого не потрібно вирішувати, і нікому не треба поспішати додому.',
          question: 'Як ти хочеш запам’ятати цей вечір?',
          choices: ['Залишитися ще трохи', 'Залишити записку на наступну зустріч', 'Забрати це відчуття спокою із собою']
        }
      ],
      message: 'Ліхтарі ще світяться, коли ви йдете додому. Це був лише пікнік, але він подарував вам трохи часу тільки для вас.'
    },
    copy: {
      title: 'Muse — Спробуйте історію',
      description: 'Спробуйте оригінальну вигадану історію Muse. Без облікового запису, генерації ШІ та приватних даних отримувача.',
      sampleNotice: 'Рукописна історія з трьох сцен, виборами та теплим завершенням. Вигадана й безкоштовна.',
      openingPrompt: 'Невелика пригода для вас',
      openStory: 'Відкрити приклад історії',
      durationNotice: 'Приблизно п’ять хвилин. Нічого не відтворюється автоматично.',
      revealHeading: 'Трохи часу разом',
      revealFor: 'Ваша історія Muse може містити приватне повідомлення, фото, відео чи голосовий запис.',
      yourChoices: 'Ваші вибори',
      choiceEcho: 'Ви обрали: {choice}',
      createGift: 'Створити історію для когось',
      tryPersonal: 'Або спробувати історію для себе',
      restart: 'Спробувати ще раз',
      sceneCount: (current, total) => `Сцена ${current} із ${total}`,
      clueLabel: 'Підказка:',
      listenScene: 'Прослухати сцену',
      narrationNotice: 'У цьому прикладі використовується вбудований голос браузера, а не Google Chirp. Доступність голосів залежить від пристрою; текст не надсилається.',
      narrationSettings: 'Налаштування голосу та гучності',
      narrationTroubleshooting: 'Якщо бачите статус озвучення, але не чуєте звуку, перевірте медіагучність пристрою та гучність голосу тут.',
      narrationMuted: 'Гучність голосу — 0%. Збільште її в налаштуваннях аудіо.',
      narrationPreparing: 'Підготовка озвучення…',
      narrationSpeaking: 'Озвучення…',
      narrationPaused: 'Озвучення призупинено',
      narrationResume: 'Продовжити озвучення',
      narrationPause: 'Призупинити озвучення',
      narrationStop: 'Зупинити озвучення',
      narrationUnavailable: 'У браузері чи на пристрої може не бути голосу для цієї мови.',
      narrationError: 'Не вдалося почати озвучення. Ви можете продовжити читати.',
      continue: 'Продовжити історію',
      answerQuestion: 'Що підготував Сем?',
      answerPlaceholder: 'Введіть відповідь',
      submitAnswer: 'Спробувати відповідь',
      incorrectAnswer: 'Не зовсім. Подумайте про їжу, якою діляться просто неба. Спробуйте ще раз або відкрийте розгадку нижче.',
      hintPrompt: 'Потрібна невелика підказка?',
      showHint: 'Показати підказку',
      hint: 'Відповідь — пікнік. Цей приклад показує, як працює Muse, а не перевіряє вас.',
      revealButton: 'Завершити історію',
      privacyNotice: 'Ця демоверсія не надсилає запитів на створення історій і не зберігає проходження. Озвучення використовує браузер на пристрої; текст історії не надсилається до голосового сервісу.'
    }
  },
  'ar-SA': {
    story: {
      title: 'الفانوس في المحطة الصغيرة',
      dedication: 'لكل من يرغب في مغامرة صغيرة وغير متوقعة.',
      scenes: [
        {
          title: 'تذكرة بلا وجهة',
          body: 'في محطة هادئة، يجد أليكس تذكرة ورقية تحت فنجان شاي. كتب سام على ظهرها: «لا توجد قطارات اليوم. اتبع الأضواء الصغيرة بدلًا من ذلك». تقود ثلاثة فوانيس مرسومة من الرصيف إلى بوابة حديقة. ما زال المساء في أوله، ولا حاجة إلى معرفة إلى أين سيقود هذا الطريق.',
          question: 'ماذا تود أن تفعل أولًا؟',
          choices: ['اتباع الفوانيس', 'قراءة ملاحظة سام مرة أخرى', 'أخذ التذكرة إلى الحديقة']
        },
        {
          title: 'الحديقة خلف البوابة',
          body: 'في الحديقة، يلتف شريط أحمر حول مقعد خشبي صغير. وبجانبه سلة مغطاة وملاحظة: «أحضر أنت القصص، وسأحضر شيئًا دافئًا للشرب». يظهر طرف بطانية مربعة النقوش من تحت الغطاء. يصل سام ومعه كوبان، مبتسمًا كأن هذه الخطة الهادئة كانت تنتظر منذ أسبوع.',
          question: 'ماذا تحمل معك إلى هذه اللحظة؟',
          choices: ['حكاية من هذا اليوم', 'أغنية يعرفها كلاكما', 'سؤالًا تود طرحه على سام']
        },
        {
          title: 'مساء بلا عجلة',
          body: 'في السلة نزهة بسيطة. تجلسان تحت الفوانيس، تتشاركان الشاي الدافئ وتفاصيل صغيرة من يومكما. تصبح الحديقة أكثر هدوءًا؛ لا شيء يحتاج إلى حل، ولا داعي لأن يعود أي منكما إلى البيت على عجل.',
          question: 'كيف تود أن تتذكر هذا المساء؟',
          choices: ['البقاء قليلًا بعد', 'ترك رسالة للقاء القادم', 'أخذ هذا الهدوء معك إلى البيت']
        }
      ],
      message: 'تظل الفوانيس مضاءة وأنتما في طريق العودة. كانت مجرد نزهة، لكنها منحتكما بعض الوقت الذي يخصكما وحدكما.'
    },
    copy: {
      title: 'Muse - جرّب قصة قصيرة',
      description: 'جرّب قصة خيالية أصلية من Muse. بلا حساب أو إنشاء بالذكاء الاصطناعي أو بيانات خاصة بالمستلم.',
      sampleNotice: 'قصة من ثلاثة مشاهد مكتوبة يدويًا، مع اختيارات ونهاية هادئة. خيالية ومجانية.',
      openingPrompt: 'مغامرة صغيرة من أجلك',
      openStory: 'افتح القصة التجريبية',
      durationNotice: 'نحو خمس دقائق. لا يبدأ أي شيء تلقائيًا.',
      revealHeading: 'قليل من الوقت معًا',
      revealFor: 'يمكن أن تتضمن قصتك من Muse رسالة خاصة أو صورة أو فيديو أو تسجيلًا صوتيًا.',
      yourChoices: 'اختياراتك',
      choiceEcho: 'اخترت: {choice}',
      createGift: 'أنشئ قصة لشخص ما',
      tryPersonal: 'أو جرّب قصة لنفسك',
      restart: 'جرّب القصة مرة أخرى',
      sceneCount: (current, total) => `المشهد ${current} من ${total}`,
      clueLabel: 'تلميح:',
      listenScene: 'استمع إلى هذا المشهد',
      narrationNotice: 'يستخدم هذا المثال الصوت المدمج في المتصفح، وليس Google Chirp. تختلف الأصوات حسب الجهاز؛ ولا يُرسل النص.',
      narrationSettings: 'إعدادات الصوت ومستوى الصوت',
      narrationTroubleshooting: 'إذا ظهرت حالة القراءة ولم تسمع صوتًا، فتحقق من مستوى صوت الوسائط في جهازك ومستوى صوت القارئ هنا.',
      narrationMuted: 'مستوى صوت القارئ 0٪. ارفعه من إعدادات الصوت لسماع القراءة.',
      narrationPreparing: 'جارٍ إعداد القراءة…',
      narrationSpeaking: 'جارٍ القراءة…',
      narrationPaused: 'القراءة متوقفة مؤقتًا',
      narrationResume: 'متابعة القراءة',
      narrationPause: 'إيقاف القراءة مؤقتًا',
      narrationStop: 'إيقاف القراءة',
      narrationUnavailable: 'قد لا يتوفر صوت بهذه اللغة في المتصفح أو الجهاز.',
      narrationError: 'تعذّر بدء القراءة. يمكنك متابعة القراءة بنفسك.',
      continue: 'تابع القصة',
      answerQuestion: 'ماذا أعدّ سام؟',
      answerPlaceholder: 'اكتب إجابتك',
      submitAnswer: 'جرّب هذه الإجابة',
      incorrectAnswer: 'ليس تمامًا. فكّر في وجبة نتشاركها في الخارج. يمكنك المحاولة مجددًا أو فتح كشف القصة أدناه.',
      hintPrompt: 'هل تحتاج إلى مساعدة بسيطة؟',
      showHint: 'أظهر تلميحًا',
      hint: 'الإجابة هي نزهة. هذا المثال ليوضح طريقة عمل Muse، وليس لاختبارك.',
      revealButton: 'أنهِ القصة',
      privacyNotice: 'لا يرسل هذا العرض أي طلبات لإنشاء قصة ولا يحفظ تقدّمك. يستخدم السرد صوت المتصفح على جهازك؛ ولا يُرسل نص القصة إلى خدمة صوتية.'
    }
  }
}

export function demoLocalization(language: StoryLanguageCode): DemoLocalization {
  return localizations[language]
}
