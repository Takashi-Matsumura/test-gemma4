/**
 * AudioWorkletProcessor for capturing microphone PCM samples.
 *
 * Messages:
 *   main → worklet: { type: 'flush' }  → posts accumulated buffer back
 *   main → worklet: { type: 'stop' }   → posts final buffer and stops
 *   worklet → main: { type: 'buffer', samples: Float32Array }
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._stopped = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'flush') {
        this._flush();
      } else if (event.data.type === 'stop') {
        this._flush();
        this._stopped = true;
      }
    };
  }

  _flush() {
    if (this._buffer.length === 0) {
      this.port.postMessage({ type: 'buffer', samples: new Float32Array(0) });
      return;
    }

    const totalLength = this._buffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this._buffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this._buffer = [];

    this.port.postMessage({ type: 'buffer', samples: merged }, [merged.buffer]);
  }

  process(inputs) {
    if (this._stopped) return false;

    const input = inputs[0];
    if (input && input[0]) {
      // Copy channel 0 (mono)
      this._buffer.push(new Float32Array(input[0]));
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
