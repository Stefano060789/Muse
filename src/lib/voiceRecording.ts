export const VOICE_SECONDS = 60
export const VOICE_SAMPLE_RATE = 16000
export const VOICE_MAX_BYTES = 5 * 1024 * 1024

export function wavRecording(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000 || !samples.length || samples.length > sampleRate * VOICE_SECONDS) throw new Error('Record between a moment and 60 seconds of audio.')
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const sample = Number.isFinite(samples[i]) ? Math.max(-1, Math.min(1, samples[i])) : 0
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
  }
  return buffer
}
