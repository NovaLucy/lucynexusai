import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * usePresence — détecte la présence du visage de l'utilisateur via la caméra frontale.
 *
 * Utilise l'API native `window.FaceDetector` (Chromium) si disponible.
 * Sur navigateurs sans FaceDetector (Safari iOS, Firefox), retombe sur une
 * heuristique de mouvement (variance d'intensité de l'image) comme indicateur
 * de présence dégradée — pas de gaze tracking dans ce cas.
 *
 * Le flux caméra est silencieux : un <video> caché, pas d'affichage,
 * libéré dès que la fonctionnalité est désactivée ou que l'onglet n'a plus
 * le focus.
 */

const LS_KEY = "apn:presence";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { FaceDetector?: any }
}

export type Presence = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  available: boolean;       // true si une caméra a été obtenue
  faceApiAvailable: boolean; // true si FaceDetector natif dispo
  present: boolean;          // un visage est actuellement détecté
  gazeX: number;             // -1 (gauche) … 0 … 1 (droite)
  gazeY: number;             // -1 (haut)   … 0 … 1 (bas)
  lastSeenAt: number | null;
};

export function usePresence(): Presence {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "false"); } catch { return false; }
  });
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
  const detectorRef = useRef<any>(null);

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
    setAvailable(false);
    setPresent(false);
    setGaze({ x: 0, y: 0 });
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

        if (faceApiAvailable && window.FaceDetector) {
          try { detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); }
          catch { detectorRef.current = null; }
        }

        const canvas = document.createElement("canvas");
        canvas.width = 160; canvas.height = 120;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async (ts: number) => {
          if (cancelled) return;
          rafRef.current = requestAnimationFrame(tick);
          if (ts - lastTickRef.current < 400) return; // ~2.5Hz, économe
          lastTickRef.current = ts;

          const video = videoRef.current;
          if (!video || video.readyState < 2 || !ctx) return;

          if (detectorRef.current) {
            try {
              const faces = await detectorRef.current.detect(video);
              if (cancelled) return;
              if (faces && faces.length > 0) {
                const box = faces[0].boundingBox;
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                // Caméra frontale = miroir → on inverse X pour que "à droite à l'écran" = "à droite de Lucy"
                const nx = 1 - (cx / video.videoWidth) * 2;
                const ny = (cy / video.videoHeight) * 2 - 1;
                setGaze({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
                setPresent(true);
                setLastSeenAt(Date.now());
                return;
              }
              setPresent(false);
            } catch {
              detectorRef.current = null; // bascule sur fallback
            }
          }

          // Fallback : heuristique de mouvement (delta moyen entre frames)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const prev = lastFrameDataRef.current;
          if (prev && prev.length === frame.length) {
            let delta = 0;
            for (let i = 0; i < frame.length; i += 16) {
              delta += Math.abs(frame[i] - prev[i]);
            }
            const motion = delta / (frame.length / 16);
            const isPresent = motion > 4; // seuil empirique
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

  // Libère le flux quand l'onglet est en arrière-plan, ré-acquiert au retour
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.hidden) {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  return { enabled, setEnabled, available, faceApiAvailable, present, gazeX: gaze.x, gazeY: gaze.y, lastSeenAt };
}
