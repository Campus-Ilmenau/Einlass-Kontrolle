import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState =
  | { status: 'idle' }
  | { status: 'starting' }
  | { status: 'running'; torch: boolean; torchOn: boolean }
  | { status: 'error'; message: string };

function cameraError(err: unknown): string {
  if (!window.isSecureContext) return 'Kamera nur über HTTPS verfügbar';
  const name = (err as DOMException)?.name;
  if (name === 'NotAllowedError')
    return 'Kamerazugriff wurde nicht erlaubt (Browser-Einstellungen prüfen)';
  if (name === 'NotFoundError') return 'Keine Kamera gefunden';
  if (name === 'NotReadableError') return 'Kamera wird von einer anderen App benutzt';
  return 'Kamera konnte nicht gestartet werden';
}

/** Rückkamera im <video>, mit Taschenlampe (falls vorhanden). Stoppt beim Verlassen der Seite. */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const [state, setState] = useState<CameraState>({ status: 'idle' });

  /** Callback-Ref fürs <video>: verbindet den laufenden Stream, auch wenn das Element neu eingehängt wird. */
  const bindVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current || startingRef.current) return;
    startingRef.current = true;
    setState({ status: 'starting' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setState({ status: 'running', torch: !!caps.torch, torchOn: false });
    } catch (err) {
      setState({ status: 'error', message: cameraError(err) });
    } finally {
      startingRef.current = false;
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || state.status !== 'running') return;
    const next = !state.torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setState({ ...state, torchOn: next });
    } catch {
      /* Licht nicht schaltbar */
    }
  }, [state]);

  useEffect(() => stop, [stop]);

  return { videoRef, bindVideo, state, start, stop, toggleTorch };
}

/** Bildschirm während des Scannens anlassen (Screen Wake Lock, wo verfügbar). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
