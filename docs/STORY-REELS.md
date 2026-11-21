# Story reels (tiered architecture, privacy-first)

Updated: 21 November 2026.

This document describes the local reel pipeline for completed personal stories,
its provider gates, and the data-flow/privacy limits.

## Tier 1 (default): AI-illustrated mini-film

- Entry point: **Create my story reel** in completed-story UI.
- Reel shape: 9:16, approximately 15–30 seconds, captions + Ken Burns motion +
  crossfades + end card (**Made with Muse** + share URL).
- Planning: server attempts an LLM JSON plan (4–6 spoiler-light moments with
  one-line captions + image prompts). If unavailable/invalid, Muse uses a local
  safe fallback plan.
- Images:
  - If an image provider is disabled (default), Muse uses local SVG artwork
    templates (`storyShareArtwork` / `personalStoryShareVisual`) at zero
    external-provider cost.
  - If explicitly enabled, Muse sends only the story summary + edited prompts
    to the configured image-provider interface.
- Rendering/export: browser-local canvas + MediaRecorder. MP4 is preferred;
  WebM fallback is supported with user warning.

## Tier 2 (premium, future): AI opening/ending shots

- `storyReelPremiumStatus()` and `StoryReelVideoProvider` define extension hooks.
- Premium status is hard-denied by default with
  `commercial-entitlement-required`.
- Existing Runway commercial block remains unchanged.

## Consent and review flow

When an image provider is enabled, users must:

1. review/edit captions,
2. optionally drop moments,
3. choose a theme,
4. explicitly approve sending story summary + prompts,
5. confirm render.

No rendering starts before this confirmation.

## Cost and abuse controls

Muse uses operation buckets + AI-attempt reserves:

- Global/day AI budget: existing `reserveAiAttempt()`.
- Per-user/day reel planning cap: `MUSE_STORY_REEL_PLAN_USER_DAILY_CAP`.
- Per-user/day reel image cap: `MUSE_STORY_REEL_IMAGE_USER_DAILY_CAP`.

Image-provider rendering consumes one AI attempt per generated image when
provider mode is enabled.

## Environment flags (server)

All new provider paths are disabled by default.

- `MUSE_STORY_REEL_IMAGE_PROVIDER_ENABLED`
- `MUSE_STORY_REEL_IMAGE_PROVIDER`
- `MUSE_STORY_REEL_PLAN_USER_DAILY_CAP`
- `MUSE_STORY_REEL_IMAGE_USER_DAILY_CAP`

The current built-in provider implementation is `mock` (for controlled tests).
No production provider is committed in this release.

## Data minimization and GDPR-oriented handling

- Story reel planning excludes user typed answers/profile memories from payloads.
- Prompts are sanitized and bounded; risky content falls back to safe prompts.
- No generated reel images are persisted server-side in this flow.
- Reel rendering happens client-side; generated blobs/object URLs are session
  artifacts and cleaned up on cancellation/unmount.
- Story text is not logged in reel planning/rendering paths.
