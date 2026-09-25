# Muse — Planning

This breaks delivery into phases with concrete milestones. Each phase should
be functionally usable end-to-end before moving to the next — resist adding
scope from a later phase early. Full feature detail lives in
[SCOPE.md](SCOPE.md); market rationale lives in [MARKETING.md](MARKETING.md);
near-term actionable items live in [TODO.md](TODO.md).

## Phase 0 — Infrastructure foundation (done)

**Milestone:** hosted services exist and are connected.

- [x] GitHub repository created (`Stefano060789/Muse`)
- [x] Supabase project created (`owhaqypvmonzdcikipay`), schema + RLS applied,
      private `tts` storage bucket configured
- [x] Local `.env.local` configured with Supabase URL/key
- [x] Vercel project connected and first deployment live

## Phase 1 — Core habit loop (MVP)

**Milestone:** a real user can sign up, describe their taste, pick a tone,
and receive one personalized daily message end-to-end, in production.

- Auth (Supabase Auth) + minimal onboarding: name, favorite
  books/movies/poems → inferred themes, default tone, optional cycle opt-in
- Daily message generation combining voice archetype + tone selector
  (funny/motivating/deep) + taste-derived themes
- Reference Library v0: a small seeded table of public-domain quotes tagged by
  theme/mood, wired into generation
- Message history view (read-only)
- **No** audio, rituals, payments, or cycle-phase logic yet — text-only,
  free-tier-only

**Why this phase first:** validates the single riskiest assumption — that
taste-personalized daily text is compelling enough to open the app daily —
before investing in anything else.

## Phase 1A — Shared Story Mode (Couples / long-distance)

**Milestone:** a couple can create and complete a private, asynchronous story
experience together without relying on external SaaS infrastructure.

This is the first major Muse extension aligned with the "couple while apart"
use case: it turns daily messages from a solo ritual into a shared narrative
world. The experience should feel intimate, atmospheric, and low-friction — not
like a board game and not like a generic chat app.

### Product concept

- One partner creates a short private story arc, called a **Shared Story** or
  **Love Quest**.
- The other partner receives the arc in daily or timed instalments.
- Each instalment contains:
  - a short atmospheric paragraph
  - a clue, object, or memory to discover
  - a question or reflection to answer
  - optional audio or voice-note layer
- The story can be themed around a shared memory, a future trip, an imagined
  place, a mystery, or a personal history together.
- The discovery logic is intentionally simple: the user is not "fighting" a
  system; they are uncovering a meaningful hidden narrative.

### Experience design

- **Narrative templates** (v1):
  - "The Letter in the Drawer"
  - "The Missing Key"
  - "The Map to Our Next Place"
  - "The Memory Garden"
  - "The Summer We Never Had"
- Each story has 5-10 beats, each with one clear reveal or emotional payoff.
- Story state is stored as a structured timeline with unlocks, responses, and
  collected objects.
- The archive becomes a living shared "Our Story" record for the couple.

### Core mechanics

- Couple profile: two users linked by invite or local pairing code
- Story arc creator: one user sets the arc, tone, pacing, and final reveal
- Story path: read daily, unlock clue, solve small mystery, submit answer or
  reaction
- Shared artifact library: saved letters, found items, voice notes, images,
  place references, memories
- Final reveal: the story resolves with a personal message, shared plan, or
  future promise

### MVP rules

- No monster manuals, no combat, no worldbuilding tax
- No complex inventory system
- No social feed or public sharing
- Everything stays private to the couple
- The narrative should feel like a poetic, low-pressure experience, not a game
  system

### Local-first implementation approach

**Recommended for the next phase:** keep this local-first, not Supabase-first.

- Use a local SQLite database stored on disk (for example under a project data
  folder such as `C:\Users\bonomi\Desktop\Muse\data\muse.db`)
- Use a local app server for the initial prototype, with an app-specific data
  directory and a simple migration layer
- Keep user profiles, couple links, story arcs, beats, replies, and saved
  artifacts local while validating the product
- Later migrate the same schema to Supabase when the product is more mature and
  the cloud backend is needed

This avoids paying the cost of a cloud dependency while the story system is
still being prototyped.

### Suggested technology stack for MVP

- Next.js 14 + TypeScript
- SQLite (via Prisma or Drizzle)
- Local filesystem storage for generated assets and user uploads
- Optional local passkey or simple invite-code pairing for the couple flow
- AI generation stays optional and focused on the text layer only

### Required external registration / setup for now

**For MVP local-first:** no cloud registration is required beyond normal local
software installation.

**If we later move to hosted production:**
- Supabase project for auth, database, and storage
- Vercel for hosting
- Stripe only when monetization begins
- ElevenLabs only when audio narration is added

This keeps the first implementation lean, private, and fast to iterate.

### Migration target after validation

The schema should be designed from the start to map cleanly to Supabase tables
such as:

- `profiles`
- `couples`
- `story_arcs`
- `story_beats`
- `story_replies`
- `story_artifacts`
- `saved_messages`

That means the local-first prototype can still be migrated later without a
rewrite of the product model.

## Phase 2 — Retention layer

**Milestone:** users can build a personal collection and the product has a
reason to be opened beyond the daily ping.

- Save/favorite → Commonplace Book view
- One-line reflection reply per message
- Shared-story archive for couples
- Basic engagement notification (daily reminder, respecting quiet hours)

## Phase 3 — Voice and rituals

**Milestone:** the Plus-tier experience is complete.

- ElevenLabs TTS generation, private per-user audio in the `tts` bucket,
  signed URL playback
- Ritual content model + 30–60s guided ritual UI (morning/evening/grounding/
  reset)

## Phase 4 — Cycle-aware personalization

**Milestone:** cycle-phase tone-shifting works end-to-end under the binding
legal constraints in [SCOPE.md](SCOPE.md).

- Manual cycle input (last period date + typical length), opt-in only
- Phase-derived tone bias in generation (never surfaced as health insight)
- Verify no analytics/ad SDK touches this data path; one-tap deletion

## Phase 5 — Monetization

**Milestone:** Muse can charge money and manage subscriptions correctly.

- Stripe products/prices for Free + one paid tier (per
  [MARKETING.md](MARKETING.md) pricing)
- Checkout + webhook sync to Supabase `profiles`
- One-tap cancellation flow (compliance requirement, not optional)

## Phase 6 — Recommendation coda

**Milestone:** the daily message can end with a real, verified book/film
suggestion.

- Integrate Google Books / Open Library and/or TMDB metadata APIs
- Recommendation logic grounded against verified titles only (never
  LLM-invented)
- Optional affiliate links (Bookshop.org / Amazon Associates / streaming
  affiliate)

## Phase 7 — Annual recap and keepsake

**Milestone:** Muse has a yearly reactivation and monetization moment.

- "Muse Wrapped"-style annual/seasonal recap + shareable card
- Optional printed "Year in Words" keepsake (print-on-demand fulfillment,
  one-time purchase)

## Phase 8 — Narrative arcs ("Muse Stories")

**Milestone:** the long-term differentiation moat is live.

- `story_arcs` / `story_beats` schema (authored skeletons, not LLM-invented)
- First hand-authored arc shipped and personalized per user (tone, voice,
  mood-adapted)
- Serialized delivery + continuity across days

## Phase 9 — Ecosystem growth

**Milestone:** Muse can scale beyond the founding team's own content.

- Companion chat (structured, non-therapeutic, crisis-resource redirect)
- Creator marketplace (external writers/voice artists, revenue share)
- Mobile app via Expo

## Sequencing principles

1. Don't build Phase *N+1* before Phase *N*'s milestone is genuinely met in
   production with real users — this roadmap exists specifically to prevent
   the original 7-pillar scope from being built simultaneously.
2. Re-validate before Phase 3 (Voice/Rituals) that the core text loop actually
   retains users — if it doesn't, fix Phase 1/2 before spending on
   ElevenLabs/ritual content production.
3. Do not begin Phase 8 (Narrative arcs) until there's a content budget or
   founder time explicitly allocated to writing — this phase has real
   production cost, unlike prompt-only generation.
4. Complete the naming/trademark decision (see [SCOPE.md](SCOPE.md#naming-risk))
   before any public launch, ideally before Phase 5 (Monetization) so billing
   and legal entity setup use the final name.
