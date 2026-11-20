# Muse shipped asset provenance register

Started 20 November 2026 from the repository contents. This register lists what
ships in `public/` and what the repository itself can show about each file. It
is **not** a license clearance. "Owner to confirm" means no source, creator,
licence or permission record exists in the repository; Stefano must supply it
(or replace the asset) before a public launch. SHA-256 prefixes identify the
exact files reviewed; they do not prove where a file came from.

| File(s) | Type | What the repository shows | Status |
|---|---|---|---|
| `sample-audio/message-7016cac30c48.mp3`, `scene-1-b5c7b301d731.mp3`, `scene-2-baef2cae0639.mp3` | Narration audio | README states these are prerecorded Google WaveNet speech. Source text, generation date, Google Cloud account/project and the commercial-use terms of the output are not recorded. | Owner to confirm: account used, date generated, Google Cloud terms applicable to redistributing the output |
| `illustrations/celestial-library.svg`, `lantern-garden.svg`, `moonlit-passage.svg`, `story-door.svg` | Story artwork (SVG) | Small hand-written vector files in the repository. Author and creation tool are not recorded. | Owner to confirm: who or what created them, and that there is no third-party material |
| `illustrations/garden-of-stories-panorama.webp`, `garden-of-stories-portrait.webp` | Home artwork | Rendered by `scripts/render-home-art.cjs`, which draws the artwork in code (no third-party image input is referenced). Who commissioned or authored the script is not recorded. | Owner to confirm: authorship, and whether any AI image tool was involved |
| `icons/muse-180.png`, `muse-192.png`, `muse-512.png`, `muse-maskable-512.png` | App icons | `muse-512.png` and `muse-maskable-512.png` have identical content. Creator and tool are not recorded. The icon carries the internal name "Muse", which is not the cleared public name. | Owner to confirm; will need replacing if the public name changes |
| `manifest.webmanifest`, `sw.js`, `gift-recorder-worklet.js` | Application code/config | Authored within this repository. | Part of the app source |
| Fonts | — | No font files are shipped in `public/`, and no external font import was found in `src/styles/globals.css` or `src/pages/_app.tsx` (searched 20 November 2026). | Verified for those files only |

## Related provider outputs

- Narration generated at runtime by the optional Google Cloud text-to-speech
  and the AI story text from the configured provider are covered by those
  providers' output terms, which have not been verified; see
  [COMMERCIAL-READINESS.md](./COMMERCIAL-READINESS.md).
- ElevenLabs and Runway output remain blocked by server policy.

## Before launch

1. For each "Owner to confirm" row, record the creator or generator, date,
   the licence or terms relied on, and where the proof is kept.
2. Replace anything that cannot be documented.
3. Re-run this listing after adding or changing any file in `public/`.
