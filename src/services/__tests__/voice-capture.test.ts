import { describe, expect, it } from 'vitest';
import { microphoneConstraints, preferredRecordingMime } from '../voice-capture';

describe('browser voice capture compatibility', () => {
  it('requests processing only for supported constraints', () => {
    expect(microphoneConstraints({ echoCancellation: true, noiseSuppression: true })).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
      },
    });
    expect(microphoneConstraints({})).toEqual({ audio: { channelCount: { ideal: 1 } } });
  });

  it('preserves WebM/Opus preference with a browser-selected fallback', () => {
    expect(preferredRecordingMime(() => true)).toBe('audio/webm;codecs=opus');
    expect(preferredRecordingMime(() => false)).toBeUndefined();
    expect(preferredRecordingMime()).toBeUndefined();
  });
});
