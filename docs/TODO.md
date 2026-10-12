# Muse - TODO

## Current product direction

Exactly three areas: **Myself**, **My Story**, **Shared Story**.
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
- [ ] Later hosted setup only: create/confirm Muse Supabase and apply the SQL migration
- [x] Change local LLM_PROVIDER to ANTHROPIC without touching existing secrets
- [x] User added ANTHROPIC_API_KEY locally (key not printed or committed)
- [x] Select STORY_STORAGE=sqlite locally to avoid database registration for testing
- [x] Verify real SQLite persistence after restarting the built Next server
- [x] Verify one real Claude Haiku My Story generation locally (HTTP 200, three scenes)
- [ ] Later hosted setup only: configure Supabase service-role and ANTHROPIC_API_KEY in Vercel, STORY_STORAGE=supabase and LLM_PROVIDER=ANTHROPIC
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

- [x] Select explicit browser narration mode locally (no cloud narration calls)
- [x] Automated narration metadata/voice selection regression checks and production build/restart smoke
- [x] Browser verification: six style overrides, language-matched installed voices, preview/stop and no cloud TTS requests
- [x] Live Claude narration metadata check: relaxed English story returned calm/en-US and three scenes (HTTP 200)
- [ ] User listening evaluation: calm/warm/curious/adventurous/playful/suspenseful presets
- [ ] Optional later: repair ElevenLabs key (catalog check returned HTTP 401) before using cloud narration

- [ ] Add scheduled expired-story/session cleanup (current cleanup is request-triggered)
- [ ] Add stronger abuse protection and provider spending alerts
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
