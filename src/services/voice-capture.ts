/** Requests browser processing only where the WebView reports support. */
export function microphoneConstraints(supported: MediaTrackSupportedConstraints): MediaStreamConstraints {
  return { audio: {
    channelCount: { ideal: 1 },
    ...(supported.echoCancellation ? { echoCancellation: { ideal: true } } : {}),
    ...(supported.noiseSuppression ? { noiseSuppression: { ideal: true } } : {}),
    ...(supported.autoGainControl ? { autoGainControl: { ideal: true } } : {}),
  } };
}

/** The existing WebM/Opus preference is retained; MediaRecorder may choose a supported fallback. */
export function preferredRecordingMime(isTypeSupported?: (mime: string) => boolean): string | undefined {
  return isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
}
