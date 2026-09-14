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
- [ ] Vercel project connected and first deployment live (currently blocked —
      see [TODO.md](TODO.md))

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

## Phase 2 — Retention layer

**Milestone:** users can build a personal collection and the product has a
reason to be opened beyond the daily ping.

- Save/favorite → Commonplace Book view
- One-line reflection reply per message
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
