import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "apn:voice";

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
    if (!supported) return;
    window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void): void => {
      if (!supported || !prefs.enabled || !text.trim()) {
        onEnd?.();
        return;
      }
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

  // STT
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  const startListening = useCallback((onResult: (text: string) => void) => {
    const Ctor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return false;
    const r = new Ctor();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e: any) => {
      const text = Array.from(e.results).map((res: any) => res[0].transcript).join(" ");
      onResult(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    setListening(true);
    r.start();
    return true;
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop?.();
    setListening(false);
  }, []);

  const sttSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return {
    prefs, setPrefs,
    voices, supported,
    speak, stop,
    sttSupported, listening, startListening, stopListening,
  };
}
