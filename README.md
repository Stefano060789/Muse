# Muse

## Google WaveNet narration

For lower-cost multilingual MP3 narration, follow
[the Google Cloud setup guide](docs/GOOGLE-NARRATION.md).
Personal stories use consented server-generated recordings; prepared story gifts
let senders generate scene audio once and recipients replay it without generation.
Google requires server-only credentials, an explicit character budget and durable
storage: Supabase on Vercel, or Node.js 24 with private disk locally.
It is disabled until configured; no paid setup or
provider calls happen automatically. Live gift turns and final reveals are not
included in prepared scene audio. The handcrafted demo uses public, prerecorded
Google WaveNet MP3s, with no generation request or device speech during playback.

Muse is a personalized storytelling prototype with three areas:

- **Myself:** a browser-local profile entered by typing or voice.
- **My Story:** prepared personal journeys shaped by freeform responses and a
  mood chosen before starting; legacy three-scene stories remain playable.
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

## Gifts inside Shared Story

Gift-story previews and recipient pages prioritize the story. Sender scenes are
visible immediately; sharing safeguards, answer/reveal, uploads, narration
preparation, progress and management stay under **Share and sender tools**.
New/reuse buttons are absent from the preview; primary navigation still creates
a new gift story. Recipients see story text and prepared audio together without
read/listen mode toggles or decorative banners. Settings, hints, keepsakes,
privacy explanations and the full footer are collapsed; required romance and
AI-processing consent remain explicit. No create-your-own promotion appears
after the reveal. Recipient dictation uses the story language, and editing
cancels late transcripts. Pending live-adventure turns check progress
automatically with read-only open requests (three seconds while pending,
fifteen after an error), never automatic paid retries.
Prepared recipient audio keeps explicit Load/Play controls and shows provider
information in a collapsed explanation, not repeated recording-ready copy.

### Simple start and app installation

**Private-beta server recovery:** After entering Creator access, **View all story
progress** finds server stories and displays their progress in one action.
Individual **View story progress** buttons also refresh the server collection
when a Creator code is entered; there is no separate server-loading step.
The configured deployment-wide
`MUSE_CREATOR_ACCESS_CODE` grants administrator access to all retained gifts,
including private sender briefs; it is not a per-user account. Recovery is
disabled without a valid configured code even in local development. Internal pages contain
at most 20 stories; all pages load automatically and merge into the browser only
after the entire collection and its progress validate, without removing personal
stories or duplicating gifts. Original links, sessions, budgets and progress are
unchanged; no AI call occurs. Recovery derives role-separated HMAC capabilities
from the administrator code and current stored link hashes, without storing
plaintext secrets or needing a schema migration. Recovered links are invalidated
by administrator-code changes; replacing the recipient link also invalidates
recovered recipient links. Reload the server collection to refresh recovered
access. Deleted or purged stories and browser-only data cannot be recovered.
This is private-beta administrator recovery, not general account/cloud sync.

Home separates creation into two visible choices: **My story** is for your own
interactive adventure; **Gift story** is for writing a private mystery and
surprise for someone else. The gift creator labels its main writing area
**Write the story for them**.

The same primary menu appears across Muse: **Home**, **Myself** (`/myself`), **Create a story**
(`/story?new=1`), **Create a gift story** (`/shared#new`), and **Saved stories** (`/library`).
It sits above decorative artwork, highlights the current area, and uses a
two-column menu on phones. Gift recipients retain a quiet, brand-only header.
Saved stories groups **Stories for me** and **Gift stories for others**, including
private owner access. Gift-story cards offer **Share**,
**Remove story**, and **View story progress**. The sharing panel groups native
device sharing where supported, recipient-link copying and printable QR codes.
Its local recipient-facing preview never opens a playthrough or records progress.
Use the device share sheet for available apps such as WhatsApp or Instagram;
otherwise copy the recipient link and paste it into a message or post.
Local-only addresses cannot be externally shared or printed as QR codes.
Removal only
removes this browser's entry and keeps recipient links working. Progress checks
show **2/5 · Not finished**, **Finished** after the ending is unlocked, or
**0/5 · Not finished** before opening. The fraction measures the furthest scene
reached across browser playthroughs, not listening time. Live adventures have no
fixed scene count and show **2 scenes · Not finished** instead. The live count
includes the opening plus successfully generated scenes in the furthest
playthrough; failed/pending attempts and other playthroughs do not inflate it.
Scene totals come from the server rather than a stale browser copy. Checks do not poll or generate
AI content. The optional
creator access code is memory-only and is required when creator access is gated.
Expired/deleted server stories may no longer have available progress.
**Myself** appears before **Create a story** in the main navigation, with typing,
hold-to-speak, explicit browser-local saving and memory editing/removal.
It is optional, not a mandatory step before creation. The latest five memories are included in
new personal stories by default, disclosed in creation and the AI consent.
Users can uncheck inclusion in step two or review/remove memories at `/myself`.
Returning visitors can continue their latest unfinished personal story directly
from Home; completed stories offer **Read again**. Personal touches live on Myself,
not Home, and personal library cards keep attempt details
behind an optional disclosure.
Personal touches also remain optional inside story creation. Plans, sample,
help and legal pages are available in the footer; creator tools stay unlisted.
Personal creation keeps optional personal touches in a collapsed inline editor
in step two; the romance theme is selected with mood in step one. Step three
includes optional cloud-narration permission, separate from story AI processing.
Restored journeys check saved progress automatically on opening or returning to
the tab, without generating story text. Pending checks retry after three seconds;
failed checks retry after fifteen seconds, stopping when synchronized. No manual
sync button or bottom create/profile actions appear in the reading view.
**Delete story** is available at the bottom after creation, with confirmation.
For server journeys it requires creator access and the story capability, deletes
server progress before removing the browser entry, and never refunds attempts.
Legacy browser-only stories are removed locally. Failed deletion preserves the
story; a local cleanup failure after server deletion is explicit and retryable.
Background checks do not explicitly stop narration. The response draft stays editable while
progress is checked. Hold-to-speak uses the story language; releasing finishes
dictation, and focusing the response field cancels late transcripts so typing
is not overwritten.
**Try a 2-minute sample** opens an original, fictional
two-scene gift at `/demo`: no runtime AI generation, paid TTS, story storage, or account.
Sample narration uses three public, prerecorded Google WaveNet MP3s (two scenes
and the reveal). Native controls require a Play tap; errors never switch to device
speech. Internet is required to load recordings. See the Google setup guide for
regenerating these assets when sample text changes.

Muse includes a web manifest, original home-screen icons and a production-only,
network-only service worker. Install using the browser prompt/menu; on iPhone,
open Safari's Share menu and choose Add to Home Screen. This is an installable
website, not an App Store release. Internet is still required. The worker does
not cache private pages, API responses or media. Existing local drafts/library
remain browser-local and unencrypted; installation adds no cross-device sync.
The recipient-only development gateway allows only the exact public app assets,
not creation, demo, or paid APIs.

Before sending a new recipient link, review the cover and every prepared scene,
confirm that the clues/accepted answers are fair, and check the attachments.
This deterministic preview makes no provider call or recipient progress.
Live-adventure previews show the prepared plan, not simulated AI actions.
Pending uploads, missing reveals and expired stories block sending. The private
management link remains accessible independently of the checklist. After a
reveal, recipients have a quiet **Make a story for someone** link that starts a
blank creation flow without copying the recipient capability or surprise.
After preparation, owners can edit and save the proposed title; title updates
are stored with the story for both the creator and recipient.

### Story languages

New personal and shared stories offer **English, Mandarin Chinese, Hindi,
Spanish and Arabic**. Generation/continuations and narration metadata follow
the chosen language, with localized recipient controls and RTL shared-story
content for Arabic. Sender-written names, hints, answers, dedications and final
messages are preserved, not translated: write them in the intended language.
General app navigation, advanced settings and some errors remain English.
Saved stories without a language retain their existing behavior; reusing or
restoring a brief preserves its explicit language. No new database migration
is needed because language is saved inside existing JSON records.

Browser narration/dictation require matching device voice/language support.
If microphone access is blocked, allow it for the site in browser permissions
and device privacy settings, reload, and try again; typing remains available.
These language choices are not a claim of professionally reviewed translations
or provider story quality. Real multilingual user testing remains a launch gate.
Run `npm run test:onboarding` for sample, pre-send and installation checks;
`npm run test:languages` covers language validation, persistence, deterministic
feedback and mocked generation/continuations without paid provider calls.

Choose Birthday, Our memories, A surprise, Just because, or My own idea.
Occasions provide editable starting prompts, not an additional paid AI call.
Gift recipients see a personal cover and explicitly open the story; nothing
autoplays. Cover text is recipient-visible before solving, never a place for
the answer or final surprise. Link previews remain generic.

Optional extras stay collapsed:

- A personal cover dedication and creator-enabled private thank-you replies.
- One final-reveal voice recording, **60 seconds / 5 MiB**, alongside the
  existing photo/video. Record locally as mono PCM WAV, or upload a WAV file.
  No voice cloning, transcription or AI processing. The microphone requires
  consent and HTTPS/device permission. Failed uploads can be retried without
  generating another story.
- A printable keepsake; private answers, links, replies and media are excluded.
  The final written message is excluded unless explicitly selected. Device
  print/PDF support varies; disable print headers/footers to omit page URLs.
  Live-adventure recipient keepsakes contain available scenes and the latest
  turn, not an invented full transcript.

Written drafts autosave only in the current browser and offer explicit
restore/discard. They contain private text, not files, recordings, creator
codes, link capabilities or consent. No account or cross-device sync is added.
Replies are voluntary, visible only in management, and do not add read receipts
or recipient identity tracking.

Hosted gifting requires the incremental `supabase/shared-story-gifts.sql`
migration after the existing shared-story media and help migrations. Run
`supabase/shared-story-gifts-smoke.sql` as a rollback-only verification before
enabling gifts in production. Neither has been applied automatically by local
tests. SQLite upgrades its local schema automatically. Voice uses a separate
private slot, preserving the existing photo/video, and its actual WAV bytes
are validated for format, size and duration on both client and server.

Run `npm run test:gift-experience` for drafts, occasions, safe printable output,
recording and creator/recipient UI checks; `npm run test:gifting` covers
private voice/reply authorization and persistence without paid provider calls.

### Printable QR codes and gift cards

Under **Share and sender tools**, finish the pre-send checks for a publicly
shareable gift story, then choose **Create printable QR code**.
Saved gift-story cards also offer **Create printable QR code** beside the
recipient-link and completion actions, without opening management or the story.
Muse generates the QR locally with `qrcode`; no external QR service receives
the recipient capability. The card includes a generic editable greeting, the
recipient address and no-automatic-expiry notice, never an automatic copy of private
answers, the reveal or media. The greeting is visible before online content
notices, so keep it appropriate for the printed card.

Anyone with the card can use its recipient link. Replacing that link, deleting
the story invalidates printed copies. Printing does not
extend retention or make an offline interactive story. A separate text keepsake
can be kept offline, but excludes attachments and is not a full live transcript.
iPhone print/PDF steps vary by iOS; physical-device printing and QR scanning
remain release checks. Run `npm run test:gift-card` for local PNG QR generation,
recipient-link validation and escaped printable HTML.

### Optional Studio narration

Shared Story's free narration controls always use device voices. Safari/iPhone
quality depends on exposed system voices; enhanced voice downloads do not
guarantee that Safari offers them. Device speech remains an explicit choice,
never a silent replacement when cloud audio fails.

Studio is a separate, opt-in recording for **prepared stories**, not live
adventure turns or final reveals. The creator chooses a scene, checks
availability and separately consents before preparing its title, body and clue
with Google Cloud when the Google provider is selected, or ElevenLabs in the
legacy configuration. No generation runs on page load. Recipients can only load an
existing recording for a reached scene. **Load Studio audio** fetches private
bytes; the recipient then taps the native player's **Play**, avoiding an
autoplay assumption after Safari's asynchronous fetch. Replays use the cache,
not the provider. Replacement and unmount revoke client blob URLs; a file
already downloaded cannot be recalled.

Generation stays disabled unless all server-only settings are present:

- `MUSE_STUDIO_NARRATION_ENABLED=true`
- Google: `NEXT_PUBLIC_NARRATION_PROVIDER=google`, `GOOGLE_TTS_API_KEY` and
  `MUSE_GOOGLE_TTS_BUDGET_CHARACTERS`, with the storage setup in the Google guide.
- Legacy ElevenLabs: `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID` and
  `MUSE_STUDIO_NARRATION_BUDGET_CHARACTERS`, an explicit positive integer
  lifetime reservation cap, shared across stories. This is **not a euro cap**;
  check provider pricing and set provider-side billing limits too.

Apply `supabase/shared-story-studio.sql` before enabling hosted Studio.
SQLite migrates automatically. The hosted migration is not applied by local
tests. Private cached audio is separate from the final voice-message slot.
Durable unique reservations deduplicate concurrent requests, reserve characters
before provider access and do not automatically retry failed or uncertain
attempts. Failed generation remains charged against this conservative cap;
check status rather than submitting another paid attempt. Cached playback
remains available if new generation is subsequently disabled, while story
expiry, deletion and recipient-link replacement still gate access.
Deletion and subsequent valid-capability requests sweep queued Studio audio,
including expired links. A five-minute storage grace period protects late
in-flight writes. Physical removal can wait for another request; schedule the
same purge during idle periods if a predictable cleanup cadence is required.

The `/api/tts` path serves consented personal Google narration, with a private
cache and durable global budget. Its legacy ElevenLabs mode remains separate;
it is not this cached recipient solution. Do not enable that legacy mode as a
production replacement for Studio. No credentials, spending settings or paid
provider calls were enabled by implementing these controls.
Run `npm run test:studio`, `npm run test:narration` and `npm run test:gateway`.
Real iPhone voice quality, speaker/lock-screen behavior and playback still
need physical-device acceptance testing.

## Story Atelier interface

Muse uses a mobile-first Story Atelier theme: ivory paper, midnight blue,
muted plum, literary headings and system-font controls. The original doorway
illustration is a local SVG; no external fonts, image service, animation
library or extra runtime dependency is needed.

Original local SVG landscapes extend the story-escape atmosphere throughout
the app: a moonlit passage for personal journeys, a lantern garden for shared
gifts and the demo, and a celestial library for saved stories and practical
pages. A shared decorative masthead covers every inner page, including errors;
the home uses the passage as its hero. Artwork is static, hidden from assistive
technology, independent of private story content, and makes no image-provider
calls. Compact phone crops keep controls and text on opaque paper surfaces.

The landing page explains personal interactive stories and mystery gifts,
with a free handcrafted sample separate from AI generation. It is intentionally
one short hero: two creation choices and the sample stay visible, while optional
personal touches, installation and further information live in a collapsed
section. Paper gradients, gold chapter dividers and plum headings carry the
Atelier style through creation, the library and recipient reading screens;
no autoplay, extra image services or paid calls are introduced. Personal story
creation is split into mood, personal details and review. Navigating these
steps does not call AI; explicit provider consent and any romance confirmation
are still required at creation. Values survive Back/Continue within the open
page and autosave in this browser, including optional unsaved personal touches.
Unsent personal answers are stored separately by story and revision; stale
answers are not restored against a different saved scene. Restoring drafts never
generates story text or restores AI, narration or romance consent. Storage errors
are explicit and unreadable drafts are not overwritten. Browser-local drafts
are unencrypted, not synced or backed up. Language and duration are remembered;
existing narration settings already remember voice/style and ambient preferences.
Completed personal stories offer a read-only rereading view and printable text
keepsake without private answers, memories or access links; an exhausted allowance
is not presented as a completed ending.

The same visual foundation covers gifts, the browser-local library, personal
touches, billing and legal/support pages. Existing storage, pricing,
access and consent rules are unchanged. Run `npm run test:design` for focused
interface regressions. Validate responsive layouts at 320, 390 and 1280 pixels,
including Arabic recipient views and keyboard/reduced-motion behavior.

## Optional romance stories

My Story and Shared Story offer an optional Romance setting: **Sweet**
(affection and emotional intimacy) or **Spicy, non-explicit** (flirting,
romantic tension and fade-to-black intimacy). Both are for consenting adults
18 or older and adult characters. Explicit sexual descriptions, nudity,
minors, coercion and sexualized portrayals of real people without permission
are outside this feature. These boundaries are carried into generation and
saved-story continuations; selecting another mode cannot override an existing
journey's server-side setting.

Creators must freshly confirm the adult/consent boundaries before generating
a romance story. Shared recipients first receive only the romance style and
language, not the title, names, dedication, scenes, reveal or media. They can
decline without opening a playthrough, or confirm they are 18+ and choose to
open. This acknowledgment is not saved in browser drafts or restored on
reopening. Every recipient API action requires the acknowledgment for a
romance-tagged story, including resumed/solved sessions and media/replies.
Existing untagged stories retain their normal opening.

This is self-declared age/consent, not verified identity, and does not certify
that a sender's text or uploads are appropriate. AI instructions are not a
complete moderation system. Untagged freeform inputs and user attachments
are not automatically classified as romance or reviewed. Provider safeguards
still apply; production moderation, reporting and real multilingual safety
testing remain release gates. No explicit-content or age-verification
guarantee is made. Romance metadata uses existing JSON storage; no SQL
migration is needed.

## Plans and billing preview

`/billing` presents proposed Free, EUR 3.99 one-off Gift, EUR 8.99/month Plus
and later EUR 89.99/year Plus plans. Plus proposes 10 creations and 120 AI
interactions per billing month, shared across personal stories and gifts;
one-off gifts propose up to 12 shared live actions. Premium cloud narration
is excluded. The home page links to this preview without adding onboarding.

All plans are clearly marked as proposed and unavailable to purchase. There
is no checkout, payment collection, subscription, billing identity or new
allowance enforcement. Current prototype access and safety limits are
unchanged. Final taxes/terms, secure customer identity, server-side allowance
accounting and verified payment integration are required before paid launch.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Use Node.js 24 LTS and set `STORY_STORAGE=sqlite`,
   `LLM_PROVIDER=ANTHROPIC`, `LLM_MODEL=claude-haiku-5-5` and your private
   `ANTHROPIC_API_KEY`. Supabase, Neon and Stripe are not required for local
   story testing. Cloud narration is optional; browser narration remains available.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.
5. Open `http://localhost:3000`.

Never commit `.env.local`, service-role keys, or other provider credentials.

### Hosted shared-story test on Vercel

#### Optional live shared adventures

The creator must opt in and approve an explicit **1–1000 total AI action
attempt budget** per adventure, shared by all recipient playthroughs.
Existing stories remain linear and unchanged. New adventures use the prepared
public clue plan, freeform typed actions/editable browser dictation or 3-5
AI-suggested actions selected at creation, meaningful
consequences and compact durable inventory/discoveries/relationships/progress.
Narration uses the prepared voice/style and language. Review dictation before
submit; unreliable hardware/browser recognition still reports explicit errors.

Each playthrough allows **12 submitted live actions**, including failed paid
attempts. The game master draws the journey toward a conclusion before that
limit. Exact guesses, creator hints and browser audio stay available at the
cap; there is no canned or silently substituted continuation. Preparation is
a separate existing generation request. Live prompts contain only bounded
public plan/state and the latest narration/action, never private answers,
alternatives, hints, final message or a growing transcript. Server validation
rejects exposed private text and invalid output; guesses use existing deterministic
judging, not AI. Do not include sensitive data in any brief or action.

**Hosted rollout:** apply `supabase/shared-stories.sql` first, then the separate
incremental `supabase/shared-adventures.sql` before enabling this feature.
The migration changes only Muse tables/functions, uses service-role-only
grants and RLS, and does not touch iVote objects. Missing migration fails
clearly without a legacy fallback or paid preparation call. SQLite initializes
its additive tables automatically on a persistent Node 24 machine.
No migration, deployment, dashboard change or provider generation is performed
by tests.

Set server-only `MUSE_ADVENTURE_DAILY_ACTION_CAP` (1–10000, default **100**)
for the persistent UTC daily cap across Shared Adventure and My Story journeys
(the same `muse_adventure_budgets` day bucket). All instances sharing
the database should use the same cap. Budgets reserve atomically **before**
provider calls, count failures conservatively, and never refund or auto-retry.
Each attempt has a durable request ID, fingerprint and revision; duplicate
tabs/restarts cannot replay a paid call. An interrupted attempt expires after
90 seconds as charged/failed; refresh to see current progress and intentionally
submit a new action. Token rotation/deletion and stale/solved state prevent
late completion. Browser storage must work to persist safe submission retries.
Clearing it may lose playthrough access but never resets the adventure/global
budget. Anyone holding the play link can consume the creator-approved budget.

Run `npm run test:sqlite`, `npm run test:shared`, and `npm run test:gateway`
with mocked AI only. `npm run test:interaction` covers the live suggested-choice
API flow through the full 12-action shared cap, replay, privacy, and personal
journeys at every duration. It is not a complete Shared Adventure suite.
`test:personal-journey` covers the tightly coupled shared daily budget and
freeform infrastructure, not comprehensive Shared Adventure behavior.
Hosted migration application and a service-role integration smoke test
remain an operator rollout step.
After applying both adventure migrations, run
`supabase/journeys-smoke.sql` in the SQL editor to verify PostgreSQL
reservations, idempotency, duration limits, conclusions, shared daily budgets
and RPC/RLS permissions. All fixtures and budget changes are rolled back;
the test makes no AI calls.

Use Node.js 24, the Next.js application preset, and the repository root.
SQLite is intentionally rejected on Vercel because its filesystem is not
persistent story storage. Apply `supabase/shared-stories.sql` only after
checking its table and function names do not conflict with existing apps.
Sharing a Supabase project shares capacity and the service-role trust
boundary; the key can access other tables in that project and must stay
server-only. Do not expose it to the browser or paste it into chat.

Configure these Vercel environment variables privately before deploying:

- `STORY_STORAGE=supabase`
- `NEXT_PUBLIC_SUPABASE_URL` for the chosen project
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `LLM_PROVIDER=ANTHROPIC`
- `LLM_MODEL=claude-haiku-5-5`
- `ANTHROPIC_API_KEY` (server-only)
- `NEXT_PUBLIC_NARRATION_PROVIDER=browser`
- `MUSE_CREATOR_ACCESS_CODE`: a private random code of 16 to 512 characters
- `NEXT_PUBLIC_MUSE_CREATOR_LOCKED=true`

The hosted test focuses on Shared Story. Its creator page accepts the code
in memory only and includes it in creation/management requests; refresh
requires entering it again. Other paid/legacy APIs are also gated, but
their existing pages do not yet have an access-code workflow. Local use
without the gate configuration remains unchanged. This code is a temporary
creator gate, not account registration or recipient identity verification.
Keep it separate from management and recipient link capabilities. Vercel
fails closed for private APIs if no usable creator code is configured.
Recipients need only their recipient link; browser narration needs no key.

Create new non-sensitive test stories on the hosted address. Existing
local SQLite stories are not automatically uploaded. Keep production
recipient pages publicly accessible rather than behind Vercel team login.
Never disable the in-app creator gate. Check the hosting plan's permitted
use and quotas before commercial use; no paid plan is required or approved
by these instructions.

Validate with `npm run test:creator-access` and the shared-story suites.
The patched Next.js 15 release retains the Pages Router and React 18;
PostCSS is pinned via an override to resolve its transitive advisories.

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

Final-reveal photos and videos are stored as files under
`data/shared-media` (ignored by Git). Set server-only `MUSE_MEDIA_PATH` to
choose another private directory; Muse refuses a path inside `public/`.
Files are uploaded with an authenticated same-origin PUT and served only
through the API after a correct answer — never as static files.

### Temporary recipient-only HTTPS sharing

Use non-sensitive test stories only. Cloudflare carries tunnel traffic.
This is not permanent hosting; the computer must remain awake, connected,
and running Muse. Never tunnel the main Muse port directly.

1. Run Muse locally on port 3102.
2. Run `npm run share:gateway`. It listens on loopback port 3104 and
   forwards only the recipient page, static assets, and the `open`,
   `next`, `guess`, `hint`, solved-session `media`, and opt-in `adventure` Shared Story actions. Creation, management,
   deletion, link rotation, other APIs and other pages are blocked.
3. Install the official Cloudflare `cloudflared` Windows tool and run
   `cloudflared tunnel --url http://127.0.0.1:3104`.
4. Keep the creator page open at its original local address. Under
   "Send the recipient their story", expand "Temporary HTTPS sharing",
   paste the printed `https://...trycloudflare.com` address and apply it.
5. Open the recipient link to check it, then use Share on WhatsApp.
   Only the recipient link uses the public address; management stays local.

No registration or new database is needed. Narration uses recipient-device
browser voices or existing private Studio recordings. Paid generation and
owner Studio previews are deliberately blocked by the gateway.
Anyone possessing the recipient capability can play, including after
forwarding. The gateway shares the local request budget across recipients.
Restarting the tunnel changes its address: reapply it and send a new URL;
the story capability and database do not change. Stop the tunnel to end
public access. No tunnel address is persisted by the creator UI.

Run `npm run test:gateway` to verify the gateway's allowlist and rejection
of owner actions, unrelated APIs, cross-origin and oversized requests.

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
- Device narration and separately prepared, private Google/ElevenLabs Studio audio;
  failures never silently switch voices
- GitHub Actions production-build workflow

## Browser story library

Pages use short labels and essential instructions. Audio settings and longer
privacy/storage explanations are expandable; AI attempt costs, media limits
and private-link warnings remain alongside the relevant actions.

`/library` keeps multiple personal stories (including answers and progress)
and private shared-story management entries in this browser. Reopening a
legacy personal story is local. New personal journeys reconcile authoritative
server progress through `/api/personal-story` after entering the creator code;
reconciliation is free and never generates text. Opening a shared management link checks the server,
where the story may already have been deleted. Library cards do
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
briefs, personal journey capabilities and management tokens. Clearing browser data loses these entries.
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
Narration text is sent to Google Cloud or ElevenLabs when selected and consented; browser
dictation can use the browser vendor's speech service. Do not include
sensitive third-party personal data. Shared Story does not read or forward
the creator's local Myself profile automatically.

Story links have no automatic expiry. Stories, progress and attached media stay
until deletion; owner deletion and recipient-link rotation still revoke access.
Storage uses an explicit `infinity` expiry sentinel, exposed as `expiresAt: null`
in API/browser snapshots, not an arbitrary distant date. Upload windows, signed
delivery URLs, rate limits and interrupted AI reservations still expire normally.
Before public launch, add abuse protection, provider budget alerts and a privacy
review. Indefinite retention is not a guarantee of perpetual hosting or backups.

For existing hosted databases, reapply `supabase/personal-journeys.sql`, then apply
`supabase/personal-journey-retention.sql` and
`supabase/permanent-shared-stories.sql` before deploying this release. They
upgrade surviving records only; already purged stories cannot be recovered.
Existing browser entries keep working even if they contain a legacy expiry date.
New databases use the permanent defaults in the setup scripts.

Generation is atomically limited in the selected database to 5 requests/hour per
connection and 100/day across both story areas, including failed AI calls.
Guesses are limited to 30/session, spaced by 2 seconds, with an additional
60/hour per connection and 5,000/day global cap. Limits are guardrails, not
production-grade identity or billing controls. Missing providers/storage
return explicit errors; no fake AI or insecure URL-sharing fallback is used.

### Shared library and help

Created shared stories stay in this browser's Story Library independently of
recipient progress. The Gift stories for others section offers recipient-link
copying, browser-local removal, printable QR cards and manual progress checks.
Private gift management uses the same simple scene/outcome display. Scene
progress is the furthest prepared scene reached across browser playthroughs;
**Finished** means at least one unlocked the ending by solving or revealing it.
Live adventures have no fixed scene count and show started/finished status
without inventing a percentage. Reaching the final scene alone is not finishing.
These are anonymous browser sessions, not unique people or proof of reading:
opening a link counts even before opening its gift cover; another browser or
cleared storage may count again. Counts include earlier recipient links for the
same story, and unfinished never means failed. Recipient pages disclose this.
The owner-only API requires the private management capability and creator access;
it never exposes identifiers, answers or private messages in the summary.
It uses existing session data, no extra AI calls, no polling and no new migration
(the existing puzzle-help migration supplying `skipped` is required on Supabase).
Browser entries are not account sync or backups; server deletion still applies.
Validate with `npm run test:progress`, `npm run test:sqlite`, `npm run test:shared`
and `npm run test:gift-experience`.

The creator chooses **Solve to unlock** (default, including older stories) or
**Allow a skip** before generation. Recipient **Need help?** explains same-browser
resume, existing free hints and contacting the sender outside Muse. Only opted-in
stories offer **Reveal without solving**, with explicit confirmation. The server
records a separate durable skipped state, never sets solved, and authorizes that
playthrough's private message/media. Other sessions remain locked. Skip/hints use
no AI calls, don't replenish budgets, and block further adventure turns; already
reserved attempts remain charged.

Before deploying this version, apply [shared-story-help.sql](supabase/shared-story-help.sql)
after the existing story, assistance and adventure migrations, then run the
rollback-only [help smoke](supabase/shared-story-help-smoke.sql). Hosted responses
missing the new state fail explicitly rather than silently discarding it. SQLite
upgrades its schema locally. No production migration is run by the application.

### Final reveal attachments

The creator form has three steps (who, story and duration, ending and final reveal)
with narration style, alternative answers, hints and adventure
mode chosen visibly with the story settings; narration and private puzzle help
are under **Advanced options** (defaults: warm playful narration, 5 minutes,
classic mystery). The final reveal is a message, one photo/video, or both.
Ending choices are visible cards: find and identify a clue, describe an action,
or say a word or phrase. Clue/action answers are checked against the creator's
answer and approved alternatives; Muse can check the text but cannot verify
that anyone physically performed an action. After the story is prepared, its
title can be edited without regenerating the story.

- Accepted: one JPEG, PNG or WebP photo up to 5 MB, or one MP4 or WebM
  video up to 20 MB, chosen directly from the device. The browser checks the
  type/size before the paid generation call; the server checks the declared
  type and size again before generation and, after upload, the exact stored
  size and the file's byte signature (HEIC/AVIF/QuickTime are rejected).
- The file and its type/size/name are never part of the AI prompt. The story
  is generated first; the owner then attaches the file to that story through
  a single-use upload session (15-minute window, bound to the story and its
  management link, creator code required, 6 attempts per story, 10 upload
  starts per connection per hour, 200/day overall). A failed upload keeps the
  generated story and the chosen file so **Retry upload** never regenerates.
- A story without a written message cannot be played until its media is
  attached; the creator view hides sharing until then. Replacing or removing
  the media deletes the old object. Deleting or expiring the story deletes it
  too (cleanup runs on later create/upload/delete requests; failed deletions
  stay queued).
- Recipients never receive media or its URL before a correct answer. Solved
  sessions request it explicitly: hosted mode returns a private signed URL
  valid for 10 minutes (refreshed automatically when it expires during
  viewing); local mode streams it from the API. Video shows controls and
  never autoplays. Rotating the recipient link revokes media access for old
  links (an already issued signed URL stays valid until it expires).

Hosted setup: after `shared-stories.sql` (and the adventure/journey SQL if
used), apply [supabase/shared-story-media.sql](supabase/shared-story-media.sql).
It creates the media/purge tables (RLS, service role only), upload RPCs, the
`upload` request limit, and the **private** `muse-shared-media` bucket with a
20 MB/type allowlist. Existing client-role `storage.objects` policies are
accepted only when every applicable predicate is an exact `bucket_id` equality
to a different bucket. Missing predicates, broader expressions, or Muse-bucket
access abort the transaction for an explicit isolation review. The migration
never changes another product's policies.
After applying it, run [supabase/shared-media-smoke.sql](supabase/shared-media-smoke.sql)
to verify service-role RPC access, private storage configuration, upload limits,
expiry, replacement and deletion queues. All fixture changes are rolled back;
the smoke test makes no AI or object-storage calls.
The server verifies the bucket is private before paid media-story generation
and before issuing an upload capability. No new environment variables are needed. Text-only
stories keep working before the migration; creating a media story fails
with an explicit error before any AI call until it is applied. Signed upload URLs are issued by Supabase
for 2 hours; Muse only accepts files finished within its own 15-minute
window. Discarded pending objects stay in the cleanup queue for at least
125 minutes after the upload was started, so later sweeps also remove files
uploaded after cancellation. Cleanup is request-driven; schedule a sweep or
review storage retention if the application will be idle.

## My Story generation

My Story uses the same provider and database-backed request budget. SQLite
initializes additive journey tables locally without registration. New UI
requests opt in with `mode: "journey"`; unmarked legacy `create`/`continue`
requests and old browser saves retain their three-scene behavior.

Select the mood **before** starting. Explicit selection always wins over
need-based inference. Select approximately **5/10/15/20 minutes**, allowing
at most **3/6/9/12 AI response attempts** respectively. These are
participation/reading estimates, not timers. The opening plus compact 3–5-point
plan is generated in one call; each submitted response uses one call.
The last successful response at the cap must return a validated conclusion,
not another required action. Failed final attempts exhaust the allowance
without fabricating an ending or charging another call.

The initial mood, duration, cap, opted-in five profile points and prepared
plan are authoritative server data. Live prompts send only that bounded
input, compact state (inventory/discoveries/relationships/progress), the most
recent narration and the latest action—not a growing transcript. Narration
is typically 100–180 words (validated 30–180, maximum 1800 characters),
with a strict 1600 output-token limit for opening and live responses.
Exact JSON keys, bounded unique lists, language/style and the final
conclusion flag are validated. Personal journeys have **no hidden answer,
private puzzle message or Shared Story record**.

Atomic durable request-ID/fingerprint reservations occur **before AI calls**.
Repeated IDs reconcile current results without a second call; changed text,
stale revisions and concurrent different submissions are blocked. Failures,
invalid output, abandoned calls and restarts conservatively consume attempts.
Pending attempts expire after 90 seconds as failed; never auto-retry or refund.
Opening preparation also uses the existing 5/hour/connection and 100/day
generation limits. Live responses share the existing configurable UTC daily
cap with Shared Adventure in the same database row.

Every personal API operation, including resume, uses `requireCreatorAccess`.
My Story has a code field kept **only in page memory**, never browser storage.
The library saves a private journey capability, transcript and snapshot;
server storage holds only its hash. Resume/reconcile requires the code and
capability and makes zero provider calls. Cross-tab focus/storage changes and
uncertain requests disable sending until explicit reconciliation. An
interrupted opening retains its ID/capability under
`muse-personal-journey-preparation` so it can be reconciled after reload.
Browser entries remain local plaintext, not accounts or cloud backup.
Server sessions have no automatic expiry. Removing browser
entries does not reset or delete server allowance.

Choose **Free choice** (typed or reviewed dictated actions) or **Suggested
choices** (3-5 action buttons) before creating a journey. Both modes narrate
meaningful consequences using one AI call per response. Suggestions are generated
within that same call, with no extra request; final conclusions offer no actions.
The selected mode is immutable server data. Only the offered actions can be
submitted in suggested mode, and stale or arbitrary submissions cannot reserve
new paid attempts. Choice mode and current actions survive library saves and
resume on both SQLite and Supabase; they are projected from the stored JSON, so
no additional choice-mode SQL migration is needed. Older personal journeys and
live shared adventures default to free choice. Existing classic shared mysteries
keep their prepared linear trail, clearly labelled separately; creators must
opt into live free/suggested interactions and approve their total budget.

Free responses may be typed or dictated with the same browser interaction hook
as Shared Story, selected language, editable text and explicit recognition
errors. No paid speech service is called for dictation. Narration reuses
the existing stable warm browser speaker, remembered preferences and
pause/resume controls; hardware transcription/audibility are not guaranteed.

**Hosted rollout (operator action, not performed by tests):** after reviewing
Muse-only names, apply `supabase/shared-stories.sql`, then
`supabase/shared-adventures.sql`, then the new incremental
`supabase/personal-journeys.sql`. Configure service-role storage, the private
creator code, provider and the same daily action cap on every instance.
The new RPC/tables are RLS-enabled and service-role-only and touch no iVote
objects. A missing journey migration fails closed before generation. Run a
service-role integration smoke test before deployment. No dashboard changes,
migrations, deployment, paid generation, commit or push are part of the
offline journey verification.

Run `npm run test:personal-journey` for actual handler + SQLite tests with a
mock provider: all four durations/endings, immutable inputs, concurrency
(including separate processes), idempotency, abandoned/failed attempts,
restart persistence, shared UTC cap, library/legacy compatibility and
private response projection. Supabase RPC transport/grants/locking contracts
are checked offline; actual PostgreSQL execution remains a rollout check.

## Profile memories and browser story library

Myself keeps up to 20 memories in this browser. Add new details, edit a memory,
remove one, or choose **Forget everything in my profile**. Edits/removals are
saved explicitly; full or blocked browser storage produces a visible message
and leaves the previous saved profile unchanged. Damaged stored memories are
reported rather than silently erased. Forgetting profile memories does not
erase existing stories or retract information already sent to a provider.
Only the latest five memories are included in new My Story requests by default.
Users can leave them out in creation; explicit AI-processing consent is still
required before anything is sent to the story provider.

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

Only the latest five saved key points are sent by default; users can uncheck
inclusion before consenting to creation. The current need, latest action and bounded prepared
plan/state/recent-narration context are sent to the provider (legacy
continuations still use bounded visited scenes). No raw profile or unbounded chat history
is included. Existing saved template stories remain playable locally;
new generation failures do not replace them with an undisclosed template.

Audio remains a separate optional interaction using Google WaveNet, legacy
ElevenLabs or explicit device voices; Haiku produces text, not speech.

## Adaptive browser narration for local testing

Use `NEXT_PUBLIC_NARRATION_PROVIDER=browser` for testing without narration
credits or another account. This explicitly bypasses the cloud TTS route.
Changing this public setting requires rebuilding/restarting the app.

Browser speech starts directly from the Listen tap, without waiting for ambient
audio initialization, to preserve iPhone Safari's user activation. Background
audio is optional and never blocks the voice. Playback errors are visible in
Shared Story even when audio settings are collapsed. Real-device listening
still requires validation; a desktop/mobile-sized browser is not an iPhone test.

The creator preview offers **Create new story** (blank brief) and **Reuse this
brief** without waiting for recipients to finish. Both save the current story
to Story Library first and leave its recipient link/progress unchanged. New
stories need fresh AI consent and media must be attached separately. If browser
storage cannot save the current story, the preview stays open with an error so
the creator can preserve its private management link.

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
the story, without another paid AI request. New browser preferences default
to **Follow this story (recommended)**. Expressive delivery uses local rules for
small sentence-level pace, pitch and volume changes, reflecting story style,
current progress, questions and quieter moments, with a softer conclusion.
The ranges are deliberately gentle (pace 0.86-1.12, pitch 0.96-1.06); browser
engines can ignore these controls and cannot guarantee human emotional delivery.
Turning expressive delivery off restores constant preset pace and natural pitch.
Automatic voice selection
stays stable across moods, respects the story locale, and prefers voices labelled
natural/neural/enhanced/premium, then the device default and gentle fallbacks.
Voice names are hints, not a guarantee of audio quality. Manual voice choices
take precedence. The recommended voice favors natural/enhanced matches and
known preferred voices instead of automatically trusting a device's default.
Preview another voice, or use **Use best available voice for each story** to
clear a manual selection while keeping the selected language.
Existing saved choices, including the previous Warm default, remain intact.

Immersive pacing and the default **Follow scene** soundscape are enabled for
new settings. Auto detects simple rain, wind, water, outdoor, crowd/cafe, traffic
and mystery cues in the text currently being spoken; it does not inspect private
answers, future scenes or creator briefs. Unmatched scenes have no background
sound. These are local Web Audio synthesis, not realistic field recordings,
downloaded assets or paid AI sound effects. The crowd and traffic options are
abstract filtered textures; the mystery option is a quiet synthetic tonal bed,
not a composed song.
Choose a fixed soundscape or Off, and adjust independent voice/background levels.
The background is softly faded in and reduced beneath speech, never starts
before a Play gesture, and works with device narration, cloud narration and
prepared Studio recordings. It stops with narration, scene changes, dictation or
leaving the page. Pausing suspends it. Audio failures are visible and leave text readable.
Settings are remembered separately under `muse.narration.immersive.v1`; changing
them stops playback before the next listen. Unsupported Web Audio falls back
explicitly to voice-only. No new account, environment variable or database
migration is required. Run `npm run test:narration` and `npm run test:ambience`.

This free immersive mode does not enable premium narration or run paid comparisons.
The legacy operator-configured ElevenLabs mode remains separate and still
incurs generation costs per request; do not use it for production recipients.
Shared Story instead uses the optional private, cached Studio path above,
which requires its own migration, opt-in and lifetime character reservation cap.
Realistic licensed crowd/footstep recordings and premium voice comparison remain
future work; no commercial quality claim is made for local synthesized ambience.

Narration can be paused and resumed, or stopped to restart from the beginning.
Style, language and manual voice preferences are remembered locally; keeping
style on **Follow this story (recommended)** preserves story choice for each new story. The browser voice
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

The shared success message is text-only. HTML and Markdown image syntax are
displayed as literal text, never loaded as pictures. Muse has no gallery picker
or photo attachment in this flow. Rendering regression tests cover image markup
and media URLs; an unexpected picture still needs the affected page or a
redacted screenshot to identify its source.

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
use a private window to test a fresh recipient session. If the saved session
cannot be restored, Muse starts a new one and explains that earlier progress
may be unavailable; clearing site data also removes the saved session.
Choose the contact and confirm sending in
that app; Muse does not automatically send messages. Share payloads include
only a generic invitation and the recipient capability link, not the
management link, secret answer, or final message. Anyone with the link,
including someone it is forwarded to, can play until it is replaced/deleted.

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

- `npm run test:personal-journey` - 23 mocked-provider checks using actual
  handlers and SQLite, including cross-process concurrency/restart, all
  durations and final narration, failure charging, immutable state, shared
  UTC limits, browser-library compatibility and offline Supabase RPC contracts.
  This is not a comprehensive Shared Adventure suite or a live PostgreSQL test.

- `npm run test:shared` - both story areas, provider contracts, bounded
  progression, privacy projection and APIs using mocked provider/database calls.
- `npm run test:sqlite` - real temporary SQLite storage, durable progress,
  rate limits, deletion, expiry and local configuration guards.
- `npm run test:sqlite:production` - actual built Next server SQLite loading
  and progress persistence across a server restart, plus a real HTTP photo
  upload and solved-only reveal, with external calls blocked.
- `npm run test:media` - final photo/video reveal: declarations rejected
  before AI, no media metadata in prompts, upload binding (creator code,
  story, secret, exact type/size, single use), byte signatures, unsolved and
  other sessions denied, replacement/cancel/removal/delete/expiry cleanup,
  attempt and rate limits, and the Supabase signed-URL store (mocked).
- `npm run test:narration` - adaptive styles, voice matching, playback lifecycle and sharing payloads.
- `npm run test:core` - profile memory CRUD/storage failures and complete personal-story AI response schemas.
- `npm run test:dictation` - name dictation, readiness, language and recognition error handling.
- `npm run test:library` - browser library persistence, migration and validation.
- `npx --no-install tsc --noEmit` - TypeScript.
- `npm run build` - production build.

## Hosted configuration checklist

### Operational baseline

Apply `supabase/operations.sql` after the existing journey/media migrations
**before deploying this release**. Missing operational storage fails closed:
no provider call is made without a durable reservation.

- All paid story requests and generic cloud narration cache misses share
  `MUSE_AI_DAILY_ATTEMPT_CAP` (default 100, allowed 1-100) across instances.
  Failed calls count. The 80% warning and exhaustion events appear in server
  logs and `/operations`, protected by the creator access code.
  This caps attempts, **not dollars**. Set provider-account billing/spending
  controls separately; model pricing and text lengths still affect cost.
- Requests are bounded to 120/minute per connection; failed creator access to
  20/10 minutes; browser error reports to 5/minute. Limits are atomic in
  Supabase/SQLite, with `Retry-After`. This is not a replacement for network
  DDoS protection or platform firewall settings.
- Error reporting stores only fixed event codes and timestamps, deduplicated
  per minute and retained for seven days. No story text, URLs, capabilities,
  IP addresses, stacks or exception messages are reported. Rate limits store
  address hashes (keyed in hosted mode) until their window expires. Alerts are operator-pulled;
  no email, webhook or third-party telemetry destination is configured.
- `/privacy`, `/terms` and `/support` describe current data handling and
  deletion. Set `NEXT_PUBLIC_MUSE_OPERATOR_NAME` and
  `NEXT_PUBLIC_MUSE_SUPPORT_EMAIL`, rebuild, and review the draft terms/privacy
  for your actual jurisdiction before public invitations.
  AI generation and live actions require an unchecked processing-consent
  checkbox, enforced by a versioned field on the server before any paid
  reservation. Consent is not stored. Reading, hints, guessing and deletion do
  not require AI consent. Enabled cloud narration has a separate, session-only
  opt-in to send spoken text to the configured Google/ElevenLabs provider.
- The personal-journey deletion API removes the capability-bound server journey and dependent
  requests, without resetting aggregate spending/abuse allowances. Shared Story
  management deletion continues to invalidate links and queue media cleanup.
  Existing browser copies on other devices and AI-provider records are not
  remotely erased. Expired data is inaccessible, but physical cleanup is still
  request-triggered; no scheduled deletion guarantee is claimed.
- Follow [the encrypted backup procedure](docs/BACKUPS.md). Tooling is not proof
  that production backups are scheduled or recoverable. Configure a private
  destination, encryption key and retention, and complete a restore rehearsal.
  `MUSE_BACKUP_LAST_VERIFIED_AT` is explicitly an operator-attested timestamp,
  not an independently verified guarantee. Public-beta readiness remains blocked.
  `MUSE_MAINTENANCE_MODE=true` pauses story APIs without clearing browser drafts.
  Drain active requests and any outstanding signed uploads before backup; merely
  setting a flag does not stop requests already in flight or issued storage URLs.

Validate controls with `npm run test:operations`.
Run `npm run test:privacy` and `npm run test:backup` for consent/contact and
encrypted database/private-media backup fixtures; they do not access production.
After applying the migration, run `supabase/operations-smoke.sql` as the database
administrator. Its fixture changes roll back; automated local tests do not
claim that the hosted migration has been applied or tested.

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
