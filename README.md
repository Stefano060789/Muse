# Muse

Muse is a personalized storytelling prototype with three areas:

- **Myself:** a browser-local profile entered by typing or voice.
- **My Story:** AI-generated personal stories with answer-driven continuations.
- **Shared Story:** one creator supplies a story idea, setting, narration
  style, personal hints, exact solution and final message. AI prepares a
  mystery for a recipient to solve in approximately 5, 10, 15 or 20 minutes.

Text and audio are interaction options within these areas, not a separate
product area. The older daily-wellness documents below are historical
research, not the current implementation inventory.

The full product definition lives in four documents:

- [docs/SCOPE.md](docs/SCOPE.md) — exact product scope, what Muse is and is
  not, and the legal/safety boundaries
- [docs/PLANNING.md](docs/PLANNING.md) — delivery phases and milestones
- [docs/TODO.md](docs/TODO.md) — near-term, imminent activities
- [docs/MARKETING.md](docs/MARKETING.md) — value proposition, competitive
  comparison, pricing, and go-to-market
- [docs/MARKET-ANALYSIS.md](docs/MARKET-ANALYSIS.md) — market differentiation,
  revenue scenarios, risks, and validation targets

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Use Node.js 24 LTS and set `STORY_STORAGE=sqlite`,
   `LLM_PROVIDER=ANTHROPIC`, `LLM_MODEL=claude-haiku-5-5` and your private
   `ANTHROPIC_API_KEY`. Supabase, Neon and Stripe are not required for local
   story testing. ElevenLabs is optional; browser narration remains available.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.
5. Open `http://localhost:3000`.

Never commit `.env.local`, service-role keys, or other provider credentials.

### Local SQLite testing (no database registration)

`STORY_STORAGE=sqlite` explicitly selects a server-side SQLite database.
The first story request automatically creates the database and schema at
`data/muse-stories.sqlite`. Set server-only `MUSE_SQLITE_PATH` to choose
another persistent file location. The data directory and SQLite files are
ignored by Git. Keep them out of public folders and cloud sync intended
for source code; they contain plaintext briefs, private answers and messages.
Access-link tokens are hashed before storage. Filesystem access is still
access to the story data: this is not encryption at rest.

SQLite stores shared stories, recipient sessions and usage counters.
Myself and My Story content remain in browser-local storage. Generation
limits use the local database instead of Supabase, so no service-role key
or SQL dashboard migration is necessary. Closing/restarting Muse preserves
the database; clearing browser storage can still lose management links
and the recipient's session token.

For creator/recipient testing, create a story in a normal browser window
and open its recipient link in an incognito window. Both connect to the
same running local server. A localhost link does not work on someone
else's computer. Local-network testing requires deliberate server binding
and firewall access; do not expose the test server publicly.

Claude still needs internet access and consumes your API credits. SQLite
does not make the AI run offline. Optional provider narration is a separate
paid request. The database itself has no service subscription.

This mode is for a local persistent machine, not Vercel's ephemeral
filesystem. SQLite mode is explicitly rejected on Vercel. Before hosting,
set `STORY_STORAGE=supabase`, apply the migration, and configure the
server-only Supabase key. There is no automatic database-content migration.
An absent storage setting continues to select Supabase for compatibility;
invalid settings or storage failures do not silently fall back.

## Current foundation

- Next.js 14 with React 18
- Browser-local Myself and My Story
- Explicit local SQLite or hosted Supabase for shared stories and usage limits
- Claude Haiku 5.5 for My Story and Shared Story (OpenAI/Groq optional)
- Separate creator-management and recipient-play capabilities; no sign-in
- Server-side answer checking and a final message returned only when solved
- ElevenLabs narration with explicit browser-voice fallback
- GitHub Actions production-build workflow

## Browser story library

`/library` keeps multiple personal stories (including answers and progress)
and private shared-story management entries in this browser. Reopening a
personal story is local; opening a shared management link checks the server,
where the story may already have expired or been deleted. Library cards do
not display private answers, messages or access tokens.

The versioned `muse-story-library` key migrates valid existing
`muse-personal-story` and `muse-shared-creator` copies once. Those legacy keys
remain compatible latest-story copies, but cannot resurrect entries removed
from an initialized library. No entry-count limit silently evicts stories.
Storage permission, quota and malformed-data failures are reported rather
than replacing unreadable data. Back up/recover unreadable browser data before
changing storage keys.

These are browser-local plaintext records, not an account or cloud backup.
Anyone with access to the browser may read personal answers, private shared
briefs and management tokens. Clearing browser data loses these entries.
Removing a library entry removes only its browser copy; use shared-story
management to delete the remote story and invalidate its links.

Run focused offline persistence checks with `node scripts/library.test.cjs`.

## Private Shared Story setup

For local SQLite, use the setup above and skip the Supabase steps below.
Both modes keep the same separate creator/play links and server-side reveal.

1. Apply [supabase/shared-stories.sql](supabase/shared-stories.sql) to the
   **Muse** Supabase project. It adds new tables with RLS and no anonymous or
   authenticated direct access; only the server service role can use them.
   It does not modify the existing profiles/messages/storage policies.
2. Set `STORY_STORAGE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`,
   `LLM_PROVIDER=ANTHROPIC` and server-only `ANTHROPIC_API_KEY` locally and
   in Vercel. `LLM_MODEL` defaults to `claude-haiku-5-5`. Use a Claude Console
   API key and API credits; chat subscription access alone is not an API key.
   Remove any old model override when changing providers. The native Messages
   API uses low effort, bounded output tokens, and a 45-second timeout.
   Refusals, unfinished output and malformed stories produce explicit errors;
   there are no automatic paid retries or provider fallback.
   For optional OpenAI use, set `LLM_PROVIDER=OPENAI`, `OPENAI_API_KEY`,
   and `LLM_MODEL=gpt-4.1-mini` (`LLM_API_KEY` is accepted as a legacy key).
   For optional Groq use, explicitly set `LLM_PROVIDER=GROQ`,
   `LLM_API_KEY` and `LLM_MODEL=llama-3.3-70b-versatile`.
3. Open `/shared`, enter a brief, generate and review the preview, then copy
   the **recipient** link. Keep the separate **management** link private.
4. The recipient reads/listens to scenes and types/dictates guesses. Clues
   lead to the exact answer or a creator-approved alternative; case, punctuation and spacing are ignored.
   Duration is estimated reading/listening plus solving time, not a timer.
5. From the creator view, replace a recipient link (invalidates the old
   one) or permanently delete the story and its sessions.

Links contain random capabilities in URL fragments, not the story/answer.
Anyone possessing a play link can play; anyone possessing a management
link controls that story. This is capability-based privacy, not identity
verification. Do not put management links into analytics or public posts.
Old self-contained `/couples?share=...` links are explicitly retired;
`/couples` without a legacy payload opens the new flow.

The entire creator brief, including the answer and final message, is sent
to the configured provider (Claude Haiku by default; OpenAI/Groq when selected).
Narration text is sent to ElevenLabs when configured; browser
dictation can use the browser vendor's speech service. Do not include
sensitive third-party personal data. Shared Story does not read or forward
the creator's local Myself profile automatically.

Story links expire after 30 days. Expired rows are cleaned up on subsequent
rate-limited generation/guess requests, not by a guaranteed scheduled job.
An active creator can delete their story immediately. Before public launch,
add scheduled retention cleanup, abuse protection, provider budget alerts
and a privacy review.

Generation is atomically limited in the selected database to 5 requests/hour per
connection and 100/day across both story areas, including failed AI calls.
Guesses are limited to 30/session, spaced by 2 seconds, with an additional
60/hour per connection and 5,000/day global cap. Limits are guardrails, not
production-grade identity or billing controls. Missing providers/storage
return explicit errors; no fake AI or insecure URL-sharing fallback is used.

## My Story generation

My Story uses the same provider and database-backed request budget. SQLite
initializes locally without registration. For Supabase mode, apply the
shared-story migration and configure the service-role key even though the
personal story itself is stored only in the user's browser.

Creation generates three planned scenes. The first two answers each trigger
one bounded AI request that rewrites the next scene using visited scenes,
the original need and the answer. The final reflection is saved locally
without another API request: at most three paid requests per completed story,
unless the user explicitly retries or starts another one.

Both creation and continuation prompts specify the full required JSON shape,
including top-level `narrationStyle` and `narrationLanguage`. Missing or invalid
AI fields still produce an explicit error without replacing saved progress;
there is no paid automatic retry or made-up metadata.

## Profile memories and browser story library

Myself keeps up to 20 memories in this browser. Add new details, edit a memory,
remove one, or choose **Forget everything in my profile**. Edits/removals are
saved explicitly; full or blocked browser storage produces a visible message
and leaves the previous saved profile unchanged. Damaged stored memories are
reported rather than silently erased. Forgetting profile memories does not
erase existing stories or retract information already sent to a provider.
Only the latest five memories are included in new My Story requests when
the user selects the opt-in checkbox.

The **Story library** is a local index of personal stories and shared-story
management links, not a fourth primary experience. It lets you resume
different personal stories and reopen shared creator views. Existing
single-story browser saves are migrated without requiring an account.
Browser storage is device/origin-specific: it does not synchronize between
computers, private windows, or hosted/local addresses. Management links are
private capabilities; do not share your browser profile with someone who
should not control those stories. Removing a library entry is not the same
as deleting a server-stored shared story; use its creator deletion controls
to revoke links permanently.

Only the latest five Myself key points are sent, and only when the user
checks the opt-in box. The current need, answers and bounded visited-scene
context are sent to the provider. No raw profile or unbounded chat history
is included. Existing saved template stories remain playable locally;
new generation failures do not replace them with an undisclosed template.

Audio remains a separate optional interaction using the existing ElevenLabs
or browser voice path; Haiku produces text, not speech.

## Adaptive browser narration for local testing

Use `NEXT_PUBLIC_NARRATION_PROVIDER=browser` for testing without narration
credits or another account. This explicitly bypasses the cloud TTS route.
Changing this public setting requires rebuilding/restarting the app.

Styles available for selection:

| Style | Experience |
| --- | --- |
| Calm | Rest, relaxation and a slower pace |
| Warm | Comfort, hope and a personal message |
| Curious | Exploration and discovery |
| Adventurous | Energy, movement and courage |
| Playful | Light-hearted puzzles and fun |
| Suspenseful | Mystery and anticipation, not frightening effects |

Claude chooses allowlisted `narrationStyle` and `narrationLanguage` metadata while writing
the story, without another paid AI request. The browser turns that style
into pace/pitch settings and an appropriate available speech voice. The
user can override the style, language or voice and preview the result.
Older stories without AI narration metadata use a disclosed default.

Narration can be paused and resumed, or stopped to restart from the beginning.
Style, language and manual voice preferences are remembered locally; keeping
style on Auto preserves AI choice for each new story. The browser voice
selector is bounded to the screen width, including narrow phone layouts.
Unavailable speech input and microphone failures are reported explicitly;
users can continue by typing.

Shared Story name dictation uses a single phrase rather than continuous
recording. Browser recognition requires its speech service as well as
microphone access; VS Code's embedded browser can expose the API and grant
microphone permission yet return a `network` error. In that case open the
same local address in regular Edge or Chrome. Network, denied permissions,
missing microphone and no-speech errors have specific guidance; speech
recognition is not an offline transcription feature.

On Shared Story, **Dictate** means microphone-to-text input, whereas **Listen**
means speaker playback. Select the dictation language independently from the
narration language and wait for the listening indicator before speaking.
The expandable microphone input test shows the active default input label and
a live level meter for ten seconds. It only analyses audio on the device,
without saving or uploading it; testing cannot verify transcription.
The test releases the microphone on timeout, Stop, dictation start or unmount.
If no level appears when speaking, check the default input device, mute and
volume. If levels move but no words arrive, investigate the browser recognition
service/language instead. The recognition API cannot choose a microphone;
change the default in browser/Windows settings.

These are narration presets, not six newly installed voice models.
Available voice identities and supported languages depend on the browser
and operating system. The checked Windows browser already has David,
Mark and Zira (English), Hedda/Katja/Stefan/Michael (German), and Cosimo/Elsa
(Italian). Another device may expose different voices. Missing or
unsupported speech voices must be reported rather than pretending audio
played. Browser presets cannot guarantee studio-quality acting.

Local installed voices avoid a paid speech-provider request. Some browsers
also expose network-based voices; choose an available local voice if you
need on-device narration. Microphone dictation is separate and may still
use the browser vendor's speech service.

The existing ElevenLabs credential check returned HTTP 401. Cloud narration
is not considered working until credentials and voice access are verified.
Browser mode does not fix or use that key.

### Previewing and sharing a Shared Story

After generation, the creator can **Listen to the whole story** (all scenes
and clues, without the private answer or final message), listen to individual
scenes, and separately **Preview the final message** before sending.
Listening does not advance recipient progress or send anything.

Copy the **recipient link**, or use **Share on WhatsApp** on a reachable
hosted installation. Supported browsers also offer **Share with another app**
through the device share sheet. Creators can choose **Open recipient story** to open the play link directly
in a new tab with one click. This retains this browser's saved player progress;
use a private window to test a fresh recipient session.
Choose the contact and confirm sending in
that app; Muse does not automatically send messages. Share payloads include
only a generic invitation and the recipient capability link, not the
management link, secret answer, or final message. Anyone with the link,
including someone it is forwarded to, can play until it expires or is
replaced/deleted.

The current `127.0.0.1` local testing address only works on this computer.
Outbound app-sharing controls are hidden for loopback addresses; copying
still works for another browser on this computer. Remote sharing requires a
reachable deployment and suitable persistent hosted storage; do not deploy
the local SQLite setup to Vercel. Sharing sends a link, not an audio file:
recipients listen with voices available on their own devices.

### Optional puzzle assistance

Recipient links open a focused story player directly, without a sign-in step.
Choose Read or Listen; audio starts only after tapping Play. Listen mode
keeps the transcript available in a disclosure. Exploratory action choices
advance through the same linear clue trail (not branching or paid AI
continuations). The final secret answer remains typed or dictated, never
listed as a selectable choice. New AI stories include three safe actions
per scene; older stories use disclosed standard navigation actions.

Creators can supply up to three progressively stronger assistance hints and
up to five approved alternative answers, one per line. Hints are optional
and requested individually by the recipient, without a paid AI call or
advancing to the next scene. Only requested hints are revealed. Alternative
answers remain private; matching is normalized exact matching, not fuzzy or
AI-judged correctness. Avoid writing the final answer or private message in
an assistance hint unless you intentionally want to reveal it when requested.

SQLite upgrades the existing local session schema in place. Hosted Supabase
installations must reapply `supabase/shared-stories.sql` for the updated hint
progress schema/RPC before using puzzle assistance.

### Validation

- `npm run test:shared` - both story areas, provider contracts, bounded
  progression, privacy projection and APIs using mocked provider/database calls.
- `npm run test:sqlite` - real temporary SQLite storage, durable progress,
  rate limits, deletion, expiry and local configuration guards.
- `npm run test:sqlite:production` - actual built Next server SQLite loading
  and progress persistence across a server restart, with external calls blocked.
- `npm run test:narration` - adaptive styles, voice matching, playback lifecycle and sharing payloads.
- `npm run test:core` - profile memory CRUD/storage failures and complete personal-story AI response schemas.
- `npm run test:dictation` - name dictation, readiness, language and recognition error handling.
- `npm run test:library` - browser library persistence, migration and validation.
- `npx --no-install tsc --noEmit` - TypeScript.
- `npm run build` - production build.

## Hosted configuration checklist

- **GitHub:** connect the repository and enable the CI workflow on `main`.
- **Vercel:** import the GitHub repository, configure the same environment
  variables for Preview and Production, and deploy from `main`.
- **Supabase:** select the project, run
  `supabase/schema_and_rls.sql`, create the private `tts` bucket, and copy
  the project URL and anon key into the local/Vercel environments.
- **Stripe:** create products/prices for the subscription tiers and configure
  a webhook endpoint after the billing API route is added.

Hosted services should be configured only after the target GitHub repository,
Vercel project, and Supabase project are identified.

## Supabase project

Older configuration references `owhaqypvmonzdcikipay`, but no accessible
Muse project has been confirmed in the current account. Local SQLite does
not use that reference. Confirm a real Muse project before hosted setup.
