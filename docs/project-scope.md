# Muse — Project Scope

## Purpose

Muse is a personalized AI emotional-wellness companion that delivers short,
uplifting, narrative-driven daily messages. It combines LLM-generated
micro-content, voice personalization, ritual guidance, and optional
cycle-aware insights in an intimate, supportive experience.

Muse is a creative companion, not a therapeutic or diagnostic service.

## Core features

- **Daily personalized messages** generated with Groq or OpenAI and tailored by
  name, mood, genre preferences, cycle phase, and voice.
- **Voice archetypes** such as Gentle Poet, Stoic Guide, and Warm Storyteller,
  with optional ElevenLabs audio and signed private-storage URLs.
- **Rituals** consisting of 30–60 second morning, evening, grounding, and reset
  practices.
- **Cycle and rhythm intelligence**, opt-in only, with weekly insights and
  gentle forecasts.
- **Muse Stories**, including weekly or seasonal micro-stories and branching
  narrative choices.
- **Shareable cards** for exporting minimal message cards to social channels.
- **Insights dashboard** for mood trends, sentiment, voice usage, ritual
  engagement, and opt-in cycle insights.
- **Guided companion chat** for structured reflection and journaling prompts,
  with safe, non-therapeutic guidance.
- **Creator marketplace** as a future platform for voices, rituals, stories,
  seasonal drops, and revenue sharing.

## Technical architecture

### Frontend

- Next.js 14 and React 18
- API routes for message generation, TTS, feedback, and Stripe webhooks
- Components for onboarding, daily messages, rituals, cards, and insights

### Backend and integrations

- Supabase Auth, Postgres, Row Level Security, and Storage
- Groq or OpenAI for LLM generation
- ElevenLabs for optional TTS
- Stripe for subscriptions and microtransactions
- Vercel for hosting and deployment
- GitHub Actions for build validation

### Storage model

- `profiles` stores user preferences and consent flags.
- `messages` stores generated message history, voice, prompt hash, and feedback.
- Supabase Storage bucket `tts` stores private generated audio.
- Signed URLs are used when private audio is requested by an authorized user.

## Monetization

### Subscription tiers

- **Free:** daily text message
- **Plus:** rituals and audio mode
- **Premium:** insights, companion chat, and unlimited audio

### Future one-time purchases

- Voice packs
- Story packs
- Ritual packs
- Animated card templates
- Seasonal drops

## Initial delivery phases

### Phase 1 — Foundation

1. Connect the local Next.js app to the GitHub repository and Vercel project.
2. Select or create the Supabase project and apply the schema/RLS migration.
3. Configure environment variables in `.env.local` and Vercel without committing
   secrets.
4. Add authentication, onboarding, and a first daily-message screen.
5. Add the generation API route with provider-neutral LLM configuration.

### Phase 2 — Daily ritual loop

1. Add message history and like/dislike feedback.
2. Add voice archetype selection.
3. Add ritual data and a daily ritual experience.
4. Add optional ElevenLabs TTS and private `tts` storage.

### Phase 3 — Paid and insight features

1. Add Stripe subscriptions and webhook synchronization.
2. Add insights aggregation and dashboard views.
3. Add opt-in cycle and rhythm features.
4. Add companion chat with safety boundaries.

### Phase 4 — Narrative ecosystem

1. Add Muse Stories and branching choices.
2. Add shareable card export.
3. Add creator content, moderation, payouts, and marketplace capabilities.

## Safety and product boundaries

- Keep generated content uplifting, concise, and non-diagnostic.
- Do not present Muse as therapy, medical advice, or crisis support.
- Treat cycle-related data as optional sensitive information with explicit
  consent and user-controlled deletion.
- Keep service-role credentials server-side only.
- Enforce per-user access through Supabase RLS and authenticated API routes.
