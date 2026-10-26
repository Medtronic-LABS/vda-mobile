type VoiceStage = 'stt' | 'turn' | 'tts' | 'playback';

/** Development-only, content-free timing for one microphone-led exchange. */
class VoicePerformance {
  private micStoppedAt: number | null = null;

  microphoneStopped(): void {
    this.micStoppedAt = performance.now();
  }

  timing(stage: VoiceStage, values: Record<string, number | string | null>): void {
    if (!import.meta.env.DEV) return;
    console.debug('[VDA voice timing]', { stage, ...values });
  }

  firstAudiblePlayback(): void {
    if (this.micStoppedAt === null) return;
    this.timing('playback', {
      micStopToFirstAudioMs: Math.round(performance.now() - this.micStoppedAt),
    });
    this.micStoppedAt = null;
  }

  failed(stage: VoiceStage): void {
    if (this.micStoppedAt !== null) this.timing(stage, { outcome: 'failed' });
    this.micStoppedAt = null;
  }

  clear(): void { this.micStoppedAt = null; }
}

export const voicePerformance = new VoicePerformance();
