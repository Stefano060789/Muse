import { suggestStoryMotif } from './storyShareArtwork'

export const RUNWAY_SHARE_CONSENT = 'runway-share-grok-lite-720p-2026-11-03'
export const RUNWAY_SHARE_MODEL = 'grok_imagine_1_5_lite'
export const RUNWAY_SHARE_SECONDS = 5
export const RUNWAY_SHARE_RATIO = 'auto_720p'
export const RUNWAY_SHARE_CREDITS = 16
export const RUNWAY_FRAME_MAX_BYTES = 1024 * 1024

export function validRunwayFrame(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || value.length > Math.ceil(RUNWAY_FRAME_MAX_BYTES * 4 / 3) + 32) return false
  let bytes: string
  try { bytes = atob(match[1]) } catch { return false }
  return bytes.length >= 4 && bytes.length <= RUNWAY_FRAME_MAX_BYTES &&
    btoa(bytes) === match[1] && bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8 &&
    bytes.charCodeAt(bytes.length - 2) === 0xff && bytes.charCodeAt(bytes.length - 1) === 0xd9
}

export function suggestedRunwayBrief(title: string, passage: string): string {
  const motif = suggestStoryMotif(title, passage)
  const subject = motif === 'map'
    ? 'An antique parchment map on a wooden table. A gentle breeze lifts and ripples its edges. A compass slowly turns and a golden route draws itself across the inked landscape.'
    : motif === 'sword'
      ? 'An ancient silver sword resting among mossy stones in a misty forest. The mist parts to reveal the blade. Soft golden light travels along the steel as the camera slowly approaches.'
      : motif === 'ocean'
        ? 'A small lantern beside a moonlit ocean. Gentle waves move across the shore and the lantern glows warmly as the camera slowly approaches.'
        : 'A mysterious storybook doorway in a peaceful garden. The door opens gently to reveal warm golden light as leaves drift past and the camera slowly approaches.'
  return `${subject} Cinematic illustrated storybook style, painterly textures, plum and antique-gold palette, elegant restrained motion, consistent objects. Vertical composition, no people, no text, no logos, no sound.`
}

export function validRunwayBrief(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 40 && value.length <= 900 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
}
