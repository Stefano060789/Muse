# Muse — TODO

## Immediate next steps

### 1. Local-first couples story MVP

- [x] Define the idea and product boundaries for a couple-focused story mode
- [x] Add a local-first story template model and page prototype
- [ ] Replace the hardcoded localStorage-only flow with a proper persisted local data layer (SQLite/Prisma or Drizzle)
- [ ] Add a real couple/invite flow instead of the single-browser mock state
- [ ] Add a private story archive view after each completed story beat
- [ ] Add a final reveal / payoff screen for the story arc

### 2. Data and persistence

- [ ] Decide whether to use SQLite + Prisma or SQLite + Drizzle
- [ ] Create the schema for:
  - users
  - couples
  - story_arcs
  - story_beats
  - story_replies
  - story_artifacts
- [ ] Add migrations and seed templates for the first three story archetypes
- [ ] Keep the schema compatible with a later Supabase migration
- [x] Add a local Muse profile with saved key points for story personalization

### 3. Story engine

- [ ] Build a generator for daily beat unlocks based on story state
- [ ] Add support for sequence progression and beat completion
- [ ] Add a notion of “discovery” and “reply” for each beat
- [ ] Store the accumulated story history in a timeline view
- [ ] Create a simple prompt layer for customized story text from user preferences

### 4. UX improvements

- [ ] Add a landing view for “Daily Muse” and “Our Story”
- [ ] Add a couple onboarding flow with names and invite code
- [ ] Show story progress as a gentle daily ritual, not a game screen
- [ ] Add a more romantic visual system without making it too literal or cheesy
- [x] Add story-beat narration with ElevenLabs (or browser speech fallback)
- [x] Add browser voice answers with transcript review before saving

### 5. Validation

- [ ] Run the app locally end-to-end with two simulated users in the same browser
- [ ] Test multiple story templates and ensure the flow feels emotionally coherent
- [ ] Decide whether the couple feature is strong enough to become a v1 expansion
- [ ] Keep the local-first design until the product is validated, then migrate to Supabase

## Suggested order of execution

1. Decide local DB stack
2. Move the story data out of localStorage into SQLite models
3. Add couple onboarding and pairing flow
4. Add story continuation / daily beat engine
5. Add archive and reveal pages
6. Validate emotionally, not just technically

## Recommended technical stack for now

- Next.js 14
- TypeScript
- SQLite
- Prisma or Drizzle
- Local filesystem storage for attachments
- Keep Supabase out of the first pass unless you explicitly need hosted auth

## Success signal for the feature

The feature is working if a couple can:

- create a shared story arc
- receive a daily beat
- answer a prompt or discovery
- feel a sense of continuity across time and distance
- leave behind a private, meaningful archive of the relationship
