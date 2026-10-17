import Head from 'next/head'
import LegalPage from '../components/LegalPage'
import { getPublicContactConfig } from '../lib/legalContact'

export default function PrivacyPage() {
  const contact = getPublicContactConfig(
    process.env.NEXT_PUBLIC_MUSE_OPERATOR_NAME,
    process.env.NEXT_PUBLIC_MUSE_SUPPORT_EMAIL
  )

  return (
    <>
      <Head>
        <title>Muse — Privacy</title>
        <meta name="description" content="How Muse handles story inputs, browser memories, shared stories and media." />
      </Head>
      <LegalPage title="Privacy">
        <p><strong>Draft product privacy information.</strong> Muse is a public beta prototype, not ready for public launch. The operator and support contact are not configured, and this information still needs legal review.</p>

        <h2>What goes to AI</h2>
        <p>When you create or continue an AI story, the text you submit is sent by Muse to the AI provider configured for this deployment. My Story sends your need, story choices and new responses; it sends your latest five browser memories only when you select that option. A shared-story brief can include names, setting, goal, personal hints, secret and alternative answers, narration instructions, and the final written message. Shared live actions are also sent for AI-generated turns. The configured provider may process information under its own terms. Do not submit sensitive information or private details about other people.</p>
        <p>Saving a memory in Myself only saves it in this browser; it does not send it to AI. Shared guesses are sent to Muse to check against the creator&apos;s answer, not to AI. Hints, confirmed skips and library actions do not make AI calls.</p>

        <h2>Browser storage and accounts</h2>
        <p>Muse has no user account or cloud profile. Memories, personal stories, the story library, written Shared Story drafts, and private story capabilities are stored in browser storage as readable, unencrypted text. Drafts can contain secret answers and final messages; they do not include attached files, recordings or consent. Anyone with access to this browser profile or its storage may be able to read them. Keep shared devices private and do not save information you would not want another browser user to see.</p>
        <p>You can edit or forget memories in Myself and remove a library entry in Story Library. These actions only change this browser; they do not erase an already generated story, revoke its server capability, or remove information already sent to an AI provider.</p>
        <p>Shared playthrough progress is stored on the server under a random browser session capability (hashed on the server), including scene, hints, guess attempts and whether a reveal was solved or skipped. Reopening the same link in the same browser resumes that playthrough while the link remains valid and browser storage remains available. This is not verified recipient identity. Creators are not shown recipient-status tracking or playthrough counts.</p>
        <p>Installing Muse on a home screen adds an app-like shortcut, not an account or cross-device sync. Internet is still needed. Its network-only service worker does not create an offline cache of private stories, media or API responses; existing browser storage described above still applies. The handcrafted sample makes no AI story-generation requests and saves no playthrough. Optional sample narration uses your browser or device speech service, never Muse&apos;s paid cloud narration endpoint.</p>

        <h2>Server stories, expiry and deletion</h2>
        <p>Personal journeys and shared stories are kept on Muse&apos;s server for up to 30 days. Expiry limits access, but physical expiry cleanup may run only when later service requests trigger cleanup; there is no scheduled-cleanup guarantee. Backups, if present, may independently retain data for a separate period. Backup configuration, coverage, and recoverability are not guaranteed by this notice.</p>
        <p>Creators can delete a shared story from its private management page; this disables its links and queues associated media for deletion. A personal journey can be permanently deleted from My Story; after the server confirms deletion, its entry and compatibility copy are removed from this browser. Removing a library entry alone is not server deletion. Previously issued private signed media URLs may remain usable until they expire, for up to 10 minutes after deletion or link rotation. Expired or deleted records and media may remain in separately retained backups.</p>

        <h2>Photos, video and speech</h2>
        <p>Shared-story photos and videos are stored privately and are not sent to the AI provider. A revealed file is available after a correct answer, or after the recipient confirms a skip when the creator has enabled it. Skipping is recorded separately from solving and does not disclose the secret answer. Deleting a story queues its media for cleanup; storage backups may be separate.</p>
        <p>Dictation uses speech recognition supplied by your browser or device and may send audio to an online speech service. Review the transcript before submitting it. Browser narration may be processed locally; if an online narration provider is enabled for a deployment, text sent to that provider may be processed there.</p>
        <p>Studio narration is optional and disabled until the operator configures credentials and an explicit budget. A creator must separately consent before sending a prepared scene&apos;s title, body and clue to ElevenLabs. Private answers, the final reveal and live AI turns are not included in Studio generation. Prepared recordings are cached privately with the story; loading or replaying them does not generate new audio or send text to ElevenLabs. Recipient access requires a valid story link and opened playthrough, including the romance acknowledgment when applicable. An audio file already loaded or saved on a device cannot be recalled by deleting the server story. Failure never silently switches to device speech.</p>
        <p>An optional personal voice message is a recording, not dictation or voice cloning. Recording starts only after your consent and microphone permission. The WAV recording is kept in this page until uploaded, then stored privately alongside the story and unlocked only with its final reveal. Voice files are not sent to AI. Recording or upload is limited to 60 seconds and 5 MB. Removing the story queues the stored recording for deletion.</p>

        <h2>Gifts, replies and keepsakes</h2>
        <p>Romance is an optional adult, non-explicit story setting. Its style is saved with the story and sent to the AI provider for generation and continuations. Creators confirm adult and consent boundaries. For tagged shared romance stories, recipients first see a generic content notice and must confirm they are 18 or older and choose to open before receiving story text or media. This acknowledgment is not saved for future visits; existing session storage still applies after opening. Self-declaration is not verified age or identity, does not notify the creator of your choice, and does not certify the sender&apos;s content. Do not include sensitive sexual information or portray other real people without permission.</p>
        <p>A gift cover and its dedication are visible to anyone with the recipient link before solving. Do not put secret answers or the final surprise on the cover. Link previews use generic Muse information rather than private story text.</p>
        <p>When a creator enables replies, recipients may choose to send a written message after revealing the surprise. Replies are stored privately with the story until expiry or deletion and can be viewed through the creator&apos;s protected management page. They are not sent to AI. Muse does not verify recipient identities or provide read receipts. A reply can be replaced from the same playthrough; clearing browser storage may lose that access.</p>
        <p>A keepsake uses your device&apos;s print or Save as PDF feature. It includes only the displayed story text and names, plus the dedication and the final written message if you explicitly include it. Private answers, capability links, replies and media are excluded. Keep downloaded or printed copies private; server deletion cannot revoke them. Disable your browser&apos;s print headers and footers if they include page addresses.</p>
        <p>A printable gift card is different from a keepsake: it contains the recipient capability link as a QR code and written address, plus an optional greeting visible before any online content notice. The QR is generated on your device, not by an external QR service. Anyone holding a copy can open the story while the link is valid. Expiry, deletion or replacing the recipient link invalidates the card; printing does not preserve the online story. A text keepsake survives expiry but is not a backup of interactive play, photos, video or voice recordings.</p>

        <h2>Operational security and error reporting</h2>
        <p>Muse uses IP-derived hashes for rate-limit windows: production counters use a keyed hash, while local development uses a plain hash. Counter keys contain the derived hash, not the raw IP address. Limits include up to 120 general requests per minute, 20 failed creator-code attempts per 10 minutes, and 5 error-report requests per minute. The application rate-limit store removes expired counter windows as they pass.</p>
        <p>Operational records contain fixed event codes and timestamps and are retained for up to seven days. A client render-failure report contains only the fixed <code>client-render-failure</code> event code; it does not include the exception, stack, URL, or page text. Reports are rate-limited and fail with an error if persistence is unavailable. Service error logs also use fixed event codes and timestamps; hosting infrastructure may have separate logging and retention practices.</p>
        <p>Operational status is available through a private status page and server logs. No external notification or proactive alert delivery is configured; operators may not be notified when an event occurs. Muse does not currently use third-party analytics or telemetry.</p>

        <h2>Cookies and analytics</h2>
        <p>Muse does not currently use analytics, so there is no analytics cookie banner. This statement does not cover cookies or processing performed by hosting, storage, or other infrastructure providers.</p>

        <h2>Operator and contact</h2>
        <p>Operator: {contact.operator.value || (contact.operator.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
        <p>Support contact: {contact.supportEmail.value || (contact.supportEmail.status === 'invalid' ? 'Not configured (invalid setting)' : 'Not configured')}.</p>
        <p>Public beta is not ready until both contacts are configured and the privacy and product terms receive legal review.</p>
      </LegalPage>
    </>
  )
}
