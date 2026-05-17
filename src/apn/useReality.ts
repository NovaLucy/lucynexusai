import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * useReality — ancre APN dans le réel.
 *
 * Trois flux :
 *  - Temps  : date/heure locale, fuseau, période du jour, jour de la semaine.
 *  - Lieu   : géolocalisation navigateur + reverse-geocode (BigDataCloud, sans clé).
 *  - Vision : flux caméra ambiant silencieux (front/back), capture d'un frame
 *             "regard furtif" à attacher à un message pour analyse en direct.
 *
 * Tout est opt-in et persisté en localStorage. Aucune capture sans toggle activé.
 */

export type RealityLocation = {
  lat: number;
  lon: number;
  accuracy?: number;
  city?: string;
  region?: string;
  country?: string;
  label?: string;
  fetchedAt: number;
};

export type RealityNow = {
  iso: string;
  hour: number;
  minute: number;
  weekday: string;
  dateLabel: string;
  period: "nuit" | "matin" | "midi" | "après-midi" | "soir";
  tz: string;
};

export type RealitySnapshot = {
  now: RealityNow;
  location?: RealityLocation;
  ambientImageDataUrl?: string | null;
  facing?: "user" | "environment";
};

const LS_LOC = "apn:reality:loc";
const LS_CAM = "apn:reality:cam";
const LS_FACING = "apn:reality:facing";

function computeNow(): RealityNow {
  const d = new Date();
  const h = d.getHours();
  const period: RealityNow["period"] =
    h < 5 ? "nuit"
    : h < 11 ? "matin"
    : h < 14 ? "midi"
    : h < 18 ? "après-midi"
    : h < 22 ? "soir"
    : "nuit";
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "long" });
  const dateLabel = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return {
    iso: d.toISOString(),
    hour: h,
    minute: d.getMinutes(),
    weekday,
    dateLabel,
    period,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<Partial<RealityLocation>> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`,
    );
    if (!r.ok) return {};
    const j = await r.json();
    const city = j.city || j.locality || j.principalSubdivision;
    const region = j.principalSubdivision;
    const country = j.countryName;
    const label = [city, country].filter(Boolean).join(", ") || undefined;
    return { city, region, country, label };
  } catch {
    return {};
  }
}

export function useReality() {
  const [locEnabled, setLocEnabled] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_LOC) ?? "false"); } catch { return false; }
  });
  const [camEnabled, setCamEnabled] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CAM) ?? "false"); } catch { return false; }
  });
  const [facing, setFacing] = useState<"user" | "environment">(() => {
    try { return (localStorage.getItem(LS_FACING) as any) ?? "environment"; } catch { return "environment"; }
  });
  const [location, setLocation] = useState<RealityLocation | null>(null);
  const [now, setNow] = useState<RealityNow>(() => computeNow());

  // Track capability toggles → "vient juste de changer" signal pour Lucy
  const [recentlyChanged, setRecentlyChanged] = useState<{ loc?: number; cam?: number }>({});
  const markChange = useCallback((k: "loc" | "cam") => {
    setRecentlyChanged((p) => ({ ...p, [k]: Date.now() }));
    window.setTimeout(() => {
      setRecentlyChanged((p) => {
        const v = p[k];
        if (v && Date.now() - v >= 60_000) {
          const n = { ...p }; delete n[k]; return n;
        }
        return p;
      });
    }, 65_000);
  }, []);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Persist (skip first run to avoid false "recently changed" signal on boot)
  const firstLocRef = useRef(true);
  const firstCamRef = useRef(true);
  useEffect(() => {
    try { localStorage.setItem(LS_LOC, JSON.stringify(locEnabled)); } catch {}
    if (firstLocRef.current) { firstLocRef.current = false; return; }
    markChange("loc");
  }, [locEnabled, markChange]);
  useEffect(() => {
    try { localStorage.setItem(LS_CAM, JSON.stringify(camEnabled)); } catch {}
    if (firstCamRef.current) { firstCamRef.current = false; return; }
    markChange("cam");
  }, [camEnabled, markChange]);
  useEffect(() => { try { localStorage.setItem(LS_FACING, facing); } catch {} }, [facing]);

  // Tick clock every 30s
  useEffect(() => {
    setNow(computeNow());
    const id = window.setInterval(() => setNow(computeNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Acquire location when toggled on
  useEffect(() => {
    if (!locEnabled) { setLocation(null); return; }
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation indisponible.");
      setLocEnabled(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const base: RealityLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          fetchedAt: Date.now(),
        };
        setLocation(base);
        const enriched = await reverseGeocode(base.lat, base.lon);
        setLocation({ ...base, ...enriched });
      },
      (err) => {
        toast.error(err.code === err.PERMISSION_DENIED
          ? "Localisation refusée."
          : "Impossible d'obtenir la position.");
        setLocEnabled(false);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 8000 },
    );
  }, [locEnabled]);

  // Acquire/release ambient camera stream
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!camEnabled) { releaseStream(); return; }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = document.createElement("video");
        v.style.position = "fixed";
        v.style.opacity = "0";
        v.style.pointerEvents = "none";
        v.style.width = "1px";
        v.style.height = "1px";
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        v.srcObject = stream;
        document.body.appendChild(v);
        videoRef.current = v;
        await v.play().catch(() => {});
      } catch (e: any) {
        toast.error(e?.name === "NotAllowedError"
          ? "Caméra refusée."
          : "Caméra indisponible.");
        setCamEnabled(false);
      }
    })();
    return () => { cancelled = true; releaseStream(); };
  }, [camEnabled, facing, releaseStream]);

  /** Capture furtive d'un frame de la caméra ambiante (jpeg dataURL, ~512px). */
  const captureAmbient = useCallback(async (): Promise<string | null> => {
    const v = videoRef.current;
    if (!camEnabled || !v || v.readyState < 2 || !v.videoWidth) return null;
    const MAX = 512;
    const scale = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    try { return canvas.toDataURL("image/jpeg", 0.78); } catch { return null; }
  }, [camEnabled]);

  /** Snapshot complet pour passer au backend juste avant un envoi. */
  const snapshot = useCallback(async (withAmbient = true): Promise<RealitySnapshot> => {
    const ambient = withAmbient ? await captureAmbient() : null;
    return {
      now: computeNow(),
      location: location ?? undefined,
      ambientImageDataUrl: ambient,
      facing: camEnabled ? facing : undefined,
    };
  }, [captureAmbient, location, camEnabled, facing]);

  return {
    now,
    location,
    locEnabled, setLocEnabled,
    camEnabled, setCamEnabled,
    facing, setFacing,
    captureAmbient,
    snapshot,
    recentlyChanged,
  };
}
