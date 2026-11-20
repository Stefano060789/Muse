# Unwritten You launch readiness, planned public launch 1 December 2026

Prepared 20 November 2026 from the repository, Vercel project metadata (variable
names only, values hidden) and public provider pages. Nothing here is legal
clearance. The earlier panel evaluation
(`Business Memory/Tiles/unwritten-you/evaluation-2026-11-20.md`) recommended a
smaller pilot first; the owner has chosen to launch the full product, so this
list is the work needed to make that launch defensible.

## Status by item

| Item | Status |
|---|---|
| Creator isolation | **Code is account-based** (Supabase sign-in, `owner_id`, per-account recovery keys, creator-only actions). Repaired tests cover another account attempting creator actions, but they do not prove hosted isolation. The two unused creator-lock production variables were removed with owner approval; creator accounts and isolation must still be confirmed on the live Supabase project. |
| Backups | Tooling exists and passes its tests, but **nothing is configured**: this computer has no `psql`, `pg_dump` or `pg_restore`, no backup key, directory or database URL. See "Backups" below. Not done. |
| Spending cap | **Not done or verified.** An application request counter is not a hard euro spending limit. Provider and hosting account limits and alerts need separate verification. |
| `test:library` failure | Fixed (the test expected no share card on an unfinished chapter; the component deliberately shows an in-progress card). Three more stale or broken tests were repaired, one of them caused by my 20 November change (`gift-ui`). |
| Hosted Supabase check | New read-only script `supabase/verify-production.sql`. **Not run**: it needs you to run it in the Supabase SQL editor. It is preliminary metadata only, not proof of migration versions, correct function definitions, or RLS isolation. |
| "Designed to adapt" wording | Done in the creator UI and pre-send check. The README already says the three-try rule is prompt guidance, not a counter. |
| Privacy notice accuracy | Updated: help codes and attempt counts, and a mislabelled limit (it said "creator-code" attempts; the limit protects the private operator dashboard). Recipients are now told that a link can be forwarded and what the sender can see. |
| Asset provenance | `docs/ASSET-PROVENANCE.md` lists every shipped file and what is unproven. Most rows need you. |
| Deletion/retention including provider copies | Facts below; the policy decision and provider settings are yours and your adviser's. |

## Production variables (names only, checked 20 November 2026)

Present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `STORY_STORAGE`, `ANTHROPIC_API_KEY`, `LLM_PROVIDER`,
`LLM_MODEL`, `MUSE_CREATOR_EMAILS`, Google narration settings, and the
ElevenLabs and Runway settings (those two providers are blocked by server policy).

Missing or unexpected, and why it matters:

- **No `NEXT_PUBLIC_MUSE_SUPPORT_EMAIL` or `NEXT_PUBLIC_MUSE_OPERATOR_NAME`.** The
  legal pages and the launch readiness check need an operator and support
  contact. Without them the privacy and terms pages cannot name who is
  responsible. **Launch blocker**; it also depends on your business registration.
- **No `MUSE_OPERATIONS_ACCESS_CODE`.** The private operations dashboard
  returns 503, so spending and failure alerts are visible only in server logs.
- **No `MUSE_BACKUP_*` variables.** Expected, since backups are not set up.
- `LLM_PROVIDER` is stored as a hidden secret, so I could not confirm that
  Anthropic is the live provider. The cost bound below assumes Anthropic.
- The two unused creator-lock variables were removed on 20 November 2026; the
  separate operator-access variable was not removed.

## AI spending

The live provider, model, deployed counter and provider billing behavior have
not been verified. No reliable cost ceiling can be inferred from the default
application attempt count. Verify actual provider pricing, input and output
usage, retries and all other chargeable services before estimating costs.
Confirm whether each account offers a genuinely enforced limit; alerts,
application counters and budget settings may not stop spending.

## Settings you need to make (I cannot do these)

1. **Live AI provider:** identify the provider and model, then check whether its
   account offers an enforced spending limit and alerts. Agree the amounts and
   currency conversion before changing billing settings.
2. **Vercel:** confirm the plan, and under Billing turn on spend management with
   an alert and, if offered, automatic pause.
3. **Supabase:** confirm the plan and the spend cap setting. Read the project's
   Backups page to see whether daily backups or point-in-time recovery are
   included.
4. **Google Cloud:** set a budget alert on the project that owns the
   text-to-speech key. The app also holds a character budget variable.
5. After setting each limit, write down the amount, date and who can change it.
   I will record it in the product notes.

## Backups

Two routes; use both if possible.

1. **Supabase's own backups.** Whether they exist depends on your plan; I could
   not check. If included, rehearse restoring into a new, separate project.
2. **The repository's encrypted backups** (`scripts/muse-backup.cjs`, guide
   `docs/BACKUPS.md`). To start you need: PostgreSQL command-line tools
   installed (not present on this computer), a private backup folder outside the
   project, an encryption key stored with a separate recovery copy, a database
   connection string with read access, and a short maintenance window.

A restore rehearsal means restoring into an isolated, disposable database with
synthetic recipients and no AI calls, then checking that deleted stories do not
reappear. Archive verification alone is not a rehearsal. Do both before launch.

## Provider facts for the privacy notice (verified from public pages, 20 November 2026)

- **Anthropic API, retention:** inputs and outputs are deleted from their backend
  within 30 days, except longer-retention services you use, agreed zero-retention
  arrangements, legal requirements, or content flagged as a policy violation
  (kept up to 2 years). Source: [privacy centre, updated 1 July 2026](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data).
- **Training:** by default Anthropic does not train on commercial API inputs or
  outputs; feedback you explicitly submit can be used. Source:
  [privacy centre, updated 18 August 2026](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training).
- **Data processing addendum:** published at
  [anthropic.com/legal/data-processing-addendum](https://anthropic.com/legal/data-processing-addendum).
  Whether it applies to your account, the processing region and international
  transfer terms are **not verified**.
- **Deletion:** the app can delete a story from Muse; it cannot delete the
  provider's up-to-30-day copy, browser copies, or backups. State that in the
  notice rather than promising erasure everywhere.
- Not verified at all: Vercel, Supabase and Google data processing terms and
  regions; whether you will have a registered business and impressum by
  1 December.

## Questions for a qualified Austrian data-protection adviser

(Drafted by me. The Legal Preparation specialist failed to run, so this was not
independently prepared. It is not advice.)

Launch-blocking:

1. Is a data protection impact assessment needed for stories that may contain
   health, emotional or family content, sent to an AI provider?
2. Is the legal basis and consent wording adequate, given self-declared age and
   consent? Should there be a minimum age, and what if minors are likely users?
3. Are the Anthropic, Vercel, Supabase and Google data processing terms in place,
   and are the transfers outside the EU covered? Which regions are used?
4. What retention schedule is acceptable for stories, sessions, progress counts,
   operational logs and backups, and how should provider-side copies be described?
5. Does a shared recipient link carry privacy risk when forwarded, and is the
   current notice enough? Is showing the sender anonymous progress acceptable?
6. As a sole proprietor not yet registered: what must the impressum, terms and
   privacy notice name, and what must exist before the first public user?
7. Do the brand name and the "Muse" and "Unwritten You" candidates create a
   trademark risk before launch?

Later: consumer withdrawal and invoicing rules before paid features; whether
a data protection officer is needed at scale; cookie and storage disclosure for
the browser-stored data.

## Honest view on 1 December

Code changes can be ready by then. Several launch blockers depend on actions
only you can take: registration and a named operator with support email, the
spend limits, a working backup and restore rehearsal, the provider terms, the
asset provenance, and an adviser's view on the privacy notice. If any of those
is not done by 1 December, launching to invited users is safer than open
registration. Your own January target and the evaluation panel both pointed to
a smaller first release; this is your decision.
