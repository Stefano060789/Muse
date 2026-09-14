# Muse

Muse is a personalized AI emotional-wellness companion for short,
narrative-driven daily messages, gentle rituals, optional voice, and future
cycle-aware insights.

The complete product scope and delivery roadmap are documented in
[docs/project-scope.md](docs/project-scope.md).

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase, LLM, ElevenLabs, and Stripe values you intend to use.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.
5. Open `http://localhost:3000`.

Never commit `.env.local`, service-role keys, or other provider credentials.

## Current foundation

- Next.js 14 with React 18
- Supabase client and initial profiles/messages schema with RLS
- Provider integration starting point for daily message generation
- Stripe and ElevenLabs environment placeholders
- GitHub Actions production-build workflow

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

The current development project reference is `owhaqypvmonzdcikipay`.
Its URL is `https://owhaqypvmonzdcikipay.supabase.co`.
