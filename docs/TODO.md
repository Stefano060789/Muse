# Muse - TODO

## January 2027 public-beta target

Target a limited, free public web launch by **31 January 2027**. The deadline
does not require subscriptions, advertising, cycle-sensitive features, or a
native app. Confirm current hosted configuration and actual product scope:
this TODO tracks the active Myself/My Story/Shared Story implementation, while
older planning and marketing documents describe a different product direction.

- [ ] By 23 October 2026, freeze the minimum public scope and choose/clear a
      public product name; "Muse" remains an internal codename with documented
      naming conflicts.
- [ ] Before public invitations, verify production Supabase/Vercel settings,
      migrations, access controls, backups, error reporting, API/provider
      spending limits and alerts; never expose service-role credentials.
- [ ] Complete privacy, terms, AI-provider/data-processing, capability-link,
      retention/deletion, and support-contact reviews for the features actually
      included. Do not release cycle-sensitive features or advertising without
      their separate privacy/legal approval.
- [ ] Run closed user tests by 15 December 2026, including story quality,
      clue-solvability, accessibility/mobile usability, and feedback on
      approximate session durations; fix launch-blocking defects.
- [ ] Make a go/no-go decision by 15 January 2027 and release the free public
      web beta by 31 January only if privacy, security, reliability, and
      provider-cost gates pass.
- [ ] Validate engagement and operating cost after the free beta before
      choosing paid features, price, customer countries, or a billing provider.

## Current product direction

Exactly three areas: **Myself**, **My Story**, **Shared Story**.
The home screen prioritizes two story-creation choices; Myself is optional.
Written and audio interaction belong inside these areas; audio is not a
fourth area. Older daily wellness and daily couple-beat plans are not the
current MVP.

## Shared Story: creator to recipient

- [x] Replace mutual couple storytelling with a creator brief and recipient mystery
- [x] Capture names, narration style, setting, recipient-specific hints and goal
- [x] Capture an exact private answer and the message revealed after solving
- [x] Offer approximate durations of 5, 10, 15 and 20 minutes
- [x] Implement Claude Haiku 5.5 generation (OpenAI/Groq optional) with validated scene count and narration length
- [x] Separate creator preview/management from recipient play
- [x] Add private server storage, separate random link capabilities and RLS migration
- [x] Return the final message only after server-side correct-answer verification
- [x] Support editable dictation and optional narration within Shared Story
- [x] Add durable generation/guess rate limits and explicit provider/storage errors
- [x] Allow recipient-link replacement and permanent creator deletion
- [x] Confirm hosted Muse storage in the approved shared iVote Supabase project
      and apply the base Muse SQL migration; rollback smoke passed
- [x] Change local LLM_PROVIDER to ANTHROPIC without touching existing secrets
- [x] User added ANTHROPIC_API_KEY locally (key not printed or committed)
- [x] Select STORY_STORAGE=sqlite locally to avoid database registration for testing
- [x] Verify real SQLite persistence after restarting the built Next server
- [x] Verify one real Claude Haiku My Story generation locally (HTTP 200, three scenes)
- [x] Configure hosted Vercel storage/provider settings: STORY_STORAGE=supabase
      and LLM_PROVIDER=ANTHROPIC; operator added the service-role and Anthropic
      secrets privately (initial setup complete, current readiness review below)
- [x] Validate a real AI-generated story and private share with two browser sessions
- [ ] Validate actual 5/10-minute experiences with people; estimates are not timers
- [ ] Review clue solvability, answer wording and recipient comprehension

## Myself and My Story

- [x] Preserve local profile/key points and voice input in Myself
- [x] Preserve My Story mood selection, narration and existing saved template stories
- [x] Generate new My Story scenes and answer-driven continuations with Haiku
- [x] Bound My Story to three scenes and at most three paid requests without automatic retries
- [x] Require opt-in before forwarding up to five Myself key points
- [x] Specify complete narration metadata in My Story generation/continuation output schemas
- [x] Report storage failures instead of crashing Myself saving
- [x] Edit/remove individual profile memories and forget the local profile
- [x] Report unavailable/failed personal-story voice input explicitly
- [x] Verify live My Story creation and both Claude continuations (HTTP 200), final reflection and reload
- [x] Verify library migration/local deletion in automated checks and live personal/shared reopening
- [x] Verify live creator-assisted hint persistence and approved alternative answer reveal in a separate recipient browser
- [x] Verify bounded narration selectors at 320/390px, actual browser pause/resume and preference persistence
- [x] Verify blocked profile storage and unsupported personal dictation show errors without uncaught exceptions
- [ ] Consider cross-device profile/story storage only after the prototype is validated

## Before public launch

### Optional romance rollout

- [x] Add Sweet / Spicy non-explicit romance to personal and shared creation,
      persist settings and preserve adult/consensual fade-to-black boundaries
      in authoritative continuations
- [x] Verify creator acknowledgment and recipient notice/decline/explicit
      opt-in before any cover, scene, reveal or media; legacy access unchanged
- [ ] Review production moderation, sender uploads, reporting and age/consent
      requirements before public promotion; self-declaration is not age
      verification and prompt instructions are not complete moderation
- [ ] Validate boundaries and localized notice comprehension with adult testers
      across all five languages; no explicit-content support promised
- [ ] Commit/push and verify hosted romance behavior after local validation;
      JSON metadata requires no new migration

### Billing preview

- [x] Add a minimal responsive Plans & Billing page linked from home with
      proposed Free, EUR 3.99 Gift, EUR 8.99 monthly Plus and EUR 89.99 annual
      Plus (annual planned for later); 10 creations / 120 interactions monthly
- [x] Clearly disable purchasing and disclose unchanged prototype access,
      excluded premium narration and existing 30-day server access
- [ ] Before paid launch, confirm final prices, taxes, cancellation/refund
      terms, customer identity, payment provider and measured delivery costs
- [ ] Implement verified checkout/webhooks and atomic server-side allowances
      before offering purchases; never trust browser storage for entitlements

### Minimal onboarding and app readiness

- [x] Simplify home to two creation paths, a fictional free sample and optional
      Myself; retain direct Story Library access
- [x] Add a handcrafted two-scene demo with browser-only narration; no paid
      generation/TTS or persistent story required
- [x] Add install metadata, original icons, browser/iPhone installation
      guidance and a production network-only worker; no private offline cache
- [x] Add a quiet recipient-to-creator handoff after reveal without copying
      the private link, content or recipient progress
- [x] Add local pre-send scene review, answer/attachment confirmations and
      pending-upload, missing-reveal and expiry guards; no AI preview calls
- [x] Add explicit English, Mandarin Chinese, Hindi, Spanish and Arabic story
      languages, language-preserving continuation and localized recipient
      instructions; scope Arabic RTL to story content
- [x] Pass focused automated checks, TypeScript and production build; browser
      checks cover 320/390px and desktop home, complete sample without API
      calls, Arabic RTL/handoff/draft restore, pre-send gating/management
      access, and worker registration with no offline CacheStorage entries
- [ ] Verify this release on the hosted deployment after commit/push;
      no new SQL migration is required for language JSON metadata
- [ ] Verify real Android installation and iPhone Add to Home Screen,
      standalone launch and actual device voices/dictation; keep internet
      requirement and browser-local storage limitations visible
- [ ] Test generated clue quality and naturalness with speakers of all five
      languages; mocked validation is not multilingual quality certification

### Gift experience rollout (15 October 2026)

- [x] Add occasion-led prompts and a minimal, mobile-friendly three-step
      creator flow; existing custom briefs remain supported
- [x] Add a recipient gift cover with dedication and explicit opening;
      no autoplay or private story text in link previews
- [x] Add browser-local written draft autosave, restore/discard and explicit
      storage-failure feedback; files, recordings and consent are not restored
- [x] Add an isolated printable keepsake excluding answers, links, replies
      and media; the final message requires explicit inclusion
- [x] Complete and validate private final voice storage and opt-in recipient
      replies in SQLite and hosted migration code; automated authorization,
      bounded duration/size, isolated media slots and reply retry checks pass
- [x] Validate gift UI at 320/390px and desktop, draft quota failure,
      restore/discard, private keepsake defaults, voluntary reply retries and
      AudioWorklet recording with a synthetic audio stream; no paid AI calls
- [x] Pass production build and real built-server SQLite HTTP smoke for
      independent photo/WAV upload, locked/revealed voice access, private
      replies in management and persistence across server restarts
- [x] Apply the gift migration (user confirmed) and run the corrected rollback
      smoke successfully on 15 October 2026; verified permissions, RLS,
      private WAV bucket, voice activation/attempt cap, reply idempotence,
      cascade cleanup and independent photo slot; fixtures rolled back
- [ ] Verify voice/reply access controls in separate hosted browser sessions
- [ ] Validate real-device recording, listening and print/PDF on iPhone and
      Android; browser simulation and synthetic audio are not hardware tests

### Shared library and forgiving reveal rollout (15 October 2026)

- [x] Apply `supabase/shared-story-help.sql` and run its rollback-only smoke
      before deploying the matching code; both succeeded on the hosted Muse
      tables on 15 October 2026, separately from operations SQL
- [x] Verify opt-in skip, default solve-only stories, same-browser resume and
      private photo/video access in hosted separate recipient sessions
      (user confirmed complete on 15 October 2026)
- [x] Verify shared library copy/reuse/expiry
      (user confirmed complete on 15 October 2026)
- [ ] Verify actual iPhone Safari listening; desktop viewport tests are not
      real-device validation
- [x] Complete shared, SQLite, private media, library, gateway, interaction and
      narration regressions plus production build and built-server persistence
      smoke after resolving local system-memory pressure
- [x] Commit/push the shared-library and optional-reveal release (`8b74ade`);
      remote main verified on 15 October 2026
- [x] Confirm successful production deployment of the latest release
      (user confirmed complete on 15 October 2026)
- [ ] Verify playback of a real device-recorded video reveal; hosted upload,
      byte integrity and photo reveal passed, but synthetic video playback
      did not establish working real-video playback

### Production safety rollout and deferred backups (14 October 2026)

- [x] Implement and locally verify the 100 paid AI attempts/day cap, warning at
      80, abuse throttles, maintenance controls and private operations dashboard
- [x] Implement fixed-code redacted error reporting, explicit AI/cloud-voice
      consent, draft privacy/terms/support pages and personal-story deletion
- [x] Implement and test encrypted Muse-only database/private-media backup and
      archive-verification tools; these are not configured production backups
- [x] Apply the operations database migration (operator reported complete)
- [ ] Run the operations migration rollback smoke and verify hosted grants,
      counters and alerts without paid provider calls
- [x] Commit/push the safety release (`d9883af`); remote main verified
- [ ] Confirm the deployed safety release and verify hosted controls,
      consent/deletion flows and private operations access
- [ ] Configure real operator/support details and complete legal/privacy,
      consent, retention/deletion and recovery reviews before public invitations
- [ ] Decide how operators receive proactive failure/spending alerts; current
      alerts are server logs and the private dashboard, not email notifications

Backups are deferred by request. A dedicated private folder on this Windows
computer was chosen for initial setup; no backup job or destination is configured.
See [BACKUPS.md](BACKUPS.md) for prerequisites and recovery constraints.

- [ ] Install compatible PostgreSQL command-line tools (`psql`, `pg_dump`,
      `pg_restore`) and make them available to the backup execution account
- [ ] Configure a dedicated private backup directory outside the project,
      protected database/media credentials and an encryption key with a
      separately secured recovery copy; never commit or paste secrets into chat
- [ ] Enforce deployed maintenance mode, drain/pause all relevant writers and
      make the first full database + ready-private-media backup
- [ ] Verify the encrypted archive and media integrity; archive verification
      alone does not prove a successful restore
- [ ] Establish a reviewed private recovery procedure and rehearse restoration
      into an isolated database/private media store, with no paid AI calls;
      verify access controls and reconcile current deletions/expiry before access
- [ ] Schedule daily nonoverlapping backups and verification with Windows Task
      Scheduler, seven-day initial retention, failure/missed-run alerts and
      capacity/last-success monitoring; the computer must be on
- [ ] Keep an approved encrypted off-device copy and test periodic recovery;
      same-computer backups do not protect against computer/disk loss

- [x] Select explicit browser narration mode locally (no cloud narration calls)
- [x] Automated narration metadata/voice selection regression checks and production build/restart smoke
- [x] Browser verification: six style overrides, language-matched installed voices, preview/stop and no cloud TTS requests
- [x] Live Claude narration metadata check: relaxed English story returned calm/en-US and three scenes (HTTP 200)
- [ ] User listening evaluation: calm/warm/curious/adventurous/playful/suspenseful presets
- [ ] Optional later: repair ElevenLabs key (catalog check returned HTTP 401) before using cloud narration

- [ ] Add scheduled expired-story/session cleanup (current cleanup is request-triggered)
- [x] Add stronger abuse protection and provider spending alerts locally
      (production rollout and proactive delivery tracked above)
- [ ] Review capability-link privacy, speech-provider processing and consent
- [ ] Add identity/invitations only if user validation demonstrates the need
- [ ] Decide whether a completed private archive is useful; do not assume a daily couple ritual
- [ ] Clear the public product name (Muse remains an internal codename)

## Validation

- [x] October 12 improvements: 83 automated checks across core/library/shared/SQLite/narration, TypeScript, production build and restart smoke
- [x] Live profile memory save/edit/remove/forget browser flow

- [x] Run 27 mocked regression checks and TypeScript/production build for the Haiku integration
- [x] Run nine real SQLite checks and built-server restart/persistence smoke
- [x] Verify a real Haiku call after credentials are configured
- [ ] Evaluate narrative quality and clue solvability with real users
- [x] Verify live creator generation/preview, separate recipient progress, wrong/correct answers, link replacement and deletion in the browser
