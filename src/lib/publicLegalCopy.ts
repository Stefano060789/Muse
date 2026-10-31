import type { StoryLanguageCode } from './storyLanguage'

type LegalSection = { heading: string; paragraphs: string[] }
type PublicLegalCopy = {
  eyebrow: string
  privacy: {
    title: string
    documentTitle: string
    description: string
    intro: string
    sections: {
      ai: LegalSection
      browser: LegalSection
      retention: LegalSection
      media: LegalSection
      gifts: LegalSection
      operations: LegalSection
      cookies: LegalSection
      contacts: LegalSection
    }
    operatorLabel: string
    supportLabel: string
    notReady: string
  }
  terms: {
    title: string
    documentTitle: string
    description: string
    sections: {
      status: LegalSection
      use: LegalSection
      romance: LegalSection
      storage: LegalSection
      operations: LegalSection
      availability: LegalSection
      contacts: LegalSection
    }
    operatorLabel: string
    supportLabel: string
  }
  support: {
    title: string
    documentTitle: string
    description: string
    intro: string
    contactsHeading: string
    operatorLabel: string
    supportLabel: string
    configured: string
    missing: string
    invalid: string
    emailAction: string
    noAddress: string
    warning: string
  }
}

const copies = {
  'en-US': {
    eyebrow: 'Help and information',
    privacy: {
      title: 'Privacy',
      documentTitle: 'Muse — Privacy',
      description: 'How Muse handles story inputs, browser memories, shared stories and media.',
      intro: 'Draft product privacy information. Muse is a public beta prototype and is not approved for public launch. Confirm the operator and support contacts and complete legal review before launch.',
      sections: {
        ai: { heading: 'What goes to AI', paragraphs: [
          'New accounts explicitly accept one processing permission at registration for story AI, selected memories, sharing summaries, cloud narration, dictation and stored voice messages. Optional adult-romance permission is separate. Both are saved to the account and revocable in Settings; accepting them does not start any paid action or recording. Browser microphone permission remains separate. Existing accounts and guests keep their previous per-feature checks.',
          'When you create or continue an AI story, Muse sends the text you submit to the AI provider configured for this deployment. My Story sends your need, story choices and new responses; your latest five browser memories are included in new personal stories by default. You can leave them out during creation, and explicit consent is required before they are sent. Saving personal touches on Myself does not send them to the story AI provider. A shared-story brief can include names, setting, goal, personal hints, secret and alternative answers, narration instructions and the final written message. Shared live actions are also sent for AI-generated turns. The configured provider may process information under its own terms. Do not submit sensitive information or private details about others.',
          'Saving a memory in Myself stores it only in this browser and does not send it to AI. Shared guesses go to Muse to compare with the creator’s answer, not to AI. Hints, confirmed skips and library actions do not make AI calls.'
        ] },
        browser: { heading: 'Browser storage and accounts', paragraphs: [
          'Muse accounts use Supabase Auth email-and-password sign-in. An account is required to create or manage server stories. Ordinary gift recipients can open a private recipient link without an account; cooperative stories let Muse members join with an account and guests join through the private link with a chosen display name. Gift stories and server personal journeys belong to the signed-in account; signing in on another device restores account-owned stories. Legacy browser-only stories, memories, preferences, drafts and unsent answers stay in that browser and are not synced to the account. Browser-stored information is readable, unencrypted text; anyone with access to the browser profile or its storage may be able to read it. Restoring a draft does not send information to AI or generate a story.',
          'You can edit or forget memories in Myself and remove a library entry in Story Library. These actions change only this browser; they do not erase a generated story, revoke its server capability, or remove information already sent to an AI provider.',
          'Signed-in creators can list and manage only stories owned by their account. The server verifies the Supabase access token and checks ownership for creator actions. An old private owner link can claim an unowned legacy gift story; legacy stories are not automatically assigned to the first account to sign in. Recipient links remain account-free. Account recovery does not restore deleted stories or browser-only data. Recovering a personal journey also requires signing in.',
          'Shared playthrough progress is stored on the server under a random browser-session capability (hashed on the server), including scene, hints, guess attempts, and whether a reveal was solved or skipped. The same link in the same browser resumes that playthrough while the link and browser storage remain available. The sender can privately refresh aggregate counts of opened, unfinished, solved and skipped playthroughs, plus the furthest prepared scene or the largest number of successfully generated live scenes in a playthrough. Opening the link counts as a start, even before a gift cover is opened; another browser or cleared storage can count again. Counts include earlier recipient links for that story. They do not verify recipient identity or prove reading, and are not a live activity feed. The overview excludes session IDs, written answers and browsing history, and progress is not sent to AI. Progress stays with the story until expiry or deletion.',
          'In cooperative gift stories, participants share one live adventure. The group can see display names, whose turn it is and shared progress; account members use their Muse profile name and guests choose a name. Turns rotate in join order, and only the active participant can act or pass. Guest identity uses a random browser-session token tied to the private recipient link, not a verified real-world identity; clearing browser storage can make a guest rejoin as a new participant. Actions are part of the shared story and may go to the configured AI provider. The creator’s account owns the story and its live-interaction allowance.',
          'Creators can enable or disable in-app shared-story progress notifications in Settings. When enabled, while Muse is open and the creator is signed in, Muse periodically checks aggregate first opens, progress milestones and completions. The preference and last-checked progress snapshots are stored in that browser, not synced to other devices. These are not email or browser push alerts.',
          'Installing Muse on a home screen adds an app-like shortcut, not an account or cross-device sync; internet is still required. Its network-only service worker does not create an offline cache of private stories, media or API responses; the browser storage described above still applies. The handcrafted sample makes no AI story-generation requests and saves no playthrough. Its English version uses prerecorded public Google WaveNet audio assets; translated versions use browser or device speech only. No sample story text is sent to Muse cloud text-to-speech.'
        ] },
        retention: { heading: 'Server stories, expiry and deletion', paragraphs: [
          'Personal journeys and shared stories, including saved progress, gift media, voice messages and prepared story recordings, remain on Muse’s server until deleted, with no automatic expiry. Removing a browser-library entry does not delete the server story. Use private shared-story management controls or Delete story at the bottom of My Story. Continued hosting is not guaranteed forever. Backups, if present, may retain data separately; this notice does not guarantee backup configuration, coverage or recovery.',
          'Creators can delete a shared story from its private management page, disabling its links and queuing associated media for deletion. After confirmation and creator authorization, Delete story at the bottom of My Story permanently removes a personal journey and its progress from the server and this browser. Legacy browser-only stories are deleted locally. Removing a library entry alone is not server deletion. Previously issued private signed media URLs may work until they expire, for up to 10 minutes after deletion or link rotation. Separately retained backups may still contain deleted records and media.'
        ] },
        media: { heading: 'Photos, video and speech', paragraphs: [
          'Shared-story photos and videos are stored privately and are not sent to the AI provider. A revealed file is available after a correct answer, or after the recipient confirms a skip if the creator enabled that option. Skipping is recorded separately from solving and does not disclose the secret answer. Deleting a story queues its media for cleanup; storage backups may be separate.',
          'Dictation uses speech recognition supplied by your browser or device and may send audio to an online speech service. Review the transcript before submitting it. Browser narration may be processed locally; if a deployment enables an online narration provider, text sent to it may be processed there.',
          'Optional cloud narration sends selected text to the Google Cloud Text-to-Speech or ElevenLabs provider shown in Audio. New accounts use their saved registration permission; existing accounts keep separate consent. Google requires credentials and a character budget. Prepared gift audio sends only scene title, body and clue, not private answers, final reveals or live AI turns. Recordings are cached privately; playback does not resend text. Recipients need authorized story access. Deletion cannot recall audio already loaded or saved. Failures never silently switch to device speech.',
          'Google narration also uses a separate private, deduplicated audio cache with hashed lookup metadata rather than plaintext narration inputs. Cached audio is kept for up to 30 days, with cleanup triggered by requests and no scheduled-cleanup guarantee. Deleting a story disables story-specific audio access but does not immediately erase a separate cached copy; it remains until cleanup. Budget reservations are retained independently without plaintext story text; failed or interrupted synthesis can use budget. Backups may retain audio separately.',
          'An optional personal voice message is a recording, not dictation or voice cloning. Recording starts only after consent and microphone permission. The WAV stays on this page until upload, then is stored privately with the story and unlocked only with its final reveal. Voice files are not sent to AI. Recording and upload are limited to 60 seconds and 5 MB. Removing the story queues the recording for deletion.'
        ] },
        gifts: { heading: 'Gifts and replies', paragraphs: [
          'Completed personal stories offer read-only rereading. Story PDF export is no longer offered. Deleting the online story cannot revoke copies previously saved or printed.',
          'Romance is optional, adult and non-explicit. Its style is saved with the story and sent to AI for generation and continuation. New accounts reuse their optional registration adult permission; existing accounts and guests confirm adult and consent boundaries in each flow. Shared recipients choose to open after a content notice. Self-declaration does not verify age, identity or the sender’s content. Do not include sensitive sexual information or portray real people without permission.',
          'A gift cover and dedication are visible to anyone with the recipient link before solving. Do not put secret answers or the final surprise on the cover. Link previews show generic Muse information, not private story text.',
          'If a creator enables replies, recipients may send a written message after revealing the surprise. Replies are stored privately with the story until expiry or deletion and are available through the creator’s protected management page. They are not sent to AI. Muse does not verify recipient identities or provide read receipts. A reply can be replaced from the same playthrough; clearing browser storage may remove access to it.',
          'A printable gift card contains the private recipient link as a QR code and address, plus an optional greeting visible before the content notice. The QR is generated on your device. Anyone with a copy can open the story while the link is valid. Deletion, expiry or replacing the link invalidates the card; printing does not preserve the online story.'
        ] },
        operations: { heading: 'Operational security and error reporting', paragraphs: [
          'Muse does not record page views or website visits and does not use third-party analytics. For operations, it records fixed event codes such as story creation, provider failures and safety-limit warnings, with timestamps. These records exclude story text, page URLs, capability links and raw IP addresses, are deduplicated per minute and retained for up to seven days. Rate limiting separately uses short-lived IP-derived hashes: keyed hashes in production and plain hashes in local development. Counter keys contain the derived hash, not the raw IP. Limits include up to 120 general requests per minute, 20 failed creator-code attempts per 10 minutes and 5 error-report requests per minute.',
          'Operational events appear in the private operations dashboard and server logs. No external notification service is configured, so operators may not be alerted when an event occurs. Hosting-platform logs may have their own retention.'
        ] },
        cookies: { heading: 'Cookies and analytics', paragraphs: [
          'Muse currently uses no third-party analytics or advertising SDKs, so no analytics-cookie banner is configured. This does not cover cookies or processing by hosting, storage or other infrastructure providers.'
        ] },
        contacts: { heading: 'Operator and contact', paragraphs: [] }
      },
      operatorLabel: 'Operator',
      supportLabel: 'Support contact',
      notReady: 'Do not launch the public beta until both contacts are configured and the privacy and product terms have received legal review.'
    },
    terms: {
      title: 'Terms',
      documentTitle: 'Muse — Terms',
      description: 'Draft product terms for using the Muse storytelling beta.',
      sections: {
        status: { heading: 'Draft status', paragraphs: [
          'Draft product terms for a prototype. This is not legal approval or a certified legal agreement. Muse is a public beta prototype and must not launch publicly until the operator and support contacts are configured and these terms are reviewed.'
        ] },
        use: { heading: 'Using Muse', paragraphs: [
          'Muse helps create interactive stories. AI-generated material can be inaccurate, incomplete or unsuitable; review it and use your own judgment. Muse is not professional, medical, therapeutic or emergency advice.',
          'Submit only material you have the right to use and permission to share. Do not submit sensitive personal information or another person’s confidential information. You are responsible for the text and media you provide and private links you create or share, including choosing who receives a link.'
        ] },
        romance: { heading: 'Optional romance', paragraphs: [
          'Sweet and Spicy romance are non-explicit themes for adults aged 18 or older and consenting adult characters. Intimacy fades to black. Do not use Muse for explicit sexual content, sexual content involving minors, coercion, or sexualized portrayals of real people without their permission. Do not upload explicit photos, videos or recordings. Review your story and attachments before sending.',
          'Tagged shared romance stories require recipients to choose whether to open before receiving the cover, story or media. A recipient may decline. Age and consent are self-declared, not independently verified; choosing to open does not endorse the sender’s content. AI instructions and this notice are not complete moderation and do not guarantee appropriate submissions or generated output.'
        ] },
        storage: { heading: 'Storage and deletion', paragraphs: [
          'Creating and managing server stories requires a signed-in Muse account. Creators can access only stories assigned to their account. Recipients can open a private gift-story link without signing in. Unclaimed legacy gift stories are not automatically assigned to accounts; a creator may claim one by presenting its existing private owner link. Legacy personal stories and browser-only data are not automatically migrated to an account.',
          'Server stories have no automatic expiry and remain until deleted; continued hosting is not guaranteed forever. Backups, if present, are retained independently; backup configuration, coverage and recovery are not guaranteed. No full-backup or media-recovery guarantee is made. Deleting a shared story from its management page disables its links and printed QR codes. Use Delete story at the bottom of My Story to delete a personal journey; removing only a browser-library entry does not delete its server copy. Deletion does not refund used attempts.',
          'Shared media is private and is not sent to AI. Content sent to the configured AI or speech provider is subject to that provider’s processing terms as well as Muse’s privacy information.',
          'Device narration and gift-card printing vary by browser. Studio covers prepared scenes only and needs operator configuration and processing permission: saved at registration for new accounts, separate for existing accounts. Availability is not guaranteed. QR cards share a recipient link, not permanent storage; deletion, expiry or replacement invalidates the link. Previously saved or printed copies cannot be revoked.'
        ] },
        operations: { heading: 'Operational controls', paragraphs: [
          'Muse collects no page-view or website-visit analytics. For service operations, it records fixed event codes, including story creation and safety or provider failures, with timestamps; records are deduplicated per minute and retained for up to seven days. They exclude story text, page URLs, capability links and raw IP addresses. Request rate limits use short-lived IP-derived hashes (keyed in production; plain hashes in local development). Hosting-platform logs may have separate retention. Operational status and server logs do not provide configured proactive external alerts.'
        ] },
        availability: { heading: 'Availability', paragraphs: [
          'This prototype may change, be unavailable or fail to preserve data. Keep your own copies of anything important. Do not rely on Muse for secure archival storage.'
        ] },
        contacts: { heading: 'Operator and contact', paragraphs: [] }
      },
      operatorLabel: 'Operator',
      supportLabel: 'Support contact'
    },
    support: {
      title: 'Support',
      documentTitle: 'Muse — Support',
      description: 'Support and contact status for Muse.',
      intro: 'Muse is a prototype in public beta preparation. Support is not staffed or available yet.',
      contactsHeading: 'Contact status',
      operatorLabel: 'Operator',
      supportLabel: 'Support email',
      configured: 'Configured',
      missing: 'Not configured',
      invalid: 'Not configured (invalid setting)',
      emailAction: 'Email support',
      noAddress: 'No support address is available; none has been invented or substituted.',
      warning: 'Do not send private story links, creator codes, passwords or sensitive personal information to an unverified contact. Public beta is not ready until an operator and support email are configured and legal review is complete.'
    }
  },
  'it-IT': {
    eyebrow: 'Aiuto e informazioni',
    privacy: {
      title: 'Privacy', documentTitle: 'Muse — Privacy', description: 'Come Muse gestisce i contenuti delle storie, i ricordi nel browser, le storie condivise e i contenuti multimediali.',
      intro: 'Informativa privacy del prodotto in bozza. Muse è un prototipo beta pubblico non approvato per il lancio. Prima del lancio, verifica i contatti dell’operatore e del supporto e completa la revisione legale.',
      sections: {
        ai: { heading: 'Dati inviati all’IA', paragraphs: [
          'I nuovi account accettano alla registrazione un unico consenso per IA delle storie, ricordi selezionati, riassunti condivisi, voce cloud, dettatura e messaggi vocali salvati. Il consenso al romanticismo adulto è facoltativo e separato. Entrambi sono salvati nell’account e revocabili nelle Impostazioni; non avviano registrazioni o azioni a pagamento. Il permesso del microfono resta nel browser. Account esistenti e ospiti mantengono i consensi per funzione.',
          'Quando crei o continui una storia con IA, Muse invia il testo inserito al provider IA configurato per questa distribuzione. La sezione La mia storia invia la tua esigenza, le scelte e le nuove risposte; per impostazione predefinita, le nuove storie personali includono gli ultimi cinque ricordi del browser. Puoi escluderli durante la creazione: serve un consenso esplicito prima dell’invio. Salvare dettagli personali in Io non li invia al provider IA delle storie. Un brief condiviso può includere nomi, ambientazione, obiettivo, suggerimenti personali, segreto e risposte alternative, istruzioni di narrazione e messaggio scritto finale. Anche le azioni durante il gioco condiviso vengono inviate per i turni generati dall’IA. Il provider configurato può trattare i dati secondo i propri termini. Non inserire dati sensibili o dettagli privati di altre persone.',
          'Salvare un ricordo in Io lo conserva solo in questo browser e non lo invia all’IA. Le ipotesi condivise vengono inviate a Muse per confrontarle con la risposta del creatore, non all’IA. Suggerimenti, salti confermati e azioni della raccolta non chiamano l’IA.'
        ] },
        browser: { heading: 'Archiviazione nel browser e account', paragraphs: [
          'Gli account Muse usano l’accesso email e password di Supabase Auth. Serve un account per creare o gestire storie sul server. I destinatari dei regali possono aprire un link privato senza account; nelle storie cooperative i membri Muse accedono con account e gli ospiti tramite link privato e nome visualizzato scelto. Le storie regalo e i percorsi personali sul server sono associati all’account connesso; accedendo da un altro dispositivo puoi ripristinare le storie dell’account. Le vecchie storie, i ricordi, le preferenze, le bozze e le risposte non inviate conservati solo nel browser non si sincronizzano con l’account. I dati nel browser sono testo leggibile e non cifrato: chi accede al profilo o alla memoria del browser potrebbe leggerli. Ripristinare una bozza non invia dati all’IA e non genera una storia.',
          'Puoi modificare o dimenticare i ricordi in Io e rimuovere una voce dalla Raccolta storie. Queste azioni modificano solo questo browser: non cancellano una storia già generata, non revocano il relativo accesso al server e non rimuovono dati già inviati a un provider IA.',
          'I creatori connessi possono elencare e gestire solo le storie di proprietà del proprio account. Il server verifica il token di accesso Supabase e controlla la proprietà per le azioni del creatore. Un vecchio link privato del proprietario può servire a rivendicare una vecchia storia regalo non assegnata; queste storie non vengono assegnate automaticamente al primo account che accede. I link dei destinatari non richiedono account. Il recupero dell’account non ripristina storie eliminate o dati conservati solo nel browser. Per recuperare un percorso personale serve anche accedere.',
          'I progressi di una partita condivisa sono conservati sul server con una capability casuale della sessione browser (con hash sul server): includono scena, suggerimenti, tentativi e se una rivelazione è stata risolta o saltata. Lo stesso link nello stesso browser riprende la partita finché link e memoria del browser restano disponibili. Il mittente può aggiornare in privato conteggi aggregati di partite aperte, incomplete, risolte e saltate, oltre alla scena preparata più avanzata o al massimo numero di scene live generate correttamente in una partita. Aprire il link conta come avvio, anche prima della copertina; un altro browser o la cancellazione della memoria possono essere conteggiati di nuovo. I conteggi comprendono i link precedenti della stessa storia. Non verificano l’identità né provano la lettura e non sono un feed in tempo reale. Il riepilogo non mostra ID di sessione, risposte scritte o cronologia di navigazione; i progressi non vengono inviati all’IA. Restano con la storia fino alla scadenza o cancellazione.',
          'Nelle storie regalo cooperative, i partecipanti condividono la stessa avventura live. Il gruppo vede nomi visualizzati, turno e progressi; i membri usano il nome del profilo Muse e gli ospiti ne scelgono uno. I turni seguono l’ordine di partecipazione e solo chi è di turno può agire o passare. L’identità degli ospiti usa un token casuale della sessione browser legato al link privato, non un’identità reale verificata; cancellare la memoria del browser può far rientrare un ospite come nuovo partecipante. Le azioni fanno parte della storia condivisa e possono essere inviate al provider IA configurato. La storia e la relativa quota di interazione live appartengono all’account del creatore.',
          'I creatori possono attivare o disattivare in Impostazioni le notifiche interne sui progressi delle storie condivise. Se attive, mentre Muse è aperto e il creatore è connesso, Muse controlla periodicamente prime aperture, traguardi e completamenti aggregati. Preferenza e ultimo riepilogo controllato sono conservati nel browser e non sincronizzati. Non sono email né notifiche push.',
          'Aggiungere Muse alla schermata iniziale crea una scorciatoia simile a un’app, non un account né una sincronizzazione tra dispositivi; serve comunque Internet. Il service worker solo di rete non crea una cache offline di storie private, contenuti multimediali o risposte API; resta valida l’archiviazione nel browser descritta sopra. Il campione creato a mano non invia richieste di generazione di storie all’IA né salva partite. La versione inglese usa file audio pubblici preregistrati di Google WaveNet; le versioni tradotte usano solo la sintesi vocale del browser o del dispositivo. Il testo del campione non viene inviato al servizio di sintesi vocale cloud di Muse.'
        ] },
        retention: { heading: 'Storie sul server, scadenza e cancellazione', paragraphs: [
          'I percorsi personali e le storie condivise, inclusi progressi salvati, contenuti multimediali regalo, messaggi vocali e registrazioni preparate, restano sul server Muse finché non vengono eliminati; non scadono automaticamente. Rimuovere una voce dalla raccolta del browser non elimina la storia sul server. Usa la gestione privata della storia condivisa o Elimina storia in fondo a La mia storia. L’hosting continuativo non è garantito per sempre. Eventuali backup possono conservare i dati separatamente; questa informativa non garantisce configurazione, copertura o recupero dei backup.',
          'I creatori possono eliminare una storia condivisa dalla sua pagina di gestione privata: i link vengono disattivati e i media associati messi in coda per la cancellazione. Dopo conferma e autorizzazione, Elimina storia in fondo a La mia storia rimuove definitivamente dal server e da questo browser un percorso personale e i suoi progressi. Le vecchie storie solo-browser sono eliminate localmente. Rimuovere una voce dalla raccolta non elimina i dati sul server. Gli URL firmati privati già emessi possono funzionare fino alla scadenza, per un massimo di 10 minuti dopo l’eliminazione o la rotazione del link. I backup conservati separatamente possono ancora contenere record e media eliminati.'
        ] },
        media: { heading: 'Foto, video e voce', paragraphs: [
          'Foto e video delle storie condivise sono conservati privatamente e non inviati al provider IA. Un file rivelato è disponibile dopo una risposta corretta o, se il creatore l’ha consentito, dopo che il destinatario conferma di saltare. Il salto è registrato separatamente dalla soluzione e non rivela la risposta segreta. Eliminare una storia mette i media in coda per la pulizia; i backup possono essere separati.',
          'La dettatura usa il riconoscimento vocale del browser o dispositivo e può inviare l’audio a un servizio online. Rivedi la trascrizione prima di inviarla. La narrazione nel browser può essere elaborata localmente; se la distribuzione abilita un provider online, il testo inviato potrebbe essere elaborato da quel servizio.',
          'La voce cloud facoltativa invia il testo scelto a Google Cloud Text-to-Speech o ElevenLabs, indicato in Audio. I nuovi account usano il consenso salvato alla registrazione; quelli esistenti mantengono il consenso separato. Google richiede credenziali e un limite di caratteri. L’audio regalo preparato invia solo titolo, testo e indizio, non risposte private, rivelazioni finali o turni IA live. Le registrazioni sono salvate privatamente; riprodurle non reinvia testo. Serve accesso autorizzato alla storia. Eliminare non revoca audio già caricato o salvato. Gli errori non attivano silenziosamente la voce del dispositivo.',
          'La narrazione Google usa anche una cache audio privata e deduplicata, con metadati di ricerca sottoposti a hash anziché testi in chiaro. L’audio in cache è conservato fino a 30 giorni; la pulizia è attivata dalle richieste e non è garantita a intervalli pianificati. Eliminare una storia disattiva l’accesso all’audio specifico, ma non elimina subito una copia separata, che resta fino alla pulizia. Le prenotazioni del budget sono conservate separatamente senza testo della storia in chiaro; sintesi non riuscite o interrotte possono consumare budget. I backup possono conservare l’audio separatamente.',
          'Un messaggio vocale personale facoltativo è una registrazione, non dettatura o clonazione vocale. La registrazione inizia solo dopo il consenso e il permesso del microfono. Il WAV resta in questa pagina fino al caricamento, poi è conservato privatamente con la storia e si sblocca solo con la rivelazione finale. I file vocali non sono inviati all’IA. Registrazione e caricamento sono limitati a 60 secondi e 5 MB. Rimuovere la storia mette la registrazione in coda per l’eliminazione.'
        ] },
        gifts: { heading: 'Regali e risposte', paragraphs: [
          'Le storie personali completate possono essere rilette senza modificarle. L’esportazione della storia in PDF non è più disponibile. Eliminare la storia online non revoca copie salvate o stampate in precedenza.',
          'Il romanticismo è facoltativo, per adulti e non esplicito. Lo stile è salvato con la storia e inviato all’IA per generazione e continuazioni. I nuovi account riutilizzano il consenso facoltativo per adulti della registrazione; account esistenti e ospiti confermano età adulta e consenso in ogni percorso. I destinatari scelgono di aprire dopo un avviso sui contenuti. L’autodichiarazione non verifica età, identità o contenuti del mittente. Non includere dati sessuali sensibili o rappresentare persone reali senza permesso.',
          'La copertina regalo e la dedica sono visibili a chiunque abbia il link del destinatario, prima della soluzione. Non inserire sulla copertina risposte segrete o la sorpresa finale. Le anteprime dei link mostrano informazioni generiche su Muse, non il testo privato della storia.',
          'Se il creatore abilita le risposte, i destinatari possono inviare un messaggio scritto dopo aver rivelato la sorpresa. Le risposte sono conservate privatamente con la storia fino a scadenza o eliminazione e accessibili dalla pagina di gestione protetta del creatore. Non sono inviate all’IA. Muse non verifica l’identità dei destinatari né fornisce conferme di lettura. Una risposta può essere sostituita nella stessa partita; cancellare la memoria del browser può far perdere l’accesso.',
          'La cartolina stampabile contiene il link privato del destinatario come QR e indirizzo, con un saluto facoltativo visibile prima dell’avviso sui contenuti. Il QR è generato sul dispositivo. Chi ha una copia può aprire la storia finché il link è valido. Eliminazione, scadenza o sostituzione del link invalidano la cartolina; la stampa non conserva la storia online.'
        ] },
        operations: { heading: 'Sicurezza operativa e segnalazione errori', paragraphs: [
          'Muse non registra visualizzazioni di pagina o visite al sito e non usa analytics di terze parti. Per le operazioni registra codici evento fissi, come creazione di storie, errori dei provider e avvisi sui limiti di sicurezza, con timestamp. I record escludono testo delle storie, URL delle pagine, link capability e IP grezzi, sono deduplicati al minuto e conservati fino a sette giorni. I limiti di richieste usano separatamente hash temporanei derivati dall’IP: con chiave in produzione e semplice hash nello sviluppo locale. Le chiavi dei contatori contengono l’hash derivato, non l’IP grezzo. I limiti includono fino a 120 richieste generiche al minuto, 20 tentativi falliti di codice creatore ogni 10 minuti e 5 richieste di segnalazione errore al minuto.',
          'Gli eventi operativi sono visibili nella dashboard privata e nei log del server. Non è configurato alcun servizio di notifiche esterno: gli operatori potrebbero non essere avvisati di un evento. I log della piattaforma di hosting possono avere una conservazione distinta.'
        ] },
        cookies: { heading: 'Cookie e analisi', paragraphs: [
          'Al momento Muse non usa SDK di analisi o pubblicità di terze parti e quindi non è configurato un banner per i cookie analitici. Questa dichiarazione non copre cookie o trattamenti dei provider di hosting, archiviazione o altre infrastrutture.'
        ] },
        contacts: { heading: 'Operatore e contatti', paragraphs: [] }
      },
      operatorLabel: 'Operatore', supportLabel: 'Contatto di supporto',
      notReady: 'Non lanciare la beta pubblica finché entrambi i contatti non sono configurati e l’informativa privacy e i termini del prodotto non hanno ricevuto revisione legale.'
    },
    terms: {
      title: 'Termini', documentTitle: 'Muse — Termini', description: 'Bozza dei termini del prodotto per usare la beta di Muse.',
      sections: {
        status: { heading: 'Stato della bozza', paragraphs: ['Bozza dei termini del prodotto per un prototipo. Non costituisce approvazione legale né accordo certificato. Muse è un prototipo beta pubblico e non deve essere lanciato pubblicamente finché operatore e contatti di supporto non sono configurati e questi termini non sono revisionati.'] },
        use: { heading: 'Uso di Muse', paragraphs: [
          'Muse aiuta a creare storie interattive. I contenuti generati dall’IA possono essere inesatti, incompleti o inadatti: rivedili e usa il tuo giudizio. Muse non fornisce consulenza professionale, medica, terapeutica o di emergenza.',
          'Invia solo contenuti che hai il diritto di usare e il permesso di condividere. Non inviare dati personali sensibili o informazioni riservate di altre persone. Sei responsabile dei testi, dei media e dei link privati che crei o condividi, inclusa la scelta dei destinatari.'
        ] },
        romance: { heading: 'Tema romantico facoltativo', paragraphs: [
          'I temi romantici Sweet e Spicy non sono espliciti e sono riservati ad adulti dai 18 anni e a personaggi adulti consenzienti. L’intimità sfuma al nero. Non usare Muse per contenuti sessuali espliciti, contenuti sessuali che coinvolgono minori, coercizione o rappresentazioni sessualizzate di persone reali senza il loro permesso. Non caricare foto, video o registrazioni esplicite. Rivedi storia e allegati prima dell’invio.',
          'Nelle storie romantiche condivise contrassegnate, i destinatari scelgono se aprire prima di ricevere copertina, storia o media. Possono rifiutare. Età e consenso sono autodichiarati, non verificati in modo indipendente; scegliere di aprire non approva il contenuto del mittente. Le istruzioni all’IA e questo avviso non costituiscono moderazione completa e non garantiscono l’adeguatezza degli invii o dei contenuti generati.'
        ] },
        storage: { heading: 'Archiviazione e cancellazione', paragraphs: [
          'Per creare e gestire storie sul server serve un account Muse connesso. I creatori accedono solo alle storie assegnate al proprio account. I destinatari possono aprire un link privato a una storia regalo senza accedere. Le vecchie storie regalo non assegnate non vengono collegate automaticamente agli account; il creatore può rivendicarne una mostrando il suo link privato proprietario esistente. Le vecchie storie personali e i dati solo-browser non vengono migrati automaticamente.',
          'Le storie sul server non scadono automaticamente e restano fino all’eliminazione; l’hosting continuativo non è garantito per sempre. Eventuali backup sono conservati separatamente; configurazione, copertura e recupero non sono garantiti. Non è garantito il backup completo né il recupero dei media. Eliminare una storia condivisa dalla pagina di gestione disattiva i suoi link e codici QR stampati. Per eliminare un percorso personale usa Elimina storia in fondo a La mia storia; rimuovere solo una voce dalla raccolta del browser non elimina la copia sul server. I tentativi usati non sono rimborsabili.',
          'I media condivisi sono privati e non vengono inviati all’IA. I contenuti inviati al provider IA o vocale configurato sono soggetti anche ai termini di trattamento del provider, oltre all’informativa privacy di Muse.',
          'Narrazione e stampa della cartolina variano in base al browser. Studio copre solo scene preparate e richiede configurazione dell’operatore e consenso al trattamento: salvato alla registrazione per i nuovi account, separato per quelli esistenti. La disponibilità non è garantita. Il QR condivide un link, non archivia la storia: eliminazione, scadenza o sostituzione lo invalidano. Le copie già salvate o stampate non possono essere revocate.'
        ] },
        operations: { heading: 'Controlli operativi', paragraphs: [
          'Muse non raccoglie analisi di visualizzazioni o visite al sito. Per il servizio registra codici evento fissi, inclusi creazione di storie ed errori di sicurezza o dei provider, con timestamp; i record sono deduplicati al minuto e conservati fino a sette giorni. Escludono testo delle storie, URL, link capability e IP grezzi. I limiti di richieste usano hash temporanei derivati dall’IP (con chiave in produzione, semplici hash nello sviluppo locale). I log della piattaforma di hosting possono avere una conservazione distinta. Stato operativo e log del server non dispongono di avvisi esterni proattivi configurati.'
        ] },
        availability: { heading: 'Disponibilità', paragraphs: [
          'Questo prototipo può cambiare, non essere disponibile o non conservare i dati. Conserva copie personali di ciò che è importante. Non fare affidamento su Muse come archivio sicuro.'
        ] },
        contacts: { heading: 'Operatore e contatti', paragraphs: [] }
      },
      operatorLabel: 'Operatore', supportLabel: 'Contatto di supporto'
    },
    support: {
      title: 'Supporto', documentTitle: 'Muse — Supporto', description: 'Stato del supporto e dei contatti di Muse.',
      intro: 'Muse è un prototipo in preparazione per la beta pubblica. Il supporto non è ancora attivo né disponibile.',
      contactsHeading: 'Stato dei contatti', operatorLabel: 'Operatore', supportLabel: 'Email di supporto',
      configured: 'Configurato', missing: 'Non configurato', invalid: 'Non configurato (impostazione non valida)',
      emailAction: 'Scrivi al supporto', noAddress: 'Non è disponibile un indirizzo di supporto; non ne è stato inventato o sostituito nessuno.',
      warning: 'Non inviare link privati a storie, codici creatore, password o dati personali sensibili a un contatto non verificato. La beta pubblica non è pronta finché operatore ed email di supporto non sono configurati e la revisione legale non è completata.'
    }
  },
  'es-ES': {
    eyebrow: 'Ayuda e información',
    privacy: {
      title: 'Privacidad', documentTitle: 'Muse — Privacidad', description: 'Cómo gestiona Muse los textos de historias, los recuerdos del navegador, las historias compartidas y los archivos multimedia.',
      intro: 'Información de privacidad del producto en borrador. Muse es un prototipo beta público que no está aprobado para su lanzamiento. Antes de lanzarlo, confirma los contactos del operador y de soporte y completa la revisión legal.',
      sections: {
        ai: { heading: 'Qué se envía a la IA', paragraphs: [
          'Las cuentas nuevas aceptan al registrarse un permiso para IA, recuerdos elegidos, resúmenes compartidos, voz en la nube, dictado y mensajes de voz guardados. El permiso de romance adulto es opcional y separado. Ambos se guardan en la cuenta y se pueden revocar en Ajustes; no inician grabaciones ni acciones de pago. El micrófono sigue requiriendo permiso del navegador. Las cuentas existentes y los invitados mantienen sus controles por función.',
          'Al crear o continuar una historia con IA, Muse envía el texto que proporcionas al proveedor de IA configurado para este despliegue. Mi historia envía tus necesidades, elecciones y nuevas respuestas; por defecto, las historias personales nuevas incluyen tus cinco recuerdos más recientes del navegador. Puedes excluirlos al crear la historia y se requiere consentimiento explícito antes de enviarlos. Guardar detalles personales en Yo no los envía al proveedor de IA de historias. Un resumen de historia compartida puede incluir nombres, escenario, objetivo, pistas personales, secreto y respuestas alternativas, instrucciones de narración y mensaje escrito final. Las acciones durante el juego compartido también se envían para generar turnos con IA. El proveedor configurado puede tratar la información según sus propios términos. No envíes información sensible ni datos privados de otras personas.',
          'Guardar un recuerdo en Yo solo lo guarda en este navegador; no se envía a la IA. Las respuestas compartidas se envían a Muse para compararlas con la respuesta del creador, no a la IA. Las pistas, los saltos confirmados y las acciones de biblioteca no generan llamadas a la IA.'
        ] },
        browser: { heading: 'Almacenamiento del navegador y cuentas', paragraphs: [
          'Las cuentas de Muse usan inicio de sesión con correo y contraseña de Supabase Auth. Se necesita una cuenta para crear o gestionar historias del servidor. Los destinatarios pueden abrir un enlace privado de regalo sin cuenta; en las historias cooperativas, los miembros de Muse se unen con su cuenta y los invitados mediante el enlace privado y un nombre visible que eligen. Las historias de regalo y los recorridos personales del servidor se asocian a la cuenta iniciada; iniciar sesión en otro dispositivo permite recuperar las historias de la cuenta. Las historias antiguas, recuerdos, preferencias, borradores y respuestas sin enviar guardados solo en el navegador no se sincronizan con la cuenta. La información del navegador es texto legible sin cifrar; quien acceda al perfil o almacenamiento del navegador podría leerla. Restaurar un borrador no envía datos a la IA ni genera una historia.',
          'Puedes editar u olvidar recuerdos en Yo y quitar una entrada de la Biblioteca de historias. Estas acciones solo afectan a este navegador: no borran una historia generada, revocan su acceso al servidor ni eliminan información ya enviada a un proveedor de IA.',
          'Los creadores que han iniciado sesión solo pueden listar y gestionar historias de su cuenta. El servidor verifica el token de acceso de Supabase y comprueba la propiedad para las acciones del creador. Un antiguo enlace privado del propietario puede reclamar una historia de regalo antigua sin asignar; estas historias no se asignan automáticamente a la primera cuenta que inicia sesión. Los enlaces de destinatarios no requieren cuenta. La recuperación de la cuenta no restaura historias eliminadas ni datos guardados solo en un navegador. Recuperar un recorrido personal también requiere iniciar sesión.',
          'El progreso de una partida compartida se guarda en el servidor mediante una capacidad aleatoria de sesión del navegador (con hash en el servidor), e incluye escena, pistas, intentos y si se resolvió o saltó una revelación. El mismo enlace en el mismo navegador reanuda la partida mientras sigan disponibles el enlace y el almacenamiento. El remitente puede actualizar en privado recuentos agregados de partidas abiertas, incompletas, resueltas y saltadas, además de la escena preparada más avanzada o el mayor número de escenas en vivo generadas correctamente en una partida. Abrir el enlace cuenta como inicio, incluso antes de abrir la portada; otro navegador o borrar el almacenamiento puede volver a contar. Los recuentos incluyen enlaces anteriores de esa historia. No verifican la identidad ni prueban la lectura, y no son un feed de actividad en directo. El resumen no muestra identificadores de sesión, respuestas escritas ni historial de navegación, y el progreso no se envía a la IA. Se conserva con la historia hasta que caduque o se elimine.',
          'En las historias de regalo cooperativas, los participantes comparten la misma aventura en vivo. El grupo puede ver nombres visibles, el turno y el progreso; los miembros usan el nombre de perfil de Muse y los invitados eligen uno. Los turnos rotan según el orden de incorporación y solo quien tiene el turno puede actuar o pasar. La identidad de invitados depende de un token aleatorio de sesión del navegador asociado al enlace privado, no de una identidad real verificada; borrar el almacenamiento puede hacer que vuelvan a entrar como participantes nuevos. Las acciones forman parte de la historia y pueden enviarse al proveedor de IA configurado. La cuenta del creador es propietaria de la historia y de su cuota de interacción en vivo.',
          'Los creadores pueden activar o desactivar en Ajustes las notificaciones internas de progreso. Cuando están activadas, con Muse abierto y el creador conectado, Muse consulta periódicamente aperturas iniciales, hitos y finalizaciones agregados. La preferencia y las últimas instantáneas de progreso se guardan en ese navegador y no se sincronizan. No son correos ni notificaciones push.',
          'Instalar Muse en la pantalla de inicio añade un acceso directo similar a una app, no una cuenta ni sincronización entre dispositivos; se sigue necesitando Internet. El service worker solo de red no crea una caché sin conexión de historias privadas, medios o respuestas de API; sigue aplicándose el almacenamiento del navegador descrito arriba. La muestra hecha a mano no solicita generación de historias con IA ni guarda partidas. La versión en inglés usa archivos de audio públicos pregrabados de Google WaveNet; las versiones traducidas usan solo la voz del navegador o dispositivo. El texto de la muestra no se envía al servicio de texto a voz en la nube de Muse.'
        ] },
        retention: { heading: 'Historias del servidor, caducidad y eliminación', paragraphs: [
          'Los recorridos personales e historias compartidas, incluido el progreso guardado, los medios de regalo, mensajes de voz y grabaciones preparadas, permanecen en el servidor de Muse hasta que se eliminan; no caducan automáticamente. Quitar una entrada de la biblioteca del navegador no elimina la historia del servidor. Usa la gestión privada de historias compartidas o Eliminar historia al final de Mi historia. No se garantiza el alojamiento indefinido. Si existen copias de seguridad, pueden conservar datos por separado; este aviso no garantiza su configuración, cobertura ni recuperación.',
          'Los creadores pueden borrar una historia compartida desde su página de gestión privada, lo que desactiva los enlaces y pone los medios asociados en cola para su eliminación. Tras confirmar y verificar la autorización, Eliminar historia al final de Mi historia borra permanentemente del servidor y de este navegador un recorrido personal y su progreso. Las historias antiguas solo del navegador se borran localmente. Quitar una entrada de biblioteca no elimina los datos del servidor. Las URL privadas firmadas ya emitidas pueden seguir funcionando hasta caducar, hasta 10 minutos después de borrar o cambiar el enlace. Las copias de seguridad conservadas por separado podrían contener registros y medios eliminados.'
        ] },
        media: { heading: 'Fotos, vídeo y voz', paragraphs: [
          'Las fotos y vídeos de historias compartidas se guardan de forma privada y no se envían al proveedor de IA. Un archivo revelado está disponible tras una respuesta correcta o, si el creador lo permite, cuando el destinatario confirma que quiere saltar. El salto se registra por separado de la resolución y no revela la respuesta secreta. Al borrar una historia, sus medios quedan pendientes de limpieza; las copias de seguridad pueden ser independientes.',
          'El dictado usa el reconocimiento de voz del navegador o dispositivo y puede enviar audio a un servicio en línea. Revisa la transcripción antes de enviarla. La narración del navegador puede procesarse localmente; si el despliegue activa un proveedor de narración en línea, este podría procesar el texto enviado.',
          'La voz en la nube envía texto elegido a Google Cloud Text-to-Speech o ElevenLabs, indicado en Audio. Las cuentas nuevas usan el permiso guardado al registrarse; las existentes mantienen consentimiento separado. Google requiere credenciales y un límite de caracteres. El audio preparado envía solo título, texto y pista de escena, no respuestas privadas, revelaciones ni turnos de IA en vivo. Se guarda en privado; reproducirlo no reenvía texto. Hace falta acceso autorizado a la historia. Borrar no retira audio ya cargado o guardado. Los errores no cambian silenciosamente a la voz del dispositivo.',
          'La narración de Google también usa una caché de audio privada y deduplicada con metadatos de búsqueda cifrados mediante hash, no textos de narración en claro. El audio se conserva hasta 30 días; las solicitudes activan la limpieza, que no está garantizada con una frecuencia programada. Borrar una historia desactiva el acceso al audio específico, pero no borra de inmediato otra copia en caché, que permanece hasta su limpieza. Las reservas de presupuesto se guardan por separado sin texto de historia en claro; una síntesis fallida o interrumpida puede consumir presupuesto. Las copias de seguridad podrían conservar audio aparte.',
          'Un mensaje de voz personal opcional es una grabación, no dictado ni clonación de voz. Empieza solo tras dar consentimiento y permiso al micrófono. El WAV permanece en esta página hasta subirlo; después se guarda en privado junto a la historia y solo se desbloquea con la revelación final. Los archivos de voz no se envían a la IA. La grabación y la carga se limitan a 60 segundos y 5 MB. Al quitar la historia, la grabación queda pendiente de eliminación.'
        ] },
        gifts: { heading: 'Regalos y respuestas', paragraphs: [
          'Las historias personales completadas se pueden volver a leer sin modificarlas. Ya no se ofrece exportación de la historia en PDF. Borrar la historia en línea no revoca copias guardadas o impresas anteriormente.',
          'El romance es opcional, adulto y no explícito. Su estilo se guarda con la historia y se envía a la IA para generar y continuar. Las cuentas nuevas reutilizan el permiso adulto opcional del registro; cuentas existentes e invitados confirman edad adulta y consentimiento en cada flujo. Los destinatarios eligen abrir después de un aviso. La autodeclaración no verifica edad, identidad ni contenido del remitente. No incluyas información sexual sensible ni representes a personas reales sin permiso.',
          'La portada del regalo y su dedicatoria son visibles para cualquiera que tenga el enlace del destinatario antes de resolver. No incluyas respuestas secretas ni la sorpresa final en la portada. Las vistas previas del enlace muestran información genérica de Muse, no el texto privado de la historia.',
          'Si el creador activa las respuestas, los destinatarios pueden enviar un mensaje escrito después de revelar la sorpresa. Las respuestas se guardan en privado con la historia hasta que caduque o se elimine y se consultan desde la página protegida de gestión del creador. No se envían a la IA. Muse no verifica la identidad del destinatario ni ofrece confirmaciones de lectura. Se puede sustituir una respuesta desde la misma partida; borrar el almacenamiento del navegador puede hacer que se pierda el acceso.',
          'La tarjeta imprimible contiene el enlace privado del destinatario como QR y dirección, con un saludo opcional visible antes del aviso de contenido. El QR se genera en tu dispositivo. Quien tenga una copia puede abrir la historia mientras el enlace sea válido. Borrar, caducar o reemplazar el enlace invalida la tarjeta; imprimir no guarda la historia en línea.'
        ] },
        operations: { heading: 'Seguridad operativa e informes de errores', paragraphs: [
          'Muse no registra visitas a páginas o al sitio ni usa analítica de terceros. Para operaciones registra códigos fijos de eventos, como creación de historias, fallos de proveedores y avisos de límites de seguridad, con marcas de tiempo. Estos registros excluyen texto de historias, URL de páginas, enlaces de capacidad e IP sin procesar; se deduplican por minuto y se conservan hasta siete días. La limitación de solicitudes usa por separado hashes temporales derivados de IP: hash con clave en producción y hash simple en desarrollo local. Las claves de contador contienen el hash derivado, no la IP original. Los límites incluyen hasta 120 solicitudes generales por minuto, 20 intentos fallidos de código de creador cada 10 minutos y 5 solicitudes de informe de errores por minuto.',
          'Los eventos operativos aparecen en el panel privado de operaciones y en los registros del servidor. No hay un servicio externo de notificaciones configurado, por lo que quizá no se avise a los operadores cuando ocurra un evento. Los registros de la plataforma de alojamiento pueden conservarse por separado.'
        ] },
        cookies: { heading: 'Cookies y analítica', paragraphs: [
          'Actualmente Muse no utiliza SDK de analítica o publicidad de terceros, por lo que no hay un banner de cookies analíticas. Esto no cubre las cookies ni el tratamiento de proveedores de alojamiento, almacenamiento u otra infraestructura.'
        ] },
        contacts: { heading: 'Operador y contacto', paragraphs: [] }
      },
      operatorLabel: 'Operador', supportLabel: 'Contacto de soporte',
      notReady: 'No lances la beta pública hasta configurar ambos contactos y completar la revisión legal de la privacidad y los términos del producto.'
    },
    terms: {
      title: 'Términos', documentTitle: 'Muse — Términos', description: 'Borrador de los términos del producto para usar la beta de Muse.',
      sections: {
        status: { heading: 'Estado del borrador', paragraphs: ['Borrador de los términos del producto de un prototipo. No es una aprobación legal ni un acuerdo certificado. Muse es un prototipo beta público y no debe lanzarse públicamente hasta configurar el operador y los contactos de soporte y revisar estos términos.'] },
        use: { heading: 'Uso de Muse', paragraphs: [
          'Muse ayuda a crear historias interactivas. El material generado por IA puede ser inexacto, incompleto o inadecuado; revísalo y usa tu propio criterio. Muse no ofrece asesoramiento profesional, médico, terapéutico ni de emergencia.',
          'Envía solo material que tengas derecho a usar y permiso para compartir. No envíes información personal sensible ni información confidencial de otra persona. Eres responsable del texto, los medios y los enlaces privados que crees o compartas, incluida la elección de quién recibe cada enlace.'
        ] },
        romance: { heading: 'Romance opcional', paragraphs: [
          'Los temas románticos Sweet y Spicy no son explícitos y son para adultos de 18 años o más y personajes adultos que consienten. La intimidad termina en fundido a negro. No uses Muse para contenido sexual explícito, contenido sexual con menores, coerción ni representaciones sexualizadas de personas reales sin permiso. No subas fotos, vídeos o grabaciones explícitos. Revisa la historia y los archivos adjuntos antes de enviarlos.',
          'En las historias románticas compartidas etiquetadas, los destinatarios eligen si abrir antes de recibir portada, historia o medios. Pueden rechazarla. La edad y el consentimiento se declaran, no se verifican de forma independiente; elegir abrir no respalda el contenido del remitente. Las instrucciones a la IA y este aviso no son moderación completa ni garantizan que los envíos o resultados generados sean adecuados.'
        ] },
        storage: { heading: 'Almacenamiento y eliminación', paragraphs: [
          'Crear y gestionar historias del servidor requiere una cuenta de Muse iniciada. Los creadores solo pueden acceder a historias asignadas a su cuenta. Los destinatarios pueden abrir un enlace privado de regalo sin iniciar sesión. Las historias de regalo antiguas sin reclamar no se asignan automáticamente a cuentas; el creador puede reclamar una presentando su enlace privado de propietario existente. Las historias personales antiguas y los datos del navegador no se migran automáticamente.',
          'Las historias del servidor no caducan automáticamente y permanecen hasta su eliminación; el alojamiento continuado no está garantizado para siempre. Si hay copias de seguridad, se conservan aparte; no se garantizan su configuración, cobertura ni recuperación. No se garantiza una copia de seguridad completa ni recuperar los medios. Borrar una historia compartida desde su página de gestión desactiva sus enlaces y códigos QR impresos. Para borrar un recorrido personal, usa Eliminar historia al final de Mi historia; quitar solo una entrada de la biblioteca del navegador no elimina la copia del servidor. No se reembolsan los intentos utilizados.',
          'Los medios compartidos son privados y no se envían a la IA. El contenido enviado al proveedor de IA o voz configurado también está sujeto a sus términos de tratamiento, además de la información de privacidad de Muse.',
          'La narración y la impresión de tarjetas varían según el navegador. Studio solo cubre escenas preparadas y requiere configuración y permiso de procesamiento: guardado al registrarse para cuentas nuevas, separado para las existentes. No se garantiza disponibilidad. El QR comparte un enlace, no almacenamiento: borrarlo, caducarlo o reemplazarlo lo invalida. Las copias ya guardadas o impresas no se pueden revocar.'
        ] },
        operations: { heading: 'Controles operativos', paragraphs: [
          'Muse no recopila analítica de visitas a páginas o al sitio. Para operar el servicio registra códigos fijos de eventos, como creación de historias y fallos de seguridad o proveedores, con marcas de tiempo; se deduplican por minuto y se conservan hasta siete días. Excluyen texto de historias, URL, enlaces de capacidad e IP sin procesar. Los límites de solicitudes usan hashes temporales derivados de IP (con clave en producción y simples en desarrollo local). Los registros del alojamiento pueden conservarse aparte. El estado operativo y los registros del servidor no tienen alertas externas proactivas configuradas.'
        ] },
        availability: { heading: 'Disponibilidad', paragraphs: [
          'Este prototipo puede cambiar, no estar disponible o no conservar los datos. Guarda copias propias de todo lo importante. No confíes en Muse como archivo seguro.'
        ] },
        contacts: { heading: 'Operador y contacto', paragraphs: [] }
      },
      operatorLabel: 'Operador', supportLabel: 'Contacto de soporte'
    },
    support: {
      title: 'Soporte', documentTitle: 'Muse — Soporte', description: 'Estado del soporte y los contactos de Muse.',
      intro: 'Muse es un prototipo en preparación para la beta pública. El soporte aún no cuenta con personal ni está disponible.',
      contactsHeading: 'Estado del contacto', operatorLabel: 'Operador', supportLabel: 'Correo de soporte',
      configured: 'Configurado', missing: 'No configurado', invalid: 'No configurado (configuración no válida)',
      emailAction: 'Enviar correo al soporte', noAddress: 'No hay una dirección de soporte disponible; no se ha inventado ni sustituido ninguna.',
      warning: 'No envíes enlaces privados de historias, códigos de creador, contraseñas ni información personal sensible a un contacto no verificado. La beta pública no está lista hasta configurar el operador y el correo de soporte y completar la revisión legal.'
    }
  },
  'zh-CN': {
    eyebrow: '帮助与信息',
    privacy: {
      title: '隐私', documentTitle: 'Muse — 隐私', description: 'Muse 如何处理故事输入、浏览器记忆、共享故事和媒体。',
      intro: '产品隐私说明草案。Muse 是尚未获准公开上线的公开测试原型。上线前请确认运营方和支持联系人，并完成法律审查。',
      sections: {
        ai: { heading: '哪些内容会发送给 AI', paragraphs: [
          '新账户在注册时明确同意一项处理权限，涵盖故事 AI、选定记忆、分享摘要、云旁白、听写和保存的语音留言。成人浪漫权限单独选择且为可选项。两项权限保存至账户，可在设置中撤销；同意不会自动启动付费操作或录音。麦克风仍需浏览器授权。现有账户和访客保留原有各功能确认。',
          '创建或续写 AI 故事时，Muse 会将你提交的文本发送到此部署配置的 AI 服务商。“我的故事”会发送你的需求、故事选择和新回复；默认情况下，新个人故事会包含浏览器中最近五条记忆。你可以在创建时排除这些记忆；发送前必须明确同意。在“自我”中保存个人信息不会将其发送给故事 AI 服务商。共享故事简介可能包含姓名、场景、目标、个人提示、秘密和备选答案、旁白说明及最终书面留言。共享游戏中的实时操作也会发送以生成 AI 回合。配置的服务商可能按其自身条款处理信息。请勿提交敏感信息或他人的私人信息。',
          '在“自我”中保存记忆只会存储在此浏览器，不会发送给 AI。共享猜测会发送给 Muse，以便与创建者的答案核对，不会发送给 AI。提示、确认跳过和资料库操作不会调用 AI。'
        ] },
        browser: { heading: '浏览器存储与账户', paragraphs: [
          'Muse 账户使用 Supabase Auth 的电子邮件和密码登录。创建或管理服务器故事需要账户。普通礼物接收者无需账户即可打开私人链接；合作故事允许 Muse 会员使用账户加入，访客通过私人链接加入并选择显示名称。礼物故事和服务器上的个人旅程关联到已登录账户；在其他设备登录即可恢复账户所属故事。旧版仅存于浏览器的故事、记忆、偏好、草稿和未发送答案不会同步到账户。浏览器中存储的信息是可读的未加密文本；能够访问此浏览器配置文件或存储的人可能读取这些内容。恢复草稿不会向 AI 发送信息，也不会生成故事。',
          '你可以在“自我”中编辑或忘记记忆，也可以在故事库中移除条目。这些操作只影响此浏览器；不会删除已生成的故事、撤销其服务器访问凭据，也不会移除已发送给 AI 服务商的信息。',
          '已登录创建者只能列出和管理其账户拥有的故事。服务器会验证 Supabase 访问令牌，并在创建者操作时检查所有权。持有旧版私人所有者链接的人可以认领未归属的旧礼物故事；旧故事不会自动分配给第一个登录的账户。接收者链接仍无需账户。账户恢复不会找回已删除故事或仅保存在浏览器中的数据。恢复个人旅程也需要登录。',
          '共享游玩进度使用随机浏览器会话凭据保存在服务器上（服务器端会进行哈希处理），包括场景、提示、猜测次数以及揭晓是否已解答或跳过。只要链接和浏览器存储仍有效，在同一浏览器重新打开同一链接即可继续该次游玩。发送者可私下刷新已打开、未完成、已解答和已跳过游玩的汇总计数，以及达到的最远预制场景或单次游玩成功生成的实时场景数上限。打开链接即计为开始，包括尚未打开礼物封面时；换用浏览器或清除存储可能再次计数。计数涵盖该故事较早的接收者链接。这不是经过验证的接收者身份、阅读证明或实时动态。概览不显示会话标识、书面答案或浏览历史，进度也不会发送给 AI。进度与故事一起保留，直到过期或删除。',
          '在合作礼物故事中，参与者共享同一段实时冒险。所有人都能看到显示名称、当前回合和共享进度；账户会员显示 Muse 个人资料名称，访客自行选择名称。回合按加入顺序轮换，只有当前参与者可以操作或跳过。访客身份关联到私人接收者链接的随机浏览器会话令牌，并非经过验证的现实身份；清除浏览器存储可能使访客以新参与者身份重新加入。操作属于共享故事的一部分，可能发送给配置的 AI 服务商。故事及其实时互动额度归创建者账户所有。',
          '创建者可在设置中启用或停用应用内共享故事进度通知。启用后，当 Muse 处于打开状态且创建者已登录时，Muse 会定期检查首次打开、进度节点和完成情况的汇总数据。通知偏好和上次检查的进度快照保存在该浏览器，不会同步到其他设备。这些不是电子邮件或浏览器推送通知。',
          '将 Muse 安装到主屏幕只会添加类似应用的快捷方式，不会创建账户或跨设备同步；仍需联网。仅联网的 service worker 不会离线缓存私人故事、媒体或 API 响应；上述浏览器存储仍然适用。手工制作的示例不会请求 AI 生成故事，也不会保存游玩进度。英文版本使用预先录制的公开 Google WaveNet 音频；翻译版本仅使用浏览器或设备语音。示例故事文本不会发送到 Muse 云端文本转语音服务。'
        ] },
        retention: { heading: '服务器故事、期限与删除', paragraphs: [
          '个人旅程和共享故事（包括已保存进度、礼物媒体、语音留言及预制故事录音）会一直保存在 Muse 服务器上，直到删除；不会自动过期。从浏览器资料库移除条目不会删除服务器故事。共享故事请使用私人管理控件；个人旅程请使用“我的故事”底部的“删除故事”。不保证永久持续托管。若有备份，可能会单独保留数据；本说明不保证备份配置、覆盖范围或恢复能力。',
          '创建者可在共享故事的私人管理页删除故事，这会停用链接并将相关媒体加入删除队列。经确认并验证创建者权限后，“我的故事”底部的“删除故事”会从服务器和此浏览器永久删除个人旅程及其进度。仅保存在旧浏览器中的故事会在本地删除。仅移除资料库条目不等于删除服务器数据。已签发的私人签名媒体 URL 最长可能在删除或轮换链接后继续有效 10 分钟，直到过期。单独保留的备份可能仍包含已删除记录和媒体。'
        ] },
        media: { heading: '照片、视频与语音', paragraphs: [
          '共享故事的照片和视频以私密方式存储，不会发送给 AI 服务商。答对后可查看揭晓文件；如果创建者允许，接收者确认跳过后也可查看。跳过与答对分别记录，不会泄露秘密答案。删除故事会将媒体加入清理队列；存储备份可能单独保留。',
          '听写使用浏览器或设备提供的语音识别，并可能将音频发送到在线语音服务。提交前请检查转写内容。浏览器旁白可能在本地处理；如果部署启用了在线旁白服务商，发送的文本可能由其处理。',
          '可选云旁白将选定文本发送至音频控件显示的 Google Cloud Text-to-Speech 或 ElevenLabs。新账户使用注册时保存的权限，现有账户仍需单独同意。Google 需要凭据和字符预算。预制礼物音频只发送场景标题、正文及线索，不发送私人答案、揭晓或实时 AI 回合。录音私密缓存；播放不会再次发送文本。需获得故事访问授权。删除无法撤回已加载或保存的音频。故障不会静默切换至设备语音。',
          'Google 旁白还使用独立的私密去重音频缓存，查找元数据经过哈希处理，而不是保存明文旁白输入。缓存音频最多保留 30 天，清理由请求触发，不保证定期清理。删除故事会停用故事专属音频访问，但不会立即删除单独缓存的副本；该副本保留至清理。预算预留会独立保留，不含明文故事文本；合成失败或中断也可能消耗预算。备份可能单独保留音频。',
          '可选个人语音留言是录音，不是听写或语音克隆。只有在你同意并授予麦克风权限后才开始录音。WAV 文件会留在此页面，直到上传；之后与故事一起私密存储，仅在最终揭晓时解锁。语音文件不会发送给 AI。录制和上传上限为 60 秒和 5 MB。删除故事会将存储的录音加入删除队列。'
        ] },
        gifts: { heading: '礼物与回复', paragraphs: [
          '个人故事完成后可只读重温。不再提供故事 PDF 导出。删除在线故事无法撤回此前保存或打印的副本。',
          '浪漫主题可选，仅供成人且不露骨。风格与故事一起保存，并发送给 AI 用于生成和续写。新账户沿用注册时的可选成人许可；已有账户和访客在每次流程确认成年及同意边界。接收者阅读内容提示后选择打开。自我声明不验证年龄、身份或发送者内容。请勿包含敏感性信息或未经许可描绘现实人物。',
          '礼物封面和赠言在答题前对任何持有接收者链接的人可见。请勿在封面上写秘密答案或最终惊喜。链接预览展示的是 Muse 通用信息，不是私人故事文本。',
          '创建者启用回复后，接收者可以在揭晓惊喜后选择发送书面留言。回复会与故事一起私密保存，直到过期或删除，并可通过创建者受保护的管理页面查看。回复不会发送给 AI。Muse 不验证接收者身份，也不提供已读回执。同一次游玩可替换回复；清除浏览器存储可能导致无法再访问。',
          '可打印礼物卡包含接收者私密链接的二维码和地址，以及内容提示前可见的可选问候语。二维码在设备上生成。任何持有副本的人都可在链接有效时打开故事。删除、过期或更换链接会使卡片失效；打印不会保存在线故事。'
        ] },
        operations: { heading: '运营安全与错误报告', paragraphs: [
          'Muse 不记录页面浏览或网站访问，也不使用第三方分析工具。为运营服务，会记录带时间戳的固定事件代码，例如故事创建、服务商故障和安全限制警告。记录不包含故事文本、页面 URL、访问凭据链接或原始 IP 地址；每分钟去重，最多保留七天。限流另行使用短期 IP 派生哈希：生产环境使用密钥哈希，本地开发使用普通哈希。计数器键仅含派生哈希，不含原始 IP。限制包括每分钟最多 120 个普通请求、每 10 分钟 20 次创建者代码失败尝试以及每分钟 5 次错误报告请求。',
          '运营事件显示在私密运营面板和服务器日志中。未配置外部通知服务，因此发生事件时运营人员可能不会收到提醒。托管平台日志可能有独立的保留期限。'
        ] },
        cookies: { heading: 'Cookie 与分析', paragraphs: [
          'Muse 目前不使用第三方分析或广告 SDK，因此未配置分析 Cookie 横幅。本说明不涵盖托管、存储或其他基础设施服务商使用的 Cookie 或数据处理。'
        ] },
        contacts: { heading: '运营方与联系方式', paragraphs: [] }
      },
      operatorLabel: '运营方', supportLabel: '支持联系人',
      notReady: '在运营方和支持联系人均已配置，且隐私说明与产品条款完成法律审查之前，不得启动公开测试。'
    },
    terms: {
      title: '条款', documentTitle: 'Muse — 条款', description: '使用 Muse 故事测试版的产品条款草案。',
      sections: {
        status: { heading: '草案状态', paragraphs: ['原型产品条款草案。本内容不构成法律批准或经认证的法律协议。Muse 是公开测试原型；在配置运营方和支持联系人并审查本条款之前，不得公开上线。'] },
        use: { heading: '使用 Muse', paragraphs: [
          'Muse 帮助创建互动故事。AI 生成内容可能不准确、不完整或不适宜；请自行审核并判断。Muse 不提供专业、医疗、心理治疗或紧急建议。',
          '只能提交你有权使用且获准分享的材料。请勿提交敏感个人信息或他人的机密信息。你要对提供的文本、媒体以及创建或分享的私人链接负责，包括自行选择链接接收者。'
        ] },
        romance: { heading: '可选浪漫主题', paragraphs: [
          'Sweet 和 Spicy 浪漫主题不露骨，仅适用于年满 18 岁的成年人和双方同意的成年角色。亲密场景以淡出处理。请勿将 Muse 用于露骨性内容、涉及未成年人的性内容、胁迫，或未经许可对现实人物进行性化描绘。请勿上传露骨照片、视频或录音。发送前请检查故事和附件。',
          '标记的共享浪漫故事要求接收者先选择是否打开，之后才会收到封面、故事或媒体。接收者可以拒绝。年龄和同意由用户自行声明，不会独立验证；选择打开不代表认可发送者的内容。AI 指令和本提示不构成完整审核，也不保证用户提交或生成内容适宜。'
        ] },
        storage: { heading: '存储与删除', paragraphs: [
          '创建或管理服务器故事需要登录 Muse 账户。创建者只能访问分配给自己账户的故事。接收者无需登录即可打开私人礼物故事链接。未认领的旧礼物故事不会自动分配给账户；创建者可出示现有私人所有者链接来认领。旧个人故事和仅在浏览器中的数据不会自动迁移到账户。',
          '服务器故事不会自动过期，会一直保留到删除为止；不保证永久托管。如有备份，会独立保留；本条款不保证备份配置、覆盖或恢复。也不保证完整备份或媒体恢复。从管理页删除共享故事会停用其链接和已打印二维码。请在“我的故事”底部使用“删除故事”来删除个人旅程；只从浏览器资料库移除条目不会删除服务器副本。已用次数不予退款。',
          '共享媒体是私密的，不会发送给 AI。发送给配置的 AI 或语音服务商的内容，除 Muse 隐私说明外，也受该服务商的数据处理条款约束。',
          '设备旁白与卡片打印因浏览器而异。Studio 仅涵盖预制场景，需运营方配置和处理许可：新账户使用注册时保存的许可，现有账户另行同意。不保证可用。二维码分享链接而非永久保存故事；删除、过期或更换链接会使其失效。此前保存或打印的副本无法撤回。'
        ] },
        operations: { heading: '运营控制', paragraphs: [
          'Muse 不收集页面浏览或网站访问分析。为服务运营，会记录带时间戳的固定事件代码，包括故事创建以及安全或服务商故障；记录每分钟去重，最多保留七天。不包含故事文本、页面 URL、访问凭据链接或原始 IP。请求限流使用短期 IP 派生哈希（生产环境密钥哈希，本地开发普通哈希）。托管平台日志可能独立保留。运营状态和服务器日志未配置主动外部告警。'
        ] },
        availability: { heading: '可用性', paragraphs: [
          '此原型可能变更、无法使用或无法保留数据。请自行保存重要内容。请勿将 Muse 当作安全的长期档案库。'
        ] },
        contacts: { heading: '运营方与联系方式', paragraphs: [] }
      },
      operatorLabel: '运营方', supportLabel: '支持联系人'
    },
    support: {
      title: '支持', documentTitle: 'Muse — 支持', description: 'Muse 支持与联系状态。',
      intro: 'Muse 是正在准备公开测试的原型。支持服务目前尚未安排人员，也暂不可用。',
      contactsHeading: '联系状态', operatorLabel: '运营方', supportLabel: '支持邮箱',
      configured: '已配置', missing: '未配置', invalid: '未配置（设置无效）',
      emailAction: '发送支持邮件', noAddress: '目前没有可用的支持地址；我们不会编造或替换地址。',
      warning: '请勿向未经核实的联系人发送私人故事链接、创建者代码、密码或敏感个人信息。只有在配置运营方和支持邮箱并完成法律审查后，公开测试才可上线。'
    }
  },
  'hi-IN': {
    eyebrow: 'सहायता और जानकारी',
    privacy: {
      title: 'गोपनीयता', documentTitle: 'Muse — गोपनीयता', description: 'Muse कहानी के इनपुट, ब्राउज़र की यादों, साझा कहानियों और मीडिया को कैसे संभालता है।',
      intro: 'उत्पाद की गोपनीयता जानकारी का मसौदा। Muse सार्वजनिक बीटा का एक प्रोटोटाइप है और सार्वजनिक लॉन्च के लिए स्वीकृत नहीं है। लॉन्च से पहले संचालक और सहायता संपर्कों की पुष्टि करें और कानूनी समीक्षा पूरी करें।',
      sections: {
        ai: { heading: 'AI को क्या भेजा जाता है', paragraphs: [
          'नए खाते पंजीकरण पर कहानी AI, चुनी यादें, साझा सारांश, क्लाउड आवाज़, श्रुतलेखन और सहेजे वॉइस संदेशों की एक अनुमति स्वीकार करते हैं। वयस्क रोमांस की अनुमति अलग और वैकल्पिक है। दोनों खाते में सहेजी जाती हैं और सेटिंग में वापस ली जा सकती हैं; सहमति से भुगतान क्रिया या रिकॉर्डिंग शुरू नहीं होती। माइक्रोफ़ोन की अनुमति ब्राउज़र में अलग है। पुराने खाते और अतिथि अपनी सुविधा-विशिष्ट पुष्टि रखते हैं।',
          'AI कहानी बनाते या आगे बढ़ाते समय Muse आपके दिए पाठ को इस परिनियोजन के लिए कॉन्फ़िगर किए गए AI प्रदाता को भेजता है। My Story आपकी ज़रूरत, कहानी के विकल्प और नए जवाब भेजता है; नई व्यक्तिगत कहानियों में डिफ़ॉल्ट रूप से ब्राउज़र की हाल की पाँच यादें शामिल होती हैं। आप कहानी बनाते समय उन्हें छोड़ सकते हैं; भेजने से पहले स्पष्ट सहमति आवश्यक है। Myself में निजी बातें सहेजने से वे कहानी के AI प्रदाता को नहीं भेजी जातीं। साझा कहानी के विवरण में नाम, परिवेश, लक्ष्य, निजी संकेत, रहस्य और वैकल्पिक जवाब, वाचन निर्देश तथा अंतिम लिखित संदेश हो सकते हैं। साझा खेल के लाइव कदम भी AI से बने दौरों के लिए भेजे जाते हैं। कॉन्फ़िगर किया गया प्रदाता अपनी शर्तों के तहत जानकारी संसाधित कर सकता है। संवेदनशील जानकारी या दूसरों की निजी बातें न भेजें।',
          'Myself में याद सहेजने से वह केवल इसी ब्राउज़र में रहती है; AI को नहीं भेजी जाती। साझा अनुमान निर्माता के जवाब से मिलान के लिए Muse को भेजे जाते हैं, AI को नहीं। संकेत, पुष्टि करके छोड़े गए चरण और लाइब्रेरी क्रियाएँ AI कॉल नहीं करतीं।'
        ] },
        browser: { heading: 'ब्राउज़र संग्रहण और खाते', paragraphs: [
          'Muse खाते Supabase Auth के ईमेल और पासवर्ड साइन-इन का उपयोग करते हैं। सर्वर कहानियाँ बनाने या प्रबंधित करने के लिए खाता आवश्यक है। उपहार प्राप्तकर्ता बिना खाते निजी लिंक खोल सकते हैं; सहयोगी कहानियों में Muse सदस्य खाते से और अतिथि निजी लिंक तथा चुने गए प्रदर्शन नाम से जुड़ते हैं। उपहार कहानियाँ और सर्वर पर व्यक्तिगत यात्राएँ साइन-इन खाते से जुड़ी होती हैं; दूसरे डिवाइस पर साइन-इन करने से खाते की कहानियाँ वापस मिलती हैं। केवल ब्राउज़र में मौजूद पुरानी कहानियाँ, यादें, प्राथमिकताएँ, ड्राफ़्ट और न भेजे गए जवाब खाते से सिंक नहीं होते। ब्राउज़र में जानकारी पढ़ने योग्य, बिना एन्क्रिप्शन वाला पाठ है; ब्राउज़र प्रोफ़ाइल या संग्रहण तक पहुँच वाला व्यक्ति इसे पढ़ सकता है। ड्राफ़्ट बहाल करने से AI को जानकारी नहीं भेजी जाती और कहानी नहीं बनती।',
          'आप Myself में यादें बदल या भूल सकते हैं और Story Library में प्रविष्टि हटा सकते हैं। ये कदम केवल इस ब्राउज़र को बदलते हैं; पहले से बनी कहानी नहीं मिटाते, सर्वर की पहुँच रद्द नहीं करते और AI प्रदाता को पहले भेजी जानकारी नहीं हटाते।',
          'साइन-इन निर्माता केवल अपने खाते की कहानियाँ देख और प्रबंधित कर सकते हैं। सर्वर Supabase एक्सेस टोकन सत्यापित करता है और निर्माता की कार्रवाइयों में स्वामित्व जाँचता है। पुराने निजी स्वामी लिंक से बिना खाते वाली पुरानी उपहार कहानी का दावा किया जा सकता है; पुरानी कहानियाँ पहले साइन-इन करने वाले खाते को अपने-आप नहीं दी जातीं। प्राप्तकर्ता लिंक के लिए खाता आवश्यक नहीं। खाता पुनर्प्राप्ति हटाई गई कहानियाँ या केवल ब्राउज़र में रखा डेटा वापस नहीं लाती। निजी यात्रा वापस पाने के लिए भी साइन-इन चाहिए।',
          'साझा खेल की प्रगति सर्वर पर यादृच्छिक ब्राउज़र सत्र क्षमता के तहत रखी जाती है (सर्वर पर हैश की जाती है); इसमें दृश्य, संकेत, अनुमान प्रयास और यह जानकारी शामिल है कि रहस्य हल हुआ या छोड़ा गया। लिंक और ब्राउज़र संग्रहण उपलब्ध रहने तक उसी ब्राउज़र में वही लिंक खोलने से खेल वहीं से चलता है। भेजने वाला खुले, अधूरे, हल किए और छोड़े गए खेलों की कुल संख्या, तथा पहुँचे सबसे आगे के तैयार दृश्य या एक खेल में सफलतापूर्वक बने लाइव दृश्यों की अधिकतम संख्या निजी रूप से रीफ़्रेश कर सकता है। लिंक खोलना शुरुआत माना जाता है, उपहार कवर खोलने से पहले भी; दूसरा ब्राउज़र या संग्रहण मिटाने पर फिर गिना जा सकता है। गिनती में उसी कहानी के पुराने प्राप्तकर्ता लिंक शामिल हैं। इससे प्राप्तकर्ता की पहचान सत्यापित नहीं होती, पढ़ने का प्रमाण नहीं मिलता और यह लाइव गतिविधि फ़ीड नहीं है। सारांश में सत्र ID, लिखित जवाब या ब्राउज़िंग इतिहास नहीं दिखता और प्रगति AI को नहीं भेजी जाती। प्रगति समाप्ति या हटाने तक कहानी के साथ रहती है।',
          'सहयोगी उपहार कहानियों में सभी प्रतिभागी एक साझा लाइव रोमांच खेलते हैं। समूह प्रदर्शन नाम, किसकी बारी है और साझा प्रगति देख सकता है; खाते वाले सदस्य Muse प्रोफ़ाइल नाम और अतिथि चुना हुआ नाम दिखाते हैं। बारी जुड़ने के क्रम में बदलती है; केवल सक्रिय प्रतिभागी कदम उठा या छोड़ सकता है। अतिथि की पहचान निजी लिंक से जुड़े यादृच्छिक ब्राउज़र सत्र टोकन पर आधारित है, सत्यापित वास्तविक पहचान पर नहीं; ब्राउज़र संग्रहण मिटाने से अतिथि नए प्रतिभागी के रूप में जुड़ सकता है। कदम साझा कहानी का हिस्सा हैं और कॉन्फ़िगर किए गए AI प्रदाता को भेजे जा सकते हैं। कहानी और लाइव इंटरैक्शन सीमा निर्माता के खाते की है।',
          'निर्माता Settings में साझा कहानी प्रगति की ऐप के भीतर सूचनाएँ चालू या बंद कर सकते हैं। चालू होने पर, Muse खुला और निर्माता साइन-इन हो तो Muse पहली बार खुलने, प्रगति पड़ाव और पूर्णता के कुल आँकड़े समय-समय पर जाँचता है। प्राथमिकता और पिछली जाँच के प्रगति स्नैपशॉट उसी ब्राउज़र में रहते हैं, दूसरे डिवाइस से सिंक नहीं होते। ये ईमेल या ब्राउज़र पुश सूचनाएँ नहीं हैं।',
          'होम स्क्रीन पर Muse जोड़ने से ऐप जैसा शॉर्टकट बनता है, खाता या उपकरणों के बीच सिंक नहीं; इंटरनेट फिर भी आवश्यक है। केवल नेटवर्क वाला service worker निजी कहानियों, मीडिया या API जवाबों की ऑफ़लाइन कैश नहीं बनाता; ऊपर बताया ब्राउज़र संग्रहण लागू रहता है। हाथ से बनाया नमूना AI कहानी बनाने के अनुरोध नहीं करता और खेल सहेजता नहीं है। अंग्रेज़ी संस्करण पहले से रिकॉर्ड किए गए सार्वजनिक Google WaveNet ऑडियो का उपयोग करता है; अनुवादित संस्करण केवल ब्राउज़र या डिवाइस की वाणी का उपयोग करते हैं। नमूने का कहानी-पाठ Muse के क्लाउड टेक्स्ट-टू-स्पीच को नहीं भेजा जाता।'
        ] },
        retention: { heading: 'सर्वर कहानियाँ, समय-सीमा और हटाना', paragraphs: [
          'व्यक्तिगत यात्राएँ और साझा कहानियाँ, सहेजी प्रगति, उपहार मीडिया, वॉइस संदेश और तैयार रिकॉर्डिंग सहित, हटाए जाने तक Muse सर्वर पर रहती हैं; अपने-आप समाप्त नहीं होतीं। ब्राउज़र लाइब्रेरी से प्रविष्टि हटाने पर सर्वर कहानी नहीं मिटती। साझा कहानी के निजी प्रबंधन नियंत्रण या My Story के नीचे Delete story का उपयोग करें। निरंतर होस्टिंग हमेशा जारी रहने की गारंटी नहीं है। बैकअप, यदि हों, अलग अवधि तक डेटा रख सकते हैं; यह सूचना बैकअप सेटिंग, कवरेज या पुनर्प्राप्ति की गारंटी नहीं देती।',
          'निर्माता साझा कहानी के निजी प्रबंधन पृष्ठ से उसे हटा सकते हैं; इससे लिंक बंद होते हैं और संबंधित मीडिया हटाने की कतार में जाता है। पुष्टि और निर्माता अनुमति के बाद My Story के नीचे Delete story व्यक्तिगत यात्रा और उसकी प्रगति को सर्वर तथा इस ब्राउज़र से स्थायी रूप से हटाता है। पुरानी केवल-ब्राउज़र कहानियाँ स्थानीय रूप से हटती हैं। केवल लाइब्रेरी प्रविष्टि हटाना सर्वर से हटाना नहीं है। पहले जारी निजी हस्ताक्षरित मीडिया URL हटाने या लिंक बदलने के बाद अधिकतम 10 मिनट तक, समाप्त होने तक चल सकते हैं। अलग बैकअप में हटाए गए रिकॉर्ड और मीडिया रह सकते हैं।'
        ] },
        media: { heading: 'फ़ोटो, वीडियो और वाणी', paragraphs: [
          'साझा कहानी की फ़ोटो और वीडियो निजी रूप से रखे जाते हैं और AI प्रदाता को नहीं भेजे जाते। सही जवाब के बाद या निर्माता की अनुमति होने पर प्राप्तकर्ता द्वारा छोड़ने की पुष्टि के बाद फ़ाइल खुलती है। छोड़ना हल करने से अलग दर्ज होता है और गुप्त जवाब नहीं बताता। कहानी हटाने पर मीडिया सफ़ाई की कतार में जाता है; बैकअप अलग हो सकते हैं।',
          'डिक्टेशन ब्राउज़र या डिवाइस की वाणी पहचान का उपयोग करता है और ऑडियो ऑनलाइन वाणी सेवा को भेज सकता है। भेजने से पहले लिखे पाठ की समीक्षा करें। ब्राउज़र वाचन स्थानीय रूप से संसाधित हो सकता है; यदि इस परिनियोजन में ऑनलाइन वाचन सेवा सक्षम है, तो भेजा गया पाठ वहाँ संसाधित हो सकता है।',
          'वैकल्पिक क्लाउड आवाज़ चुना पाठ Audio में दिखाए Google Cloud Text-to-Speech या ElevenLabs को भेजती है। नए खाते पंजीकरण की सहेजी अनुमति उपयोग करते हैं; पुराने खाते अलग सहमति रखते हैं। Google को क्रेडेंशियल और अक्षर बजट चाहिए। तैयार उपहार ऑडियो में केवल दृश्य का शीर्षक, पाठ और संकेत जाते हैं, निजी जवाब, खुलासा या लाइव AI दौर नहीं। रिकॉर्डिंग निजी कैश होती है; चलाने पर पाठ फिर नहीं जाता। कहानी का अधिकृत प्रवेश चाहिए। मिटाने से पहले लोड या सहेजे ऑडियो वापस नहीं आते। त्रुटि पर चुपचाप डिवाइस आवाज़ नहीं चलती।',
          'Google वाचन एक अलग निजी, डुप्लिकेट-रहित ऑडियो कैश भी उपयोग करता है, जिसमें खोज मेटाडेटा हैश होता है, सादा वाचन पाठ नहीं। कैश ऑडियो 30 दिनों तक रखा जाता है; अनुरोध से सफ़ाई शुरू होती है और निर्धारित सफ़ाई की गारंटी नहीं है। कहानी हटाने से उससे जुड़े ऑडियो की पहुँच बंद होती है, पर अलग कैश प्रति तुरंत नहीं मिटती और सफ़ाई तक रहती है। बजट आरक्षण सादे कहानी पाठ के बिना अलग रखा जाता है; विफल या बाधित संश्लेषण भी बजट खर्च कर सकता है। बैकअप में ऑडियो अलग से रह सकता है।',
          'वैकल्पिक निजी वॉइस संदेश रिकॉर्डिंग है, डिक्टेशन या आवाज़ की नकल नहीं। सहमति और माइक्रोफ़ोन अनुमति के बाद ही रिकॉर्डिंग शुरू होती है। WAV अपलोड होने तक इसी पृष्ठ पर रहती है, फिर कहानी के साथ निजी रूप से रखी जाती है और केवल अंतिम रहस्योद्घाटन पर खुलती है। वॉइस फ़ाइल AI को नहीं भेजी जाती। रिकॉर्डिंग और अपलोड की सीमा 60 सेकंड और 5 MB है। कहानी हटाने पर रिकॉर्डिंग हटाने की कतार में जाती है।'
        ] },
        gifts: { heading: 'उपहार और जवाब', paragraphs: [
          'पूरी हुई निजी कहानियाँ केवल पढ़ने के लिए दोबारा देखी जा सकती हैं। कहानी का PDF निर्यात अब उपलब्ध नहीं है। ऑनलाइन कहानी मिटाने से पहले सहेजी या छापी प्रतियाँ वापस नहीं ली जा सकतीं।',
          'रोमांस वैकल्पिक, वयस्क और गैर-स्पष्ट है। शैली कहानी के साथ सहेजी जाती है और निर्माण तथा आगे लिखने के लिए AI को भेजी जाती है। नए खाते पंजीकरण की वैकल्पिक वयस्क अनुमति उपयोग करते हैं; मौजूदा खाते और अतिथि हर प्रक्रिया में वयस्कता और सहमति की पुष्टि करते हैं। प्राप्तकर्ता सामग्री सूचना के बाद खोलना चुनते हैं। स्वघोषणा उम्र, पहचान या प्रेषक की सामग्री सत्यापित नहीं करती। संवेदनशील यौन जानकारी न जोड़ें या अनुमति बिना वास्तविक लोगों को न दर्शाएँ।',
          'उपहार कवर और समर्पण प्राप्तकर्ता लिंक रखने वाले किसी भी व्यक्ति को जवाब देने से पहले दिखते हैं। कवर पर गुप्त जवाब या अंतिम सरप्राइज़ न लिखें। लिंक पूर्वावलोकन निजी कहानी पाठ नहीं, Muse की सामान्य जानकारी दिखाते हैं।',
          'निर्माता जवाब चालू करे तो प्राप्तकर्ता सरप्राइज़ देखने के बाद लिखित संदेश भेज सकते हैं। जवाब कहानी के साथ समाप्ति या हटाने तक निजी रखे जाते हैं और निर्माता के सुरक्षित प्रबंधन पृष्ठ पर देखे जा सकते हैं। वे AI को नहीं भेजे जाते। Muse प्राप्तकर्ता पहचान सत्यापित या पढ़ने की पुष्टि नहीं करता। उसी खेल से जवाब बदला जा सकता है; ब्राउज़र संग्रहण हटाने पर पहुँच खो सकती है।',
          'प्रिंट योग्य कार्ड में प्राप्तकर्ता का निजी लिंक QR और पते के रूप में तथा सूचना से पहले दिखने वाला वैकल्पिक अभिवादन होता है। QR डिवाइस पर बनता है। प्रति रखने वाला कोई भी व्यक्ति मान्य लिंक खोल सकता है। हटाना, समाप्ति या लिंक बदलना कार्ड अमान्य करता है; छपाई ऑनलाइन कहानी नहीं बचाती।'
        ] },
        operations: { heading: 'परिचालन सुरक्षा और त्रुटि रिपोर्ट', paragraphs: [
          'Muse पृष्ठ दृश्य या वेबसाइट विज़िट दर्ज नहीं करता और तीसरे पक्ष के analytics का उपयोग नहीं करता। सेवा संचालन के लिए समय सहित निश्चित इवेंट कोड दर्ज होते हैं, जैसे कहानी निर्माण, प्रदाता विफलता और सुरक्षा सीमा चेतावनी। इनमें कहानी पाठ, पृष्ठ URL, क्षमता लिंक या कच्चा IP नहीं होता; प्रति मिनट डुप्लिकेट हटते हैं और अधिकतम सात दिन रहते हैं। दर सीमाएँ अलग से अल्पकालिक IP-आधारित हैश उपयोग करती हैं: उत्पादन में कुंजीयुक्त हैश और स्थानीय विकास में साधारण हैश। काउंटर कुंजियों में व्युत्पन्न हैश होता है, कच्चा IP नहीं। सीमाएँ प्रति मिनट 120 सामान्य अनुरोध, हर 10 मिनट में 20 विफल निर्माता-कोड प्रयास और प्रति मिनट 5 त्रुटि रिपोर्ट अनुरोध तक हैं।',
          'परिचालन घटनाएँ निजी संचालन डैशबोर्ड और सर्वर लॉग में दिखती हैं। बाहरी सूचना सेवा कॉन्फ़िगर नहीं है, इसलिए घटना होने पर संचालकों को सूचना न मिले। होस्टिंग प्लेटफ़ॉर्म लॉग की अवधि अलग हो सकती है।'
        ] },
        cookies: { heading: 'कुकी और विश्लेषण', paragraphs: [
          'Muse अभी तीसरे पक्ष के analytics या विज्ञापन SDK का उपयोग नहीं करता, इसलिए analytics-cookie बैनर कॉन्फ़िगर नहीं है। यह होस्टिंग, संग्रहण या अन्य आधारभूत सेवा प्रदाताओं की कुकी या प्रक्रिया को शामिल नहीं करता।'
        ] },
        contacts: { heading: 'संचालक और संपर्क', paragraphs: [] }
      },
      operatorLabel: 'संचालक', supportLabel: 'सहायता संपर्क',
      notReady: 'दोनों संपर्क कॉन्फ़िगर होने और गोपनीयता जानकारी तथा उत्पाद शर्तों की कानूनी समीक्षा पूरी होने तक सार्वजनिक बीटा लॉन्च न करें।'
    },
    terms: {
      title: 'शर्तें', documentTitle: 'Muse — शर्तें', description: 'Muse कहानी बीटा के उपयोग के लिए उत्पाद शर्तों का मसौदा।',
      sections: {
        status: { heading: 'मसौदे की स्थिति', paragraphs: ['प्रोटोटाइप के लिए उत्पाद शर्तों का मसौदा। यह कानूनी स्वीकृति या प्रमाणित कानूनी समझौता नहीं है। Muse सार्वजनिक बीटा प्रोटोटाइप है और संचालक तथा सहायता संपर्क कॉन्फ़िगर करके इन शर्तों की समीक्षा होने तक सार्वजनिक रूप से लॉन्च नहीं होना चाहिए।'] },
        use: { heading: 'Muse का उपयोग', paragraphs: [
          'Muse इंटरैक्टिव कहानियाँ बनाने में मदद करता है। AI-निर्मित सामग्री गलत, अधूरी या अनुपयुक्त हो सकती है; उसकी समीक्षा करें और अपना विवेक इस्तेमाल करें। Muse पेशेवर, चिकित्सकीय, उपचारात्मक या आपातकालीन सलाह नहीं है।',
          'केवल वही सामग्री दें जिसे उपयोग करने का अधिकार और साझा करने की अनुमति हो। संवेदनशील निजी जानकारी या किसी अन्य व्यक्ति की गोपनीय जानकारी न दें। आपके दिए पाठ, मीडिया और बनाए या साझा किए निजी लिंक की ज़िम्मेदारी आपकी है, जिसमें यह चुनना भी शामिल है कि लिंक किसे मिले।'
        ] },
        romance: { heading: 'वैकल्पिक रोमांस', paragraphs: [
          'Sweet और Spicy रोमांस गैर-स्पष्ट विषय हैं और केवल 18 वर्ष या अधिक आयु के वयस्कों तथा सहमति देने वाले वयस्क पात्रों के लिए हैं। अंतरंगता दृश्य से बाहर समाप्त होती है। Muse का उपयोग स्पष्ट यौन सामग्री, नाबालिगों से जुड़ी यौन सामग्री, दबाव या अनुमति बिना वास्तविक लोगों के यौन चित्रण के लिए न करें। स्पष्ट फ़ोटो, वीडियो या रिकॉर्डिंग अपलोड न करें। भेजने से पहले कहानी और संलग्नक देखें।',
          'टैग की गई साझा रोमांस कहानियों में कवर, कहानी या मीडिया मिलने से पहले प्राप्तकर्ता को खोलने का विकल्प चुनना होता है। वे मना कर सकते हैं। उम्र और सहमति स्वयं घोषित हैं, स्वतंत्र रूप से सत्यापित नहीं; खोलने का चुनाव प्रेषक की सामग्री का समर्थन नहीं है। AI निर्देश और यह सूचना पूर्ण मॉडरेशन नहीं हैं और न ही जमा सामग्री या AI आउटपुट की उपयुक्तता की गारंटी देते हैं।'
        ] },
        storage: { heading: 'संग्रहण और हटाना', paragraphs: [
          'सर्वर कहानियाँ बनाने और प्रबंधित करने के लिए Muse खाते में साइन-इन आवश्यक है। निर्माता केवल अपने खाते की कहानियाँ देख सकते हैं। प्राप्तकर्ता बिना साइन-इन निजी उपहार लिंक खोल सकते हैं। बिना दावा की पुरानी उपहार कहानियाँ खाते को अपने-आप नहीं दी जातीं; निर्माता अपना मौजूदा निजी स्वामी लिंक दिखाकर दावा कर सकता है। पुरानी निजी कहानियाँ और केवल-ब्राउज़र डेटा अपने-आप खाते में नहीं जाते।',
          'सर्वर कहानियाँ अपने-आप समाप्त नहीं होतीं और हटाए जाने तक रहती हैं; हमेशा होस्ट करने की गारंटी नहीं है। बैकअप हों तो अलग रखे जाते हैं; कॉन्फ़िगरेशन, कवरेज और पुनर्प्राप्ति की गारंटी नहीं। पूर्ण बैकअप या मीडिया वापसी की गारंटी नहीं है। प्रबंधन पृष्ठ से साझा कहानी हटाने पर लिंक और छपे QR कोड बंद हो जाते हैं। निजी यात्रा हटाने के लिए My Story के नीचे Delete story चुनें; केवल ब्राउज़र लाइब्रेरी से हटाने पर सर्वर कॉपी नहीं मिटती। उपयोग किए गए प्रयास वापस नहीं किए जाते।',
          'साझा मीडिया निजी है और AI को नहीं भेजा जाता। कॉन्फ़िगर AI या वाणी प्रदाता को भेजी सामग्री Muse की गोपनीयता जानकारी के साथ उस प्रदाता की प्रक्रिया शर्तों के अधीन भी है।',
          'वाचन और कार्ड छपाई ब्राउज़र पर निर्भर हैं। Studio केवल तैयार दृश्यों के लिए है और कॉन्फ़िगरेशन तथा प्रसंस्करण अनुमति चाहिए: नए खाते पंजीकरण की अनुमति, पुराने खाते अलग सहमति उपयोग करते हैं। उपलब्धता की गारंटी नहीं। QR लिंक साझा करता है, स्थायी संग्रहण नहीं; हटाना, समाप्ति या बदलना लिंक अमान्य करता है। पहले सहेजी या छापी प्रतियाँ वापस नहीं ली जा सकतीं।'
        ] },
        operations: { heading: 'परिचालन नियंत्रण', paragraphs: [
          'Muse पृष्ठ दृश्य या वेबसाइट विज़िट analytics एकत्र नहीं करता। सेवा के लिए कहानी निर्माण और सुरक्षा या प्रदाता विफलताओं सहित निश्चित इवेंट कोड समय के साथ दर्ज होते हैं; प्रति मिनट डुप्लिकेट हटते हैं और अधिकतम सात दिन रखे जाते हैं। इनमें कहानी पाठ, पृष्ठ URL, क्षमता लिंक या कच्चा IP नहीं होता। अनुरोध दर सीमाएँ अल्पकालिक IP-व्युत्पन्न हैश उपयोग करती हैं (उत्पादन में कुंजीयुक्त, स्थानीय विकास में साधारण)। होस्टिंग लॉग अलग अवधि तक रह सकते हैं। परिचालन स्थिति और सर्वर लॉग के लिए सक्रिय बाहरी अलर्ट कॉन्फ़िगर नहीं हैं।'
        ] },
        availability: { heading: 'उपलब्धता', paragraphs: [
          'यह प्रोटोटाइप बदल सकता है, अनुपलब्ध हो सकता है या डेटा सुरक्षित न रख पाए। महत्वपूर्ण सामग्री की अपनी प्रतियाँ रखें। Muse को सुरक्षित अभिलेखागार न मानें।'
        ] },
        contacts: { heading: 'संचालक और संपर्क', paragraphs: [] }
      },
      operatorLabel: 'संचालक', supportLabel: 'सहायता संपर्क'
    },
    support: {
      title: 'सहायता', documentTitle: 'Muse — सहायता', description: 'Muse सहायता और संपर्क की स्थिति।',
      intro: 'Muse सार्वजनिक बीटा की तैयारी में एक प्रोटोटाइप है। सहायता सेवा अभी उपलब्ध नहीं है और इसके लिए कर्मचारी तैनात नहीं हैं।',
      contactsHeading: 'संपर्क स्थिति', operatorLabel: 'संचालक', supportLabel: 'सहायता ईमेल',
      configured: 'कॉन्फ़िगर है', missing: 'कॉन्फ़िगर नहीं है', invalid: 'कॉन्फ़िगर नहीं है (अमान्य सेटिंग)',
      emailAction: 'सहायता को ईमेल करें', noAddress: 'सहायता पता उपलब्ध नहीं है; कोई पता बनाया या बदला नहीं गया है।',
      warning: 'असत्यापित संपर्क को निजी कहानी लिंक, निर्माता कोड, पासवर्ड या संवेदनशील निजी जानकारी न भेजें। संचालक और सहायता ईमेल कॉन्फ़िगर होकर कानूनी समीक्षा पूरी होने तक सार्वजनिक बीटा तैयार नहीं है।'
    }
  },
  'uk-UA': {
    eyebrow: 'Допомога та інформація',
    privacy: {
      title: 'Конфіденційність', documentTitle: 'Muse — Конфіденційність', description: 'Як Muse обробляє дані для історій, спогади браузера, спільні історії та медіафайли.',
      intro: 'Чернетка інформації про конфіденційність продукту. Публічний запуск прототипу бета-версії Muse не схвалено. Перед запуском підтвердьте контакти оператора й підтримки та завершіть юридичну перевірку.',
      sections: {
        ai: { heading: 'Що надсилається ШІ', paragraphs: [
          'Нові облікові записи під час реєстрації явно приймають один дозвіл на ШІ історій, вибрані спогади, поширювані описи, хмарну озвучку, диктування та збережені голосові повідомлення. Дозвіл на дорослу романтику окремий і необов’язковий. Обидва зберігаються в обліковому записі та відкликаються в Налаштуваннях; згода не запускає запис чи платні дії. Мікрофон потребує окремого дозволу браузера. Наявні облікові записи й гості зберігають попередні перевірки для кожної функції.',
          'Коли ви створюєте або продовжуєте історію за допомогою ШІ, Muse надсилає введений текст постачальнику ШІ, налаштованому для цього розгортання. «Моя історія» надсилає ваш запит, вибір історії та нові відповіді; за замовчуванням нові особисті історії містять п’ять останніх спогадів браузера. Під час створення їх можна виключити; перед надсиланням потрібна явна згода. Збереження особистих даних у розділі «Я» не надсилає їх постачальнику ШІ для історій. Короткий опис спільної історії може містити імена, місце дії, мету, особисті підказки, таємницю й альтернативні відповіді, інструкції для озвучування та фінальне письмове повідомлення. Дії під час спільної гри також надсилаються для створення ходів ШІ. Налаштований постачальник може обробляти дані за власними умовами. Не надсилайте конфіденційні дані чи приватну інформацію про інших.',
          'Збережений у розділі «Я» спогад залишається лише в цьому браузері й не надсилається ШІ. Спільні здогадки надсилаються Muse для порівняння з відповіддю автора, а не ШІ. Підказки, підтверджені пропуски й дії бібліотеки не викликають ШІ.'
        ] },
        browser: { heading: 'Дані браузера й облікові записи', paragraphs: [
          'Для входу в облікові записи Muse використовується електронна пошта й пароль Supabase Auth. Щоб створювати або керувати серверними історіями, потрібен обліковий запис. Отримувачі подарунка можуть відкрити приватне посилання без облікового запису; у спільних історіях учасники Muse приєднуються через обліковий запис, а гості — за приватним посиланням і вибраним ім’ям. Подарункові історії та особисті подорожі на сервері пов’язані з обліковим записом; вхід на іншому пристрої відновлює його історії. Застарілі історії, спогади, налаштування, чернетки й невідіслані відповіді, що зберігаються лише в браузері, не синхронізуються з обліковим записом. Дані браузера — читабельний незашифрований текст; людина з доступом до профілю чи сховища браузера може їх прочитати. Відновлення чернетки не надсилає дані ШІ й не створює історію.',
          'Ви можете редагувати або забути спогади в розділі «Я» та прибрати запис із бібліотеки історій. Ці дії змінюють лише цей браузер: вони не стирають створену історію, не відкликають доступ до сервера й не видаляють дані, уже надіслані постачальнику ШІ.',
          'Автори, які ввійшли в систему, можуть переглядати й керувати лише історіями свого облікового запису. Сервер перевіряє токен доступу Supabase і право власності для дій автора. Старе приватне посилання власника дає змогу привласнити незакріплену за обліковим записом застарілу подарункову історію; такі історії автоматично не призначаються першому, хто ввійшов. Посилання отримувачів не потребують облікового запису. Відновлення облікового запису не повертає видалені історії чи дані лише з браузера. Для відновлення особистої подорожі також потрібно ввійти.',
          'Прогрес спільного проходження зберігається на сервері під випадковим маркером сеансу браузера (на сервері хешується); він охоплює сцену, підказки, спроби та факт розгадування або пропуску розкриття. Те саме посилання в тому самому браузері відновлює проходження, поки доступні посилання й сховище браузера. Відправник може приватно оновити загальні лічильники відкритих, незавершених, розгаданих і пропущених проходжень, а також найдальшої підготовленої сцени або найбільшої кількості успішно згенерованих живих сцен за одне проходження. Відкриття посилання вважається початком, навіть до обкладинки; інший браузер або очищення сховища може бути пораховано повторно. Лічильники включають попередні посилання тієї самої історії. Це не підтвердження особи отримувача чи прочитання й не стрічка активності. Огляд не показує ідентифікатори сеансів, письмові відповіді чи історію перегляду; прогрес не надсилається ШІ. Він зберігається з історією до завершення строку або видалення.',
          'У спільних подарункових історіях учасники мають одну спільну пригоду наживо. Група бачить імена, чия черга та спільний прогрес; учасники з обліковим записом використовують ім’я профілю Muse, гості обирають ім’я. Черги йдуть за порядком приєднання; діяти або пропустити може лише активний учасник. Гостьова особа прив’язана до випадкового токена сеансу браузера й приватного посилання, а не перевіряється в реальному світі; очищення сховища може створити нового учасника. Дії є частиною історії та можуть надсилатися налаштованому постачальнику ШІ. Історія та ліміт взаємодій наживо належать обліковому запису автора.',
          'Автори можуть увімкнути або вимкнути внутрішні сповіщення про прогрес спільних історій у налаштуваннях. Якщо їх увімкнено, поки Muse відкрито й автор увійшов, сервіс періодично перевіряє загальні дані про перші відкриття, етапи та завершення. Налаштування й останні знімки прогресу зберігаються в цьому браузері й не синхронізуються. Це не електронна пошта й не push-сповіщення браузера.',
          'Додавання Muse на головний екран створює ярлик, схожий на застосунок, але не обліковий запис і не синхронізацію між пристроями; інтернет усе одно потрібен. Мережевий service worker не створює офлайн-кеш приватних історій, медіа чи відповідей API; описане вище сховище браузера залишається. Створений вручну приклад не надсилає запитів на створення історій ШІ й не зберігає проходження. Англійська версія використовує попередньо записані загальнодоступні аудіофайли Google WaveNet; перекладені версії використовують лише мовлення браузера або пристрою. Текст прикладу не надсилається до хмарного перетворення тексту на мовлення Muse.'
        ] },
        retention: { heading: 'Серверні історії, строк дії та видалення', paragraphs: [
          'Особисті подорожі й спільні історії, включно зі збереженим прогресом, медіа подарунків, голосовими повідомленнями та підготовленими записами, зберігаються на сервері Muse до видалення й не мають автоматичного строку завершення. Видалення запису з бібліотеки браузера не видаляє серверну історію. Користуйтеся приватним керуванням спільною історією або кнопкою Delete story внизу «Моя історія». Безстрокове розміщення не гарантується. Резервні копії, якщо є, можуть зберігати дані окремо; це повідомлення не гарантує налаштування, охоплення чи відновлення з резервних копій.',
          'Автори можуть видалити спільну історію з приватної сторінки керування: посилання буде вимкнено, а пов’язані медіа поставлено в чергу на видалення. Після підтвердження й перевірки права автора Delete story внизу «Моя історія» назавжди видаляє особисту подорож і прогрес із сервера та цього браузера. Застарілі дані лише в браузері видаляються локально. Видалення запису бібліотеки не видаляє серверні дані. Раніше видані приватні підписані URL медіа можуть працювати до завершення строку, до 10 хвилин після видалення або ротації посилання. Окремі резервні копії можуть містити видалені записи й медіа.'
        ] },
        media: { heading: 'Фото, відео та мовлення', paragraphs: [
          'Фото й відео спільних історій зберігаються приватно й не надсилаються постачальнику ШІ. Розкритий файл доступний після правильної відповіді або підтвердженого отримувачем пропуску, якщо автор це дозволив. Пропуск фіксується окремо від розгадування й не розкриває таємну відповідь. Видалення історії ставить медіа в чергу на очищення; резервні копії сховища можуть бути окремими.',
          'Диктування використовує розпізнавання мовлення браузера або пристрою та може надсилати аудіо до онлайн-сервісу. Перевірте транскрипт перед надсиланням. Озвучення в браузері може оброблятися локально; якщо розгортання вмикає онлайн-постачальника, він може обробляти надісланий текст.',
          'Хмарна озвучка надсилає вибраний текст Google Cloud Text-to-Speech або ElevenLabs, зазначеному в Аудіо. Нові облікові записи використовують дозвіл із реєстрації; наявні зберігають окрему згоду. Google потребує облікових даних і ліміту символів. Підготовлене аудіо подарунка надсилає лише назву, текст і підказку сцени, без приватних відповідей, розкриття чи живих ходів ШІ. Записи кешуються приватно; відтворення не надсилає текст повторно. Потрібен дозволений доступ до історії. Видалення не відкликає вже завантажене чи збережене аудіо. Помилки не запускають непомітно голос пристрою.',
          'Озвучення Google також використовує окремий приватний дедуплікований аудіокеш із хешованими метаданими пошуку замість відкритого тексту. Аудіо кешу зберігається до 30 днів; очищення запускають запити, регулярність не гарантується. Видалення історії вимикає доступ до пов’язаного з нею аудіо, але не видаляє одразу окрему кешовану копію; вона зберігається до очищення. Резерви бюджету зберігаються окремо без відкритого тексту історії; невдалий або перерваний синтез може використати бюджет. Резервні копії можуть окремо містити аудіо.',
          'Необов’язкове особисте голосове повідомлення — це запис, а не диктування чи клонування голосу. Запис починається лише після згоди й дозволу на мікрофон. WAV залишається на сторінці до завантаження, потім зберігається приватно з історією та відкривається лише з фінальним розкриттям. Голосові файли не надсилаються ШІ. Запис і завантаження обмежені 60 секундами та 5 МБ. Видалення історії ставить запис у чергу на видалення.'
        ] },
        gifts: { heading: 'Подарунки та відповіді', paragraphs: [
          'Завершені особисті історії можна перечитувати без змін. Експорт історії у PDF більше не доступний. Видалення історії онлайн не відкликає раніше збережені чи надруковані копії.',
          'Романтика необов’язкова, для дорослих і без відвертих сцен. Стиль зберігається з історією й надсилається ШІ для створення та продовження. Нові акаунти використовують необов’язковий дорослий дозвіл із реєстрації; наявні акаунти й гості підтверджують вік і згоду в кожному процесі. Отримувачі вибирають відкриття після повідомлення про вміст. Самостійна заява не перевіряє вік, особу чи вміст відправника. Не додавайте чутливу сексуальну інформацію й не зображайте реальних людей без дозволу.',
          'Обкладинка подарунка й присвята видимі всім, хто має посилання отримувача, ще до розгадування. Не розміщуйте на обкладинці таємні відповіді чи фінальний сюрприз. Попередній перегляд посилань показує загальну інформацію Muse, а не приватний текст історії.',
          'Якщо автор увімкнув відповіді, отримувачі можуть надіслати письмове повідомлення після розкриття сюрпризу. Відповіді приватно зберігаються з історією до її завершення або видалення та доступні на захищеній сторінці керування автора. Вони не надсилаються ШІ. Muse не перевіряє особу отримувача й не надає сповіщень про прочитання. Відповідь можна замінити в тому самому проходженні; очищення сховища браузера може позбавити доступу.',
          'Друкована картка містить приватне посилання отримувача як QR і адресу та необов’язкове привітання, видиме до повідомлення про вміст. QR створюється на пристрої. Кожен із копією може відкрити чинне посилання. Видалення, завершення строку чи заміна посилання анулюють картку; друк не зберігає онлайн-історію.'
        ] },
        operations: { heading: 'Операційна безпека та звіти про помилки', paragraphs: [
          'Muse не записує перегляди сторінок чи відвідування сайту та не використовує сторонню аналітику. Для роботи сервісу фіксуються коди подій із часовими мітками, зокрема створення історій, збої постачальників і попередження про безпекові обмеження. Записи не містять тексту історій, URL сторінок, посилань доступу чи необроблених IP-адрес; вони дедуплікуються щохвилини й зберігаються до семи днів. Обмеження запитів окремо використовують короткочасні хеші на основі IP: із ключем у виробничому середовищі та звичайні в локальній розробці. Ключі лічильників містять похідний хеш, а не IP. Ліміти: до 120 загальних запитів за хвилину, 20 невдалих спроб коду автора за 10 хвилин і 5 звітів про помилки за хвилину.',
          'Операційні події відображаються в приватній панелі й журналах сервера. Зовнішню службу сповіщень не налаштовано, тому оператор може не отримати повідомлення про подію. Журнали хостингової платформи можуть зберігатися окремо.'
        ] },
        cookies: { heading: 'Файли cookie й аналітика', paragraphs: [
          'Наразі Muse не використовує сторонні SDK аналітики чи реклами, тому банер аналітичних файлів cookie не налаштовано. Це не охоплює файли cookie чи обробку даних постачальниками хостингу, сховища та іншої інфраструктури.'
        ] },
        contacts: { heading: 'Оператор і контакти', paragraphs: [] }
      },
      operatorLabel: 'Оператор', supportLabel: 'Контакт підтримки',
      notReady: 'Не запускайте публічну бета-версію, доки не налаштовано обидва контакти й не завершено юридичну перевірку інформації про конфіденційність і умов продукту.'
    },
    terms: {
      title: 'Умови', documentTitle: 'Muse — Умови', description: 'Чернетка умов продукту для використання бета-версії історій Muse.',
      sections: {
        status: { heading: 'Статус чернетки', paragraphs: ['Чернетка умов продукту для прототипу. Це не юридичне схвалення й не сертифікована юридична угода. Muse — прототип публічної бета-версії; його не можна публічно запускати, доки не налаштовано оператора й контакти підтримки та не перевірено ці умови.'] },
        use: { heading: 'Використання Muse', paragraphs: [
          'Muse допомагає створювати інтерактивні історії. Матеріали, створені ШІ, можуть бути неточними, неповними або неприйнятними; перевіряйте їх і покладайтеся на власне судження. Muse не надає професійних, медичних, терапевтичних чи екстрених порад.',
          'Надсилайте лише матеріали, на використання яких маєте право й дозвіл на поширення. Не надсилайте чутливі персональні дані чи конфіденційну інформацію іншої людини. Ви відповідаєте за надані тексти, медіа та приватні посилання, які створюєте чи поширюєте, зокрема за вибір отримувачів.'
        ] },
        romance: { heading: 'Необов’язкова романтика', paragraphs: [
          'Романтичні теми Sweet і Spicy не є відвертими та призначені для дорослих від 18 років і повнолітніх персонажів за згодою. Інтимність завершується затемненням. Не використовуйте Muse для відвертого сексуального вмісту, сексуального вмісту за участю неповнолітніх, примусу або сексуалізованого зображення реальних людей без їхнього дозволу. Не завантажуйте відверті фото, відео чи записи. Перевірте історію та вкладення перед надсиланням.',
          'У позначених спільних романтичних історіях отримувачі мають вибрати, чи відкривати їх, перш ніж отримати обкладинку, історію або медіа. Вони можуть відмовитися. Вік і згода декларуються самостійно й незалежно не перевіряються; відкриття не означає схвалення вмісту відправника. Інструкції ШІ та це повідомлення не є повною модерацією й не гарантують належності поданих чи згенерованих матеріалів.'
        ] },
        storage: { heading: 'Зберігання та видалення', paragraphs: [
          'Для створення й керування серверними історіями потрібно ввійти в обліковий запис Muse. Автори мають доступ лише до історій, призначених їхньому обліковому запису. Отримувачі можуть відкрити приватне посилання подарункової історії без входу. Незатребувані застарілі подарункові історії не призначаються обліковим записам автоматично; автор може заявити права, надавши наявне приватне посилання власника. Застарілі особисті історії та дані лише з браузера автоматично не переносяться.',
          'Серверні історії не мають автоматичного строку завершення й залишаються до видалення; безстроковий хостинг не гарантується. Резервні копії, якщо вони є, зберігаються окремо; конфігурація, охоплення й відновлення не гарантуються. Повне резервне копіювання чи відновлення медіа не гарантується. Видалення спільної історії зі сторінки керування вимикає її посилання та надруковані QR-коди. Щоб видалити особисту подорож, використайте Delete story внизу «Моя історія»; видалення лише запису бібліотеки браузера не видаляє серверну копію. Використані спроби не повертаються.',
          'Спільні медіа приватні й не надсилаються ШІ. На вміст, надісланий налаштованому постачальнику ШІ чи мовлення, поширюються його умови обробки та інформація про конфіденційність Muse.',
          'Озвучення й друк карток залежать від браузера. Studio охоплює лише підготовлені сцени й потребує налаштування та дозволу на обробку: збереженого під час реєстрації для нових акаунтів, окремого для наявних. Доступність не гарантується. QR поширює посилання, не зберігає історію; видалення, завершення строку чи заміна анулюють його. Раніше збережені чи надруковані копії відкликати неможливо.'
        ] },
        operations: { heading: 'Операційні засоби контролю', paragraphs: [
          'Muse не збирає аналітику переглядів сторінок чи відвідувань сайту. Для сервісу записуються фіксовані коди подій, зокрема створення історій і збої безпеки чи постачальників, із часовими мітками; записи дедуплікуються щохвилини та зберігаються до семи днів. Вони не містять тексту історій, URL, посилань доступу чи необроблених IP. Обмеження запитів використовують короткочасні похідні від IP хеші (із ключем у виробництві, звичайні в локальній розробці). Журнали хостингу можуть мати окремий строк зберігання. Проактивні зовнішні сповіщення для операційного стану й журналів сервера не налаштовані.'
        ] },
        availability: { heading: 'Доступність', paragraphs: [
          'Прототип може змінюватися, бути недоступним або не зберегти дані. Зберігайте власні копії важливого. Не покладайтеся на Muse як на безпечний архів.'
        ] },
        contacts: { heading: 'Оператор і контакти', paragraphs: [] }
      },
      operatorLabel: 'Оператор', supportLabel: 'Контакт підтримки'
    },
    support: {
      title: 'Підтримка', documentTitle: 'Muse — Підтримка', description: 'Стан підтримки та контактів Muse.',
      intro: 'Muse — прототип, що готується до публічної бета-версії. Підтримка ще не укомплектована й недоступна.',
      contactsHeading: 'Стан контактів', operatorLabel: 'Оператор', supportLabel: 'Електронна пошта підтримки',
      configured: 'Налаштовано', missing: 'Не налаштовано', invalid: 'Не налаштовано (неприпустиме значення)',
      emailAction: 'Написати до підтримки', noAddress: 'Адреса підтримки недоступна; її не вигадували й не підміняли.',
      warning: 'Не надсилайте приватні посилання на історії, коди автора, паролі чи чутливі персональні дані неперевіреним контактам. Публічна бета-версія не готова, доки не налаштовано оператора й електронну пошту підтримки та не завершено юридичну перевірку.'
    }
  },
  'ar-SA': {
    eyebrow: 'المساعدة والمعلومات',
    privacy: {
      title: 'الخصوصية', documentTitle: 'Muse — الخصوصية', description: 'كيف يتعامل Muse مع مدخلات القصص وذكريات المتصفح والقصص المشتركة والوسائط.',
      intro: 'مسودة معلومات الخصوصية للمنتج. لم تتم الموافقة على إطلاق نموذج Muse الأولي للنسخة التجريبية العامة. قبل الإطلاق، تحقق من بيانات المشغّل وجهة اتصال الدعم وأكمل المراجعة القانونية.',
      sections: {
        ai: { heading: 'ما يُرسل إلى الذكاء الاصطناعي', paragraphs: [
          'توافق الحسابات الجديدة عند التسجيل صراحةً على إذن واحد لذكاء القصص والذكريات المختارة وملخصات المشاركة والسرد السحابي والإملاء والرسائل الصوتية المحفوظة. إذن رومانسية البالغين منفصل واختياري. يُحفظ الإذنان في الحساب ويمكن إلغاؤهما في الإعدادات؛ ولا تبدأ الموافقة تسجيلاً أو إجراءً مدفوعاً. يبقى الميكروفون بحاجة لإذن المتصفح. تحتفظ الحسابات الحالية والضيوف بفحوص الموافقة السابقة لكل ميزة.',
          'عند إنشاء قصة بالذكاء الاصطناعي أو متابعتها، يرسل Muse النص الذي تقدمه إلى مزود الذكاء الاصطناعي المُعدّ لهذا النشر. يرسل «قصتي» احتياجك وخيارات القصة والردود الجديدة؛ وتتضمن القصص الشخصية الجديدة افتراضياً أحدث خمس ذكريات في المتصفح. يمكنك استبعادها أثناء الإنشاء، ويلزم الحصول على موافقة صريحة قبل إرسالها. لا يؤدي حفظ التفاصيل الشخصية في «نفسي» إلى إرسالها إلى مزود الذكاء الاصطناعي للقصص. قد يتضمن موجز القصة المشتركة الأسماء والمكان والهدف والتلميحات الشخصية والسر والإجابات البديلة وتعليمات السرد والرسالة المكتوبة النهائية. كما تُرسل الإجراءات المباشرة في اللعب المشترك لإنشاء الأدوار بالذكاء الاصطناعي. قد يعالج المزود المُعدّ المعلومات وفق شروطه. لا ترسل معلومات حساسة أو تفاصيل خاصة عن الآخرين.',
          'يُحفظ التذكّر في «نفسي» في هذا المتصفح فقط ولا يُرسل إلى الذكاء الاصطناعي. تُرسل التخمينات المشتركة إلى Muse لمقارنتها بإجابة المنشئ، لا إلى الذكاء الاصطناعي. لا تستدعي التلميحات والتخطي المؤكد وإجراءات المكتبة الذكاء الاصطناعي.'
        ] },
        browser: { heading: 'تخزين المتصفح والحسابات', paragraphs: [
          'تستخدم حسابات Muse تسجيل الدخول بالبريد الإلكتروني وكلمة المرور عبر Supabase Auth. يلزم حساب لإنشاء قصص الخادم أو إدارتها. يمكن لمستلمي الهدايا فتح رابط خاص بلا حساب؛ وفي القصص التعاونية ينضم أعضاء Muse بحساب وينضم الضيوف بالرابط الخاص واسم عرض يختارونه. ترتبط قصص الهدايا والرحلات الشخصية على الخادم بالحساب المسجل؛ ويتيح تسجيل الدخول على جهاز آخر استعادة قصص الحساب. لا تتم مزامنة القصص القديمة والذكريات والتفضيلات والمسودات والإجابات غير المرسلة المخزنة في المتصفح وحده مع الحساب. المعلومات المخزنة في المتصفح نص مقروء غير مشفر؛ وقد يتمكن من يصل إلى ملف المتصفح أو تخزينه من قراءتها. لا تؤدي استعادة المسودة إلى إرسال معلومات للذكاء الاصطناعي أو إنشاء قصة.',
          'يمكنك تعديل الذكريات أو نسيانها في «نفسي» وإزالة عنصر من مكتبة القصص. تؤثر هذه الإجراءات في هذا المتصفح فقط؛ ولا تمحو قصة أُنشئت بالفعل أو تلغي صلاحية الوصول إليها على الخادم أو تزيل معلومات سبق إرسالها إلى مزود ذكاء اصطناعي.',
          'لا يستطيع المنشئون المسجلون عرض قصص حسابهم وإدارتها إلا إذا كانت مملوكة له. يتحقق الخادم من رمز وصول Supabase ويفحص الملكية لإجراءات المنشئ. يمكن لمن يملك رابط المالك الخاص القديم المطالبة بقصة هدية قديمة غير مخصصة؛ ولا تُسند القصص القديمة تلقائياً إلى أول حساب يسجل الدخول. تظل روابط المستلمين بلا حساب. لا تستعيد استعادة الحساب القصص المحذوفة أو البيانات المحفوظة في المتصفح وحده. ويتطلب استرداد الرحلة الشخصية تسجيل الدخول أيضاً.',
          'يُخزن تقدم اللعب المشترك على الخادم باستخدام رمز قدرة عشوائي لجلسة المتصفح (مُجزّأ على الخادم)، ويشمل المشهد والتلميحات ومحاولات التخمين وما إذا كان الكشف قد حُل أو تم تخطيه. يستأنف الرابط نفسه في المتصفح نفسه اللعب ما دام الرابط وتخزين المتصفح متاحين. يمكن للمرسل تحديث إجماليات خاصة للمرات المفتوحة وغير المكتملة والمحلولة والمتخطاة، إضافة إلى أبعد مشهد مُعد أو أكبر عدد من المشاهد المباشرة التي تم إنشاؤها بنجاح في جولة. يُحتسب فتح الرابط بدايةً حتى قبل فتح غلاف الهدية؛ وقد يُحتسب مجدداً استخدام متصفح آخر أو مسح التخزين. تشمل الأعداد روابط المستلمين السابقة للقصة نفسها. لا تثبت هوية المستلم أو القراءة، وليست موجز نشاط مباشر. لا يعرض الملخص معرّفات الجلسات أو الإجابات المكتوبة أو سجل التصفح، ولا يُرسل التقدم إلى الذكاء الاصطناعي. يُحتفظ بالتقدم مع القصة حتى انتهاء صلاحيتها أو حذفها.',
          'في قصص الهدايا التعاونية، يشارك الجميع المغامرة المباشرة نفسها. يمكن للمجموعة رؤية أسماء العرض وصاحب الدور والتقدم المشترك؛ ويستخدم الأعضاء اسم ملف Muse ويختار الضيوف اسماً. تتناوب الأدوار حسب ترتيب الانضمام، ولا يمكن التصرف أو التخطي إلا للمشارك النشط. ترتبط هوية الضيف برمز جلسة متصفح عشوائي مرتبط برابط المستلم الخاص، وليست هوية حقيقية موثقة؛ وقد يؤدي مسح التخزين إلى عودة الضيف كمشارك جديد. الإجراءات جزء من القصة المشتركة وقد تُرسل إلى مزود الذكاء الاصطناعي المُعدّ. يملك حساب المنشئ القصة وحصة التفاعل المباشر.',
          'يمكن للمنشئين تشغيل إشعارات تقدم القصص المشتركة داخل التطبيق أو إيقافها في الإعدادات. عند تشغيلها، وبينما يكون Muse مفتوحاً والمنشئ مسجلاً، يتحقق Muse دورياً من إجماليات الفتح الأول ومراحل التقدم والإكمال. يُخزن التفضيل ولقطات التقدم التي جرى التحقق منها أخيراً في ذلك المتصفح ولا تتم مزامنتهما. هذه ليست رسائل بريد إلكتروني أو إشعارات دفع للمتصفح.',
          'تضيف إضافة Muse إلى الشاشة الرئيسية اختصاراً شبيهاً بالتطبيق، لا حساباً أو مزامنة بين الأجهزة؛ ويظل الإنترنت مطلوباً. لا ينشئ عامل الخدمة الذي يعمل عبر الشبكة فقط ذاكرة مؤقتة دون اتصال للقصص الخاصة أو الوسائط أو استجابات API؛ ويظل تخزين المتصفح المذكور أعلاه سارياً. لا يرسل النموذج اليدوي طلبات إنشاء قصص بالذكاء الاصطناعي ولا يحفظ جولات اللعب. تستخدم النسخة الإنجليزية ملفات صوتية عامة مسجلة مسبقاً من Google WaveNet؛ أما النسخ المترجمة فتستخدم كلام المتصفح أو الجهاز فقط. لا يُرسل نص القصة التجريبية إلى خدمة تحويل النص إلى كلام السحابية من Muse.'
        ] },
        retention: { heading: 'قصص الخادم والانتهاء والحذف', paragraphs: [
          'تُحفظ الرحلات الشخصية والقصص المشتركة، بما فيها التقدم المحفوظ ووسائط الهدايا والرسائل الصوتية والتسجيلات المعدة، على خادم Muse حتى حذفها ولا تنتهي تلقائياً. لا يؤدي حذف عنصر من مكتبة المتصفح إلى حذف قصة الخادم. استخدم أدوات الإدارة الخاصة للقصة المشتركة أو «حذف القصة» أسفل «قصتي». لا نضمن استمرار الاستضافة إلى الأبد. قد تحتفظ النسخ الاحتياطية، إن وجدت، بالبيانات لفترة منفصلة؛ ولا تضمن هذه الإشعارات إعداد النسخ الاحتياطية أو تغطيتها أو إمكانية الاستعادة.',
          'يمكن للمنشئين حذف القصة المشتركة من صفحة إدارتها الخاصة، ما يعطل روابطها ويضع الوسائط المرتبطة في قائمة الحذف. بعد التأكيد والتحقق من صلاحية المنشئ، يحذف خيار «حذف القصة» أسفل «قصتي» الرحلة الشخصية وتقدمها نهائياً من الخادم وهذا المتصفح. تُحذف القصص القديمة المحفوظة في المتصفح محلياً. إزالة عنصر المكتبة وحدها ليست حذفاً من الخادم. قد تظل عناوين URL الخاصة الموقعة الصادرة سابقاً صالحة حتى انتهاء صلاحيتها، لمدة تصل إلى 10 دقائق بعد الحذف أو تدوير الرابط. قد تبقى السجلات والوسائط المحذوفة في نسخ احتياطية مستقلة.'
        ] },
        media: { heading: 'الصور والفيديو والكلام', paragraphs: [
          'تُخزن صور وفيديوهات القصص المشتركة بشكل خاص ولا تُرسل إلى مزود الذكاء الاصطناعي. يتاح الملف المكشوف بعد إجابة صحيحة أو بعد تأكيد المستلم التخطي إذا سمح المنشئ بذلك. يُسجل التخطي منفصلاً عن الحل ولا يكشف الإجابة السرية. يؤدي حذف القصة إلى وضع الوسائط في قائمة التنظيف؛ وقد تكون النسخ الاحتياطية للتخزين منفصلة.',
          'يستخدم الإملاء التعرّف على الكلام الذي يوفره المتصفح أو الجهاز وقد يرسل الصوت إلى خدمة كلام عبر الإنترنت. راجع النص المحوّل قبل إرساله. قد تتم معالجة السرد في المتصفح محلياً؛ وإذا أُتيح مزود سرد عبر الإنترنت لهذا النشر، فقد يعالج النص المرسل.',
          'يرسل السرد السحابي النص المختار إلى Google Cloud Text-to-Speech أو ElevenLabs المحدد في الصوت. تستخدم الحسابات الجديدة إذن التسجيل المحفوظ؛ وتحتفظ الحالية بموافقة منفصلة. يتطلب Google بيانات اعتماد وميزانية أحرف. يرسل صوت الهدية المُعدّ عنوان المشهد ونصه والتلميح فقط، دون الإجابات الخاصة أو الكشف أو أدوار الذكاء المباشرة. تُخزن التسجيلات بشكل خاص؛ ولا يعيد تشغيلها إرسال النص. يلزم وصول مصرح إلى القصة. لا يلغي الحذف صوتاً محملاً أو محفوظاً سابقاً. لا تشغل الأخطاء صوت الجهاز بصمت.',
          'يستخدم سرد Google أيضاً ذاكرة صوتية مؤقتة خاصة ومزالة التكرار، مع بيانات بحث مجزأة بدلاً من مدخلات السرد النصية الواضحة. يُحتفظ بالصوت المخزن حتى 30 يوماً؛ ويبدأ التنظيف عند الطلبات ولا يوجد ضمان لجدول تنظيف منتظم. يؤدي حذف القصة إلى تعطيل الوصول إلى صوتها المحدد لكنه لا يمحو فوراً نسخة مخزنة منفصلة، إذ تبقى حتى التنظيف. تُحتفظ بحجوزات الميزانية بشكل مستقل دون نص القصة الواضح؛ وقد يستهلك التوليد الفاشل أو المتوقف الميزانية. قد تحتفظ النسخ الاحتياطية بالصوت بشكل منفصل.',
          'الرسالة الصوتية الشخصية الاختيارية تسجيل وليست إملاءً أو استنساخاً للصوت. لا يبدأ التسجيل إلا بعد موافقتك ومنح إذن الميكروفون. يبقى ملف WAV في هذه الصفحة حتى تحميله، ثم يُحفظ بشكل خاص مع القصة ولا يُفتح إلا مع الكشف النهائي. لا تُرسل الملفات الصوتية إلى الذكاء الاصطناعي. يقتصر التسجيل والتحميل على 60 ثانية و5 ميغابايت. يؤدي حذف القصة إلى وضع التسجيل المحفوظ في قائمة الحذف.'
        ] },
        gifts: { heading: 'الهدايا والردود', paragraphs: [
          'تتيح القصص الشخصية المكتملة إعادة القراءة فقط. لم يعد تصدير القصة إلى PDF متاحًا. لا يلغي حذف القصة عبر الإنترنت النسخ المحفوظة أو المطبوعة سابقًا.',
          'الرومانسية اختيارية للبالغين وغير صريحة. يُحفظ نمطها مع القصة ويُرسل للذكاء الاصطناعي للإنشاء والمتابعة. تستخدم الحسابات الجديدة إذن البالغين الاختياري من التسجيل؛ تؤكد الحسابات الحالية والضيوف البلوغ والموافقة في كل مسار. يختار المستلمون الفتح بعد إشعار المحتوى. لا يتحقق التصريح الذاتي من العمر أو الهوية أو محتوى المرسل. لا تتضمن معلومات جنسية حساسة ولا تصوّر أشخاصًا حقيقيين دون إذن.',
          'يظهر غلاف الهدية والإهداء لكل من لديه رابط المستلم قبل الحل. لا تضع الإجابات السرية أو المفاجأة النهائية على الغلاف. تعرض معاينات الروابط معلومات Muse العامة لا نص القصة الخاصة.',
          'عندما يفعّل المنشئ الردود، يمكن للمستلمين إرسال رسالة مكتوبة بعد كشف المفاجأة. تُخزن الردود بشكل خاص مع القصة حتى انتهاء صلاحيتها أو حذفها، ويمكن عرضها عبر صفحة إدارة المنشئ المحمية. لا تُرسل إلى الذكاء الاصطناعي. لا يتحقق Muse من هوية المستلمين ولا يوفر إيصالات قراءة. يمكن استبدال الرد من جولة اللعب نفسها؛ وقد يؤدي مسح تخزين المتصفح إلى فقدان الوصول.',
          'تحتوي بطاقة الهدية المطبوعة على رابط المستلم الخاص كرمز QR وعنوان، مع تحية اختيارية تظهر قبل إشعار المحتوى. يُنشأ QR على جهازك. يمكن لأي شخص يحمل نسخة فتح الرابط الصالح. يبطل الحذف أو انتهاء الصلاحية أو استبدال الرابط البطاقة؛ ولا تحفظ الطباعة القصة عبر الإنترنت.'
        ] },
        operations: { heading: 'الأمان التشغيلي والإبلاغ عن الأخطاء', paragraphs: [
          'لا يسجل Muse مشاهدات الصفحات أو زيارات الموقع ولا يستخدم تحليلات جهات خارجية. لأغراض التشغيل، يسجل رموز أحداث ثابتة مع طوابع زمنية، مثل إنشاء القصص وأعطال المزود وتحذيرات حدود السلامة. لا تتضمن السجلات نص القصة أو عناوين الصفحات أو روابط الصلاحية أو عناوين IP الخام؛ وتُزال الازدواجية كل دقيقة وتُحتفظ بها حتى سبعة أيام. تستخدم حدود الطلبات بشكل منفصل تجزئات قصيرة الأجل مشتقة من IP: تجزئة بمفتاح في الإنتاج وعادية في التطوير المحلي. تحتوي مفاتيح العد على التجزئة المشتقة لا عنوان IP الخام. تشمل الحدود حتى 120 طلباً عاماً في الدقيقة و20 محاولة فاشلة لرمز المنشئ كل 10 دقائق و5 طلبات للإبلاغ عن الأخطاء في الدقيقة.',
          'تظهر الأحداث التشغيلية في لوحة العمليات الخاصة وسجلات الخادم. لم تُعدّ خدمة إشعارات خارجية، لذلك قد لا يُخطر المشغلون عند وقوع حدث. قد تكون لسجلات منصة الاستضافة مدة احتفاظ منفصلة.'
        ] },
        cookies: { heading: 'ملفات تعريف الارتباط والتحليلات', paragraphs: [
          'لا يستخدم Muse حالياً أدوات SDK للتحليلات أو الإعلانات من جهات خارجية، لذلك لم يُعدّ شريط موافقة لملفات تعريف الارتباط التحليلية. ولا يشمل ذلك ملفات تعريف الارتباط أو المعالجة لدى مزودي الاستضافة والتخزين والبنية التحتية الأخرى.'
        ] },
        contacts: { heading: 'المشغل وجهة الاتصال', paragraphs: [] }
      },
      operatorLabel: 'المشغل', supportLabel: 'جهة اتصال الدعم',
      notReady: 'لا تطلق النسخة التجريبية العامة قبل إعداد جهتي الاتصال وإتمام المراجعة القانونية لمعلومات الخصوصية وشروط المنتج.'
    },
    terms: {
      title: 'الشروط', documentTitle: 'Muse — الشروط', description: 'مسودة شروط المنتج لاستخدام النسخة التجريبية للقصص في Muse.',
      sections: {
        status: { heading: 'حالة المسودة', paragraphs: ['مسودة شروط منتج لنموذج أولي. هذه ليست موافقة قانونية أو اتفاقية قانونية معتمدة. Muse نموذج أولي لنسخة تجريبية عامة، ويجب ألا يُطلق للعامة قبل إعداد المشغل وجهات اتصال الدعم ومراجعة هذه الشروط.'] },
        use: { heading: 'استخدام Muse', paragraphs: [
          'يساعد Muse على إنشاء قصص تفاعلية. قد تكون المواد التي ينشئها الذكاء الاصطناعي غير دقيقة أو غير مكتملة أو غير مناسبة؛ راجعها واستخدم تقديرك. لا يقدم Muse نصائح مهنية أو طبية أو علاجية أو طارئة.',
          'لا ترسل إلا مواد يحق لك استخدامها ولديك إذن بمشاركتها. لا ترسل معلومات شخصية حساسة أو معلومات سرية عن شخص آخر. أنت مسؤول عن النصوص والوسائط التي تقدمها والروابط الخاصة التي تنشئها أو تشاركها، بما في ذلك اختيار مستلمي الرابط.'
        ] },
        romance: { heading: 'الرومانسية الاختيارية', paragraphs: [
          'موضوعا Sweet وSpicy الرومانسيان غير صريحين ومخصصان للبالغين بعمر 18 عاماً أو أكثر ولشخصيات بالغة موافقة. تنتهي الحميمية بتلاشي المشهد. لا تستخدم Muse للمحتوى الجنسي الصريح أو المحتوى الجنسي الذي يشمل قاصرين أو الإكراه أو تصوير أشخاص حقيقيين بطريقة جنسية دون إذنهم. لا ترفع صوراً أو مقاطع فيديو أو تسجيلات صريحة. راجع القصة ومرفقاتها قبل الإرسال.',
          'في القصص الرومانسية المشتركة الموسومة، يختار المستلمون الفتح قبل تلقي الغلاف أو القصة أو الوسائط، ويمكنهم الرفض. العمر والموافقة إقرار ذاتي ولا يتم التحقق منهما بشكل مستقل؛ واختيار الفتح لا يعني تأييد محتوى المرسل. تعليمات الذكاء الاصطناعي وهذا الإشعار ليسا إشرافاً كاملاً ولا يضمنان ملاءمة ما يقدمه المستخدمون أو ما يتم إنشاؤه.'
        ] },
        storage: { heading: 'التخزين والحذف', paragraphs: [
          'يتطلب إنشاء قصص الخادم وإدارتها تسجيل الدخول إلى حساب Muse. لا يمكن للمنشئين الوصول إلا إلى القصص المسندة إلى حساباتهم. يمكن للمستلمين فتح رابط هدية خاص دون تسجيل الدخول. لا تُسند قصص الهدايا القديمة غير المطالب بها تلقائياً إلى الحسابات؛ ويمكن للمنشئ المطالبة بها عبر تقديم رابط المالك الخاص الموجود. لا تُنقل القصص الشخصية القديمة والبيانات المخزنة في المتصفح وحده تلقائياً إلى الحساب.',
          'لا تنتهي قصص الخادم تلقائياً وتبقى حتى حذفها؛ ولا نضمن استمرار الاستضافة إلى الأبد. تُحتفظ النسخ الاحتياطية، إن وجدت، بشكل مستقل؛ ولا نضمن إعدادها أو تغطيتها أو استعادتها. لا نضمن نسخة احتياطية كاملة أو استعادة الوسائط. يؤدي حذف قصة مشتركة من صفحة إدارتها إلى تعطيل روابطها ورموز QR المطبوعة. استخدم «حذف القصة» أسفل «قصتي» لحذف رحلة شخصية؛ إزالة عنصر مكتبة المتصفح وحده لا تحذف نسخته على الخادم. لا تُرد المحاولات المستخدمة.',
          'الوسائط المشتركة خاصة ولا تُرسل إلى الذكاء الاصطناعي. يخضع المحتوى المرسل إلى مزود الذكاء الاصطناعي أو الكلام المُعدّ لشروط معالجة ذلك المزود بالإضافة إلى معلومات الخصوصية في Muse.',
          'يختلف السرد وطباعة البطاقات حسب المتصفح. يغطي Studio المشاهد المعدة فقط ويتطلب إعداد المشغل وإذن المعالجة: المحفوظ عند تسجيل الحسابات الجديدة، والمنفصل للحالية. لا نضمن التوفر. يشارك QR رابطًا لا تخزينًا دائمًا؛ يبطله الحذف أو الانتهاء أو الاستبدال. لا يمكن إلغاء النسخ المحفوظة أو المطبوعة سابقًا.'
        ] },
        operations: { heading: 'الضوابط التشغيلية', paragraphs: [
          'لا يجمع Muse تحليلات مشاهدات الصفحات أو زيارات الموقع. لتشغيل الخدمة، يسجل رموز أحداث ثابتة مع طوابع زمنية، تشمل إنشاء القصص وأخطاء السلامة أو المزود؛ وتُزال الازدواجية كل دقيقة ويُحتفظ بها حتى سبعة أيام. لا تتضمن نص القصة أو عناوين الصفحات أو روابط الصلاحية أو عناوين IP الخام. تستخدم حدود الطلبات تجزئات قصيرة الأجل مشتقة من IP (بمفتاح في الإنتاج وعادية في التطوير المحلي). قد تحتفظ سجلات منصة الاستضافة بالبيانات لفترة منفصلة. لا توجد تنبيهات خارجية استباقية مُعدة لحالة العمليات وسجلات الخادم.'
        ] },
        availability: { heading: 'التوفر', paragraphs: [
          'قد يتغير هذا النموذج الأولي أو يصبح غير متاح أو يفشل في حفظ البيانات. احتفظ بنسخك من كل ما يهمك. لا تعتمد على Muse للتخزين الآمن طويل الأمد.'
        ] },
        contacts: { heading: 'المشغل وجهة الاتصال', paragraphs: [] }
      },
      operatorLabel: 'المشغل', supportLabel: 'جهة اتصال الدعم'
    },
    support: {
      title: 'الدعم', documentTitle: 'Muse — الدعم', description: 'حالة الدعم وجهات الاتصال في Muse.',
      intro: 'Muse نموذج أولي قيد الإعداد للنسخة التجريبية العامة. لم يتوفر فريق دعم بعد ولا توجد خدمة دعم حالياً.',
      contactsHeading: 'حالة الاتصال', operatorLabel: 'المشغل', supportLabel: 'بريد الدعم',
      configured: 'مُعدّ', missing: 'غير مُعدّ', invalid: 'غير مُعدّ (إعداد غير صالح)',
      emailAction: 'راسل الدعم', noAddress: 'لا يتوفر عنوان دعم؛ لم يتم اختراع عنوان أو استبداله.',
      warning: 'لا ترسل روابط قصص خاصة أو رموز منشئ أو كلمات مرور أو معلومات شخصية حساسة إلى جهة اتصال غير موثوقة. النسخة التجريبية العامة غير جاهزة حتى إعداد المشغل وبريد الدعم واكتمال المراجعة القانونية.'
    }
  }
} satisfies Record<StoryLanguageCode, PublicLegalCopy>

export function publicLegalCopy(language: StoryLanguageCode): PublicLegalCopy {
  return copies[language]
}

export function publicContactStatus(
  status: 'configured' | 'missing' | 'invalid',
  language: StoryLanguageCode
): string {
  const copy = copies[language].support
  return status === 'configured' ? copy.configured : status === 'invalid' ? copy.invalid : copy.missing
}
