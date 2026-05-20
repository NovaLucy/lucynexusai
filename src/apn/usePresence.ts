import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * usePresence — détecte la présence et la position du visage via la webcam.
 *
 * Pipeline :
 *   1. `window.FaceDetector` natif (Chromium) — ultra léger, zéro téléchargement.
 *   2. MediaPipe FaceDetector (WASM, ~2 Mo) — universel : Safari, iOS, Firefox.
 *   3. Heuristique de mouvement (filet de sécurité, sans gaze).
 *
 * Aucune image n'est jamais envoyée sur le réseau. Tout reste local au navigateur.
 */

const LS_KEY = "apn:presence";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { FaceDetector?: any }
}

export type Presence = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  available: boolean;
  faceApiAvailable: boolean;
  present: boolean;
  gazeX: number;       // -1 (gauche) … 0 … 1 (droite)
  gazeY: number;       // -1 (haut)   … 0 … 1 (bas)
  lastSeenAt: number | null;
};

// Default ON so the eye actually tracks from first launch.
const defaultEnabled = (() => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw == null) return true;
    return JSON.parse(raw);
  } catch { return true; }
})();

export function usePresence(): Presence {
  const [enabled, setEnabledState] = useState<boolean>(defaultEnabled);
  const [available, setAvailable] = useState(false);
  const [faceApiAvailable] = useState<boolean>(() => typeof window !== "undefined" && !!window.FaceDetector);
  const [present, setPresent] = useState(false);
  const [gaze, setGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpDetectorRef = useRef<any>(null);
  const smoothRef = useRef({ x: 0, y: 0 });

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {}
  }, []);

  const release = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
    try { mpDetectorRef.current?.close?.(); } catch {}
    mpDetectorRef.current = null;
    nativeDetectorRef.current = null;
    setAvailable(false);
    setPresent(false);
    setGaze({ x: 0, y: 0 });
    smoothRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    if (!enabled) { release(); return; }
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "user" }, width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = document.createElement("video");
        v.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;";
        v.muted = true; v.playsInline = true; v.autoplay = true;
        v.srcObject = stream;
        document.body.appendChild(v);
        videoRef.current = v;
        await v.play().catch(() => {});
        setAvailable(true);

        // 1) Native FaceDetector (Chromium)
        if (faceApiAvailable && window.FaceDetector) {
          try { nativeDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); }
          catch { nativeDetectorRef.current = null; }
        }

        // 2) MediaPipe (universal fallback) — load only if native isn't available
        if (!nativeDetectorRef.current) {
          try {
            const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
            if (cancelled) return;
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
            );
            if (cancelled) return;
            mpDetectorRef.current = await FaceDetector.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath:
                  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
                delegate: "GPU",
              },
              runningMode: "VIDEO",
              minDetectionConfidence: 0.5,
            });
          } catch (e) {
            console.warn("MediaPipe FaceDetector unavailable, using motion fallback", e);
            mpDetectorRef.current = null;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = 160; canvas.height = 120;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const applyFace = (cx: number, cy: number, w: number, h: number) => {
          // Caméra frontale = miroir → on inverse X
          const nx = 1 - (cx / w) * 2;
          const ny = (cy / h) * 2 - 1;
          // Amplify (visage tend à rester proche du centre) + clamp
          const ax = Math.max(-1, Math.min(1, nx * 1.6));
          const ay = Math.max(-1, Math.min(1, ny * 1.6));
          // Smoothing au niveau du hook (rendu lerp encore par-dessus)
          smoothRef.current.x += (ax - smoothRef.current.x) * 0.35;
          smoothRef.current.y += (ay - smoothRef.current.y) * 0.35;
          setGaze({ x: smoothRef.current.x, y: smoothRef.current.y });
          setPresent(true);
          setLastSeenAt(Date.now());
        };

        const minInterval = (nativeDetectorRef.current || mpDetectorRef.current) ? 66 : 400;
        let missed = 0;

        const tick = async (ts: number) => {
          if (cancelled) return;
          rafRef.current = requestAnimationFrame(tick);
          if (ts - lastTickRef.current < minInterval) return;
          lastTickRef.current = ts;

          const video = videoRef.current;
          if (!video || video.readyState < 2 || !ctx) return;

          // Native first
          if (nativeDetectorRef.current) {
            try {
              const faces = await nativeDetectorRef.current.detect(video);
              if (cancelled) return;
              if (faces && faces.length > 0) {
                const box = faces[0].boundingBox;
                applyFace(box.x + box.width / 2, box.y + box.height / 2, video.videoWidth, video.videoHeight);
                missed = 0;
                return;
              }
              missed++;
              if (missed > 6) setPresent(false);
              return;
            } catch {
              nativeDetectorRef.current = null;
            }
          }

          // MediaPipe
          if (mpDetectorRef.current) {
            try {
              const res = mpDetectorRef.current.detectForVideo(video, ts);
              const det = res?.detections?.[0];
              if (det) {
                const bb = det.boundingBox;
                applyFace(bb.originX + bb.width / 2, bb.originY + bb.height / 2, video.videoWidth, video.videoHeight);
                missed = 0;
                return;
              }
              missed++;
              if (missed > 6) setPresent(false);
              return;
            } catch (e) {
              console.warn("mp detect error", e);
            }
          }

          // 3) Fallback : motion heuristic (no gaze)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const prev = lastFrameDataRef.current;
          if (prev && prev.length === frame.length) {
            let delta = 0;
            for (let i = 0; i < frame.length; i += 16) delta += Math.abs(frame[i] - prev[i]);
            const motion = delta / (frame.length / 16);
            const isPresent = motion > 4;
            setPresent(isPresent);
            if (isPresent) setLastSeenAt(Date.now());
          }
          lastFrameDataRef.current = new Uint8ClampedArray(frame);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        toast.error(e?.name === "NotAllowedError"
          ? "Caméra refusée — suivi du regard désactivé."
          : "Caméra indisponible pour le suivi.");
        setEnabled(false);
      }
    })();

    return () => { cancelled = true; release(); };
  }, [enabled, faceApiAvailable, release, setEnabled]);

  // Libère le RAF quand l'onglet est en arrière-plan
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  return {
    enabled, setEnabled, available,
    faceApiAvailable: faceApiAvailable || true, // MediaPipe couvre tous les autres
    present, gazeX: gaze.x, gazeY: gaze.y, lastSeenAt,
  };
}
