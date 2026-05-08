import { useCallback, useEffect, useRef, useState } from "react";
import {
  nativeSpeak, nativeStopTTS,
  nativeStartListening, nativeStopListening, nativeSttSupported,
} from "./nativeVoice";
import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "apn:voice";
const isNative = Capacitor.isNativePlatform();

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

  // STT — native plugin first, Web Speech API fallback
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [nativeStt, setNativeStt] = useState(false);

  useEffect(() => {
    if (isNative) nativeSttSupported().then(setNativeStt);
  }, []);

  // Stable refs to avoid stale closures when auto-restarting
  const onResultRef = useRef<(t: string) => void>();
  const onPartialRef = useRef<((t: string) => void) | undefined>();
  const onErrorRef = useRef<((msg: string) => void) | undefined>();
  const wantListenRef = useRef(false);
  const finalTextRef = useRef("");
  const liveTextRef = useRef("");

  const startListening = useCallback(
    (
      onResult: (text: string) => void,
      onPartial?: (text: string) => void,
      onError?: (msg: string) => void,
    ) => {
      onResultRef.current = onResult;
      onPartialRef.current = onPartial;
      onErrorRef.current = onError;

      if (isNative && nativeStt) {
        let last = "";
        setListening(true);
        wantListenRef.current = true;
        nativeStartListening((text) => {
          last = text;
          onPartialRef.current?.(text);
        }).then((ok) => {
          if (!ok) {
            setListening(false);
            wantListenRef.current = false;
            onErrorRef.current?.("Micro indisponible");
            return;
          }
          setTimeout(async () => {
            await nativeStopListening();
            setListening(false);
            wantListenRef.current = false;
            if (last.trim()) onResultRef.current?.(last);
          }, 6000);
        });
        return true;
      }

      const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Ctor) {
        onError?.("Reconnaissance vocale non supportée par ce navigateur");
        return false;
      }
      const r = new Ctor();
      r.lang = "fr-FR";
      r.interimResults = true;
      // Keep this single-shot: Chrome/Safari often reject automatic restarts
      // because they are no longer inside the user's click gesture.
      r.continuous = false;
      finalTextRef.current = "";
      liveTextRef.current = "";
      wantListenRef.current = true;

      r.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalTextRef.current += res[0].transcript + " ";
          else interim += res[0].transcript;
        }
        const live = (finalTextRef.current + interim).trim();
        liveTextRef.current = live;
        if (live) onPartialRef.current?.(live);
      };
      r.onend = () => {
        wantListenRef.current = false;
        setListening(false);
        recognitionRef.current = null;
        const text = (finalTextRef.current || liveTextRef.current).trim();
        if (text) onResultRef.current?.(text);
      };
      r.onerror = (e: any) => {
        const code = e?.error || "unknown";
        console.warn("STT error:", code);
        wantListenRef.current = false;
        setListening(false);
        recognitionRef.current = null;
        const text = (finalTextRef.current || liveTextRef.current).trim();
        if (text) {
          onResultRef.current?.(text);
          return;
        }
        if (code === "no-speech") {
          onErrorRef.current?.("Je n'ai rien entendu. Réessaie en parlant juste après avoir appuyé sur [MIC].");
          return;
        }
        if (code === "not-allowed" || code === "service-not-allowed") {
          onErrorRef.current?.("Accès au micro refusé. Autorise-le dans les réglages du navigateur.");
        } else if (code === "audio-capture") {
          onErrorRef.current?.("Aucun micro détecté.");
        } else if (code === "network") {
          onErrorRef.current?.("Service vocal du navigateur inaccessible. Utilise Chrome/Edge, vérifie que le micro est autorisé, puis réessaie.");
        } else if (code !== "aborted") {
          onErrorRef.current?.(`Reconnaissance vocale: ${code}`);
        }
      };
      recognitionRef.current = r;
      setListening(true);
      try {
        r.start();
      } catch (err) {
        console.warn("STT start failed", err);
        wantListenRef.current = false;
        setListening(false);
        onError?.("Impossible de démarrer le micro");
        return false;
      }
      return true;
    },
    [nativeStt],
  );

  const stopListening = useCallback(() => {
    wantListenRef.current = false;
    if (isNative) { nativeStopListening(); setListening(false); return; }
    try { recognitionRef.current?.stop?.(); } catch {}
    setListening(false);
    // Trigger final delivery
    const text = finalTextRef.current.trim();
    if (text) onResultRef.current?.(text);
  }, []);

  const sttSupported =
    (isNative && nativeStt) ||
    (typeof window !== "undefined" &&
     !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));

  return {
    prefs, setPrefs,
    voices, supported,
    speak, stop,
    sttSupported, listening, startListening, stopListening,
  };
}
