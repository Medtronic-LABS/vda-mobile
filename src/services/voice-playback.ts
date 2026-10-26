/** Completes once when playback ends, fails, or the patient interrupts it. */
export function waitForAudioPlayback(
  player: HTMLAudioElement,
  onPlaying: () => void,
): { finished: Promise<void>; cancel: () => void } {
  let complete = () => {};
  let fail = (_error: unknown) => {};
  const finished = new Promise<void>((resolve, reject) => {
    let settled = false;
    const clear = () => {
      player.onplaying = null;
      player.onended = null;
      player.onerror = null;
    };
    complete = () => {
      if (settled) return;
      settled = true;
      clear();
      resolve();
    };
    fail = (error) => {
      if (settled) return;
      settled = true;
      clear();
      reject(error);
    };
    player.onplaying = onPlaying;
    player.onended = complete;
    player.onerror = () => fail(new Error('AUDIO_PLAYBACK_FAILED'));
  });
  try {
    void player.play().catch(fail);
  } catch (error) {
    fail(error);
  }
  return { finished, cancel: complete };
}
