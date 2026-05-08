import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe } from "@elevenlabs/react";
import {
  nativeSpeak, nativeStopTTS,
  nativeStartListening, nativeStopListening, nativeSttSupported,
} from "./nativeVoice";
import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "apn:voice";
const isNative = Capacitor.isNativePlatform();
const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;

type VoicePrefs = {
  enabled: boolean;
  voiceURI?: string;
  rate: number;
  pitch: number;
};

const defaultPrefs: VoicePrefs = { enabled: true, rate: 1.0, pitch: 1.0 };

function chunkText(text: string, max = 170): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?…])\s+/);
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > max) {
      if (buf) out.push(buf.trim());
      if (s.length > max) {
        for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
        buf = "";
      } else buf = s;
    } else {
      buf = (buf + " " + s).trim();
    }
  }
  if (buf) out.push(buf.trim());
  return out;
}

export function useVoice() {
  const [prefs, setPrefs] = useState<VoicePrefs>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
    } catch {}
    return defaultPrefs;
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
  }, [prefs]);

  const stop = useCallback(() => {
    nativeStopTTS();
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void): void => {
      if (!prefs.enabled || !text.trim()) {
        onEnd?.();
        return;
      }
      if (isNative) {
        nativeSpeak(text, { rate: prefs.rate, pitch: prefs.pitch }).then(() => onEnd?.());
        return;
      }
      if (!supported) { onEnd?.(); return; }
      stop();
      const chunks = chunkText(text);
      let i = 0;
      const sayNext = () => {
        if (i >= chunks.length) { onEnd?.(); return; }
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        u.lang = "fr-FR";
        u.rate = prefs.rate;
        u.pitch = prefs.pitch;
        const v = voices.find((v) => v.voiceURI === prefs.voiceURI)
          ?? voices.find((v) => v.lang?.toLowerCase().startsWith("fr"))
          ?? voices[0];
        if (v) u.voice = v;
        u.onend = sayNext;
        u.onerror = sayNext;
        window.speechSynthesis.speak(u);
      };
      sayNext();
    },
    [supported, prefs, voices, stop],
  );

  // STT — ElevenLabs Scribe Realtime (web), native plugin on mobile
  const [listening, setListening] = useState(false);
  const [nativeStt, setNativeStt] = useState(false);
  const onResultRef = useRef<((t: string) => void) | undefined>();
  const onPartialRef = useRef<((t: string) => void) | undefined>();
  const onErrorRef = useRef<((m: string) => void) | undefined>();
  const liveRef = useRef("");
  const finalRef = useRef("");

  useEffect(() => {
    if (isNative) nativeSttSupported().then(setNativeStt);
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: "vad",
    onPartialTranscript: (data: any) => {
      const live = (finalRef.current + " " + (data?.text ?? "")).trim();
      liveRef.current = live;
      if (live) onPartialRef.current?.(live);
    },
    onCommittedTranscript: (data: any) => {
      const text = (data?.text ?? "").trim();
      if (text) {
        finalRef.current = (finalRef.current + " " + text).trim();
        onPartialRef.current?.(finalRef.current);
      }
      // VAD already detected silence → finalize and send
      const out = finalRef.current.trim();
      if (out) {
        finalRef.current = "";
        liveRef.current = "";
        // disconnect first to avoid double-trigger
        try { scribe.disconnect?.(); } catch {}
        setListening(false);
        onResultRef.current?.(out);
      }
    },
  });

  const startListening = useCallback(
    (
      onResult: (text: string) => void,
      onPartial?: (text: string) => void,
      onError?: (msg: string) => void,
    ) => {
      onResultRef.current = onResult;
      onPartialRef.current = onPartial;
      onErrorRef.current = onError;
      finalRef.current = "";
      liveRef.current = "";

      if (isNative && nativeStt) {
        let last = "";
        setListening(true);
        nativeStartListening((text) => {
          last = text;
          onPartialRef.current?.(text);
        }).then((ok) => {
          if (!ok) {
            setListening(false);
            onErrorRef.current?.("Micro indisponible");
            return;
          }
          setTimeout(async () => {
            await nativeStopListening();
            setListening(false);
            if (last.trim()) onResultRef.current?.(last);
          }, 6000);
        });
        return true;
      }

      // Web: ElevenLabs Scribe Realtime
      (async () => {
        try {
          const tokenResp = await fetch(SCRIBE_TOKEN_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          });
          if (!tokenResp.ok) {
            const j = await tokenResp.json().catch(() => ({}));
            throw new Error(j?.error || `Token ${tokenResp.status}`);
          }
          const { token } = await tokenResp.json();
          if (!token) throw new Error("Token vide");

          await scribe.connect({
            token,
            microphone: { echoCancellation: true, noiseSuppression: true },
          });
          setListening(true);
        } catch (e: any) {
          console.error("scribe connect failed", e);
          setListening(false);
          onErrorRef.current?.(e?.message || "Impossible de démarrer la voix");
        }
      })();
      return true;
    },
    [nativeStt, scribe],
  );

  const stopListening = useCallback(() => {
    if (isNative) { nativeStopListening(); setListening(false); return; }
    try { scribe.disconnect?.(); } catch {}
    setListening(false);
    const out = (finalRef.current || liveRef.current).trim();
    finalRef.current = "";
    liveRef.current = "";
    if (out) onResultRef.current?.(out);
  }, [scribe]);

  const sttSupported = isNative ? nativeStt : true;

  return {
    prefs, setPrefs,
    voices, supported,
    speak, stop,
    sttSupported, listening, startListening, stopListening,
  };
}
