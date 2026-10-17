# Google WaveNet narration setup

Muse supports Google Cloud Text-to-Speech for personal-story narration and
sender-prepared story-gift scene recordings. It uses MP3 playback, not the
iPhone speech engine. No Google account is needed by recipients.

## 1. Create and protect your Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project for Muse and attach a billing account.
3. Enable the **Cloud Text-to-Speech API** in APIs & Services > Library.
4. In APIs & Services > Credentials, create a server API key. Restrict its API
   access to **Cloud Text-to-Speech API**. If your server has a fixed outgoing
   IP, restrict the key to that IP as well. Browser-referrer restrictions are
   not appropriate for this server-side integration.
5. Create a small billing budget and notification thresholds. Google billing
   alerts are **not a hard spending stop**. Set service quotas where appropriate.
6. Never send the key in chat, commit it, or give it a `NEXT_PUBLIC_` prefix.

Official references:
[authentication](https://cloud.google.com/text-to-speech/docs/authentication),
[Text-to-Speech API discovery](https://texttospeech.googleapis.com/$discovery/rest?version=v1),
[API key restrictions](https://cloud.google.com/api-keys/docs/add-restrictions-api-keys),
[pricing](https://cloud.google.com/text-to-speech/pricing).
Google's API discovery document supports API-key authentication; Muse sends the
key in the server-side `X-Goog-Api-Key` header, never in a public URL.

## 2. Configure Muse privately

### Existing Vercel + Supabase deployment

Keep the existing `STORY_STORAGE=supabase`, `NEXT_PUBLIC_SUPABASE_URL` and private
`SUPABASE_SERVICE_ROLE_KEY` settings. In the Supabase SQL editor, apply
`supabase/google-narration.sql`, then run `supabase/google-narration-smoke.sql`.
The application does not apply migrations automatically. These files add only
Muse-specific narration storage/accounting; do not replace another product's
tables or policies. The shared Google cache stores bounded audio directly in
private PostgreSQL rows, with no public audio URL or new storage bucket.

Prepared gift narration also needs the existing `supabase/shared-story-studio.sql`
migration and private media bucket configured by `supabase/shared-story-media.sql`.
Do not make any audio bucket public. Missing migrations fail explicitly before
Google generation.

Add these settings to your private `.env.local` for local use, or your server's
secret/environment configuration:

```dotenv
NEXT_PUBLIC_NARRATION_PROVIDER=google
GOOGLE_TTS_API_KEY=YOUR_RESTRICTED_SERVER_KEY
MUSE_GOOGLE_TTS_BUDGET_CHARACTERS=100000
MUSE_STUDIO_NARRATION_ENABLED=true
```

### Local persistent server

With `STORY_STORAGE=sqlite`, use Node.js 24 and durable private writable disk:

```dotenv
MUSE_GOOGLE_TTS_SQLITE_PATH=data/google-tts.sqlite
```

All requests must share the same durable budget store. Never use independent
local databases across servers or ephemeral serverless disk. Vercel must use
the hosted Supabase store, not local SQLite. Do not put the database in `public/`.

The 100,000-character cap is a **suggested initial limit**, not an automatically
authorized purchase. At a listed WaveNet rate of US$4/million characters, it
represents roughly US$0.40 in base generation, excluding taxes and other services.
Check current Google account pricing before enabling it. Leave the cap at `0`
to disable generation.

The cap is lifetime reserved characters across personal and prepared gift
narration, not per-user or monthly. Failed/interrupted generations remain charged
in the ledger because Google may have billed them. Raising the cap authorizes
more generation; lowering it does not reset usage. Do not delete the ledger to
reset a budget. Keep it with persistent backups. Other apps using the key are not
covered by Muse's cap. Personal narration cache misses also consume the existing
daily AI attempt allowance; gift scenes retain their separate Studio reservations.

Build and restart Muse after changing the public provider flag:

```powershell
npm run build
npm run start
```

Use the actual port/launch command configured on your deployment. Updating local
environment settings does not update your public website.

## 3. Use narration

### Personal stories

Open a story, provide the creator access code if required, and accept the
Google narration disclosure. Tap the scene's Listen button to prepare/load its
recording, then tap **Play** in the native audio player. The extra Play tap avoids
relying on autoplay permission after an asynchronous request on iPhone.
Matching cached recordings reuse audio instead of calling Google again.
The shared cache is bounded to 128 MiB in total and 12 MiB per recording.
Expired or evicted personal recordings need fresh, budgeted generation; saved
story-gift scene recordings also have their existing story-specific media copy.

Audio settings offer six pacing presets: calm, warm, curious, adventurous,
playful and suspenseful. These are subtle delivery changes, not six actors or
guaranteed emotional performances. The server chooses a language-specific
WaveNet voice. Unsupported languages fail explicitly rather than speaking with
an unrelated voice. Device voices are a separate, explicit fallback.

### Story gifts

Create a prepared story gift (not a live adventure). In the private management
page, select each scene in turn, check Studio availability, accept the Google
disclosure, prepare the recording and listen to it before sharing.
Recipients load the already-prepared scene recording and press Play. Recipient
requests never authorize paid generation. Cached gift audio retains existing
session, story-expiry, link-revocation and romance-content gates.

**Current limits:** Google gift recordings cover prepared scene titles, bodies
and clues only, not live recipient adventure turns or the private final reveal.
The final message can use the sender's uploaded voice recording. Optional device
speech is clearly labeled and is not the Google listening experience.
The handcrafted demo remains free device narration; it is not a Google voice demo.

## 4. Verify before launch

1. Run `npm run test:google-narration`, `npm run test:narration`,
   `npm run test:studio`, and `npm run build`.
2. Start with one short original scene and inspect Google billing/usage.
3. Play it on a physical iPhone in Safari and Chrome, including pause/resume.
4. Replay the same scene and verify no new synthesis request is charged.
5. Check English, Mandarin, Hindi, Spanish and Arabic pronunciation with native
   speakers before advertising equivalent quality.
6. Test missing credentials and exhausted caps: neither must fall back to device
   speech silently. Keep the recording player usable when browser speech is absent.

Google's selected voices and actual perceived quality still require live testing.
Automated tests mock synthesis and do not prove real-device audio quality.

## Privacy and retention

After consent, spoken text is sent to Google Cloud under its service terms.
Treat the generated audio as private story content. Muse's private Google cache
contains audio plus hashed lookup metadata, not plaintext narration inputs.
Its audio retention is up to 30 days, with cleanup triggered by requests, not a
scheduled deletion guarantee. The budget ledger persists independently.
Deleting a story disables its story-specific recording access; a separate
deduplicated narration cache can retain audio until cleanup. Backup retention is
separate. Update your production privacy notice and backup procedures accordingly.
