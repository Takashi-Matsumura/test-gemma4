/**
 * Encode Float32 PCM samples into a WAV Blob (16-bit, mono).
 * Includes downsampling if the source sample rate differs from the target.
 */
export function encodeWav(
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16000,
): Blob {
  const resampled =
    sourceSampleRate === targetSampleRate
      ? samples
      : downsample(samples, sourceSampleRate, targetSampleRate);

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (targetSampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = resampled.length * 2; // 16-bit = 2 bytes per sample
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert Float32 [-1.0, 1.0] to Int16
  let offset = 44;
  for (let i = 0; i < resampled.length; i++) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function downsample(
  samples: Float32Array,
  from: number,
  to: number,
): Float32Array {
  const ratio = from / to;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lo = Math.floor(srcIndex);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIndex - lo;
    result[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
  }
  return result;
}
