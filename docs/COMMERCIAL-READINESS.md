# Muse commercial-readiness status

Reviewed 6 November 2026. This is an engineering inventory, not legal advice,
a signed agreement, or a statement that Muse is cleared for commercial launch.
The deployment environment and provider accounts were not inspected.

## Provider and data-use inventory

| Service | Current code path and purpose | Data sent / retained |
| --- | --- | --- |
| Anthropic (default story AI) | `src/lib/storyProvider.ts` defaults `LLM_PROVIDER` to `ANTHROPIC`; story creation and continuation use it to generate story content. OpenAI and Groq are also supported when selected by the operator. | Submitted story brief, responses/actions, and selected story context (which may include personal memories) go to the configured model provider. Verify the actual provider and model in the deployment. |
| Google Cloud Text-to-Speech | Optional personal and prepared-scene narration. It is available only when Google mode, server credentials, an explicit character budget, persistent private storage, and the required cloud-audio permission are in place. | Selected narration text is sent to Google for speech generation. Prepared Studio narration includes a scene title, body and clue, not the private answer/reveal. Generated audio is privately cached; cache cleanup is request-triggered, with a 30-day configured retention window that is not a scheduled-deletion guarantee. |
| Browser/device speech | Browser narration and the translated public demo use the browser/device speech facility. | Muse's cloud narration endpoint is not used. Platform speech handling may vary by browser/device. The English demo also plays static prerecorded MP3 files and sends no story text for synthesis. |
| Supabase / local SQLite | Supabase Auth and configured private storage/database support account and server-story operations; local deployments may use SQLite. | Account, story, progress and private media data are stored according to the selected deployment. The live storage choice, region, backup policy and retention configuration were not verified. |
| ElevenLabs | Personal cloud TTS and new ElevenLabs Studio generation are blocked server-side pending commercial entitlement review. A deployment setting or credential cannot re-enable them. The UI uses browser narration instead of claiming an ElevenLabs fallback. | Muse does not send new narration requests to ElevenLabs. Existing saved Studio recordings are retained and can remain playable under their existing access controls. |
| Runway | Video creation and provider status requests are blocked server-side pending commercial entitlement review, irrespective of configuration or credentials. The UI reports the disabled state and offers no replacement generation. | Muse does not send prompts or starting illustrations to Runway. Existing private job records and saved clips are not deleted; private saved media remains readable through the existing storage/API controls. |

PlantNet was not included in this work.

## Owner confirmation required before launch or re-enablement

Do not treat code configuration or this inventory as vendor approval. The owner
must verify and record, for every provider actually used:

- The exact production provider, model, account, purpose, submitted data and
  enabled feature flags/secrets (without placing secrets in this document).
- Commercial entitlement and applicable use rights for generated outputs,
  voices, models, and any provider-specific restrictions.
- Applicable DPA/data-processing terms and subprocessors, including whether
  required agreements are available and accepted by the authorized owner.
- Processing and storage regions, international transfer arrangements, and
  the regions used by the app host, Supabase and model/audio providers.
- Provider-side retention, training/use settings, deletion options and logs;
  Muse's own story/media, audio-cache, operational-log and backup retention.
- The privacy notice, consent wording and user controls against those verified
  deployment facts; complete the required legal review.

No DPA, region, retention schedule, commercial entitlement, legal acceptance or
legal clearance is asserted here. ElevenLabs and Runway must remain blocked
until the owner confirms the required commercial entitlement and separately
approves any implementation change.

## Installed dependency license/source inventory

The accompanying [dependency-license-inventory.csv](./dependency-license-inventory.csv)
lists the 86 package copies that were both present in `node_modules` and present
in `package-lock.json` at review time. It records each installed package's
version, `license` field, repository field and any license/copying file found
in that installed package directory. The inventory includes direct and
transitive packages, including development and platform-specific packages.

All 86 installed package manifests contained a license field. The recorded
license identifiers include MIT (68), ISC (9), Apache-2.0 (4), BSD-3-Clause (2),
CC-BY-4.0 (1), 0BSD (1), and `Apache-2.0 AND LGPL-3.0-or-later` (1). Some
packages declare a license but have no matching license file in the installed
directory; the CSV records this rather than inferring a missing text. Review
the corresponding upstream notices and the combined LGPL/native `sharp`
dependency before distribution. `caniuse-lite` is marked CC-BY-4.0; verify
attribution obligations for redistributed data.

This is a local metadata snapshot, not a legal review or a complete source-code
audit: repository locators were copied from package metadata and not
independently verified; bundled Next.js/runtime code, optional packages not
installed here, future lockfile changes, and all third-party notices still
require release-time review. Regenerate and review the inventory after
dependency updates.

## Asset provenance and audit gaps

The repository includes public sample audio (`public/sample-audio/*.mp3`),
story artwork (`public/illustrations/*.svg`, `public/story-door.svg`), and
application icons (`public/icons/*`). The product documentation identifies the
English sample audio as prerecorded Google WaveNet speech, but this repository
does not establish the source text, generation date/account, applicable
commercial voice/output terms, or an owner authorization record. The artwork
and icons likewise have no source/creator/permission manifest in the reviewed
project files. Do not treat file hashes or filenames as proof of provenance.

Before commercial release, the owner must establish and retain the source,
creator, license/permission, attribution requirements and commercial-use basis
for every shipped asset, including generated audio and artwork. A full
transitive-code, asset, provider-terms, deployment-region, DPA and retention
audit remains unresolved.
