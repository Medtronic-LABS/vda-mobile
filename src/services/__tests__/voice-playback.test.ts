import { expect, it, vi } from 'vitest';
import { waitForAudioPlayback } from '../voice-playback';

it('settles a cancelled playback once and ignores late audio events', async () => {
  const player = {
    play: vi.fn().mockResolvedValue(undefined),
    onplaying: null,
    onended: null,
    onerror: null,
  } as unknown as HTMLAudioElement;
  const onPlaying = vi.fn();
  const playback = waitForAudioPlayback(player, onPlaying);
  const lateEnd = player.onended;
  playback.cancel();
  await expect(playback.finished).resolves.toBeUndefined();
  expect(player.onplaying).toBeNull();
  expect(player.onended).toBeNull();
  lateEnd?.call(player, new Event('ended'));
  expect(onPlaying).not.toHaveBeenCalled();
});
