# Muse — TODO

Near-term, imminent activities only. Longer-term phased work lives in
[PLANNING.md](PLANNING.md). This file is meant to be edited often — check off
or delete items as they're resolved, add new ones as they surface.

## Blocked / needs a decision

- [ ] **Vercel deployment blocked.** Vercel recognizes
      `Stefano060789/Muse` and the framework (Next.js) correctly, but the
      import page's Deploy button stayed disabled and the project/env-var
      controls weren't reliably interactable in the shared browser session.
      Next attempt: retry directly from
      https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FStefano060789%2FMuse,
      or provide a Vercel access token so deployment can go through the
      Vercel CLI/API instead of the browser UI.
- [ ] **Naming decision.** Confirm whether to start a rename now or continue
      building under the "Muse" codename until closer to launch. A proper
      trademark clearance search should happen before public launch either
      way (see [SCOPE.md](SCOPE.md#naming-risk)).

## Ready to start (Phase 1 — core habit loop)

- [ ] Design the onboarding data model: how "favorite books/movies/poems" get
      captured and mapped to inferred themes (tags), without storing raw
      copyrighted text as prompt fodder
- [ ] Add `tone_preference`, theme/interest fields, and cycle opt-in fields to
      the `profiles` table
- [ ] Create the `reference_quotes` table (text, source, author, theme tags,
      mood tags, `is_public_domain` flag) and seed it with an initial
      public-domain quote set
- [ ] Update [src/lib/ai.ts](../src/lib/ai.ts) to accept `tone` and `themes`
      parameters and to optionally splice in a reference quote
- [ ] Build the auth + onboarding UI (Supabase Auth)
- [ ] Build the daily message screen with the tone selector
      (funny / motivating / deep)
- [ ] Add the `/api` generation route wiring the above together
- [ ] Add basic message history (read-only list)

## Not started yet (do not begin before Phase 1 is working end-to-end)

- Commonplace Book (save/favorite + reflection reply) — Phase 2
- ElevenLabs audio + rituals — Phase 3
- Cycle-phase tone bias — Phase 4
- Stripe billing — Phase 5
- Recommendation coda — Phase 6
- Annual recap + printed keepsake — Phase 7
- Narrative arcs — Phase 8

## Housekeeping

- [ ] Resolve `npm audit` findings (1 high, 1 critical reported at initial
      `npm install`) — check before adding more dependencies
- [ ] Keep `.env.local` and all provider secrets out of Git (already
      `.gitignore`d — verify before every commit that touches env handling)
