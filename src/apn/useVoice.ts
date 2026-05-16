import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import {
  nativeSpeak, nativeStopTTS,
  nativeStartListening, nativeStopListening, nativeSttSupported,
} from "./nativeVoice";
import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "apn:voice";
const isNative = Capacitor.isNativePlatform();
const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-scribe-token`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Speaking state — global indicator that Lucy is currently producing audio.
  // Increments for each in-flight utterance; decrements on end. > 0 ⇒ speaking.
  const speakingCountRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const onSpeechEndRef = useRef<(() => void) | undefined>();
  const bumpSpeak = useCallback((delta: number) => {
    speakingCountRef.current = Math.max(0, speakingCountRef.current + delta);
    const now = speakingCountRef.current > 0;
    setSpeaking((prev) => (prev !== now ? now : prev));
    if (!now) {
      // fire once when fully idle
      const cb = onSpeechEndRef.current;
      if (cb) {
        onSpeechEndRef.current = undefined;
        try { cb(); } catch {}
      }
    }
  }, []);
  const setOnSpeechEnd = useCallback((cb?: () => void) => {
    onSpeechEndRef.current = cb;
  }, []);

  const stop = useCallback(() => {
    nativeStopTTS();
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      try { URL.revokeObjectURL(audioUrlRef.current); } catch {}
      audioUrlRef.current = null;
    }
    // Hard reset speaking state
    speakingCountRef.current = 0;
    setSpeaking(false);
    onSpeechEndRef.current = undefined;
  }, [supported]);

  const speakWebFallback = useCallback((text: string, onEnd?: () => void) => {
    if (!supported) { onEnd?.(); return; }
    try { window.speechSynthesis.cancel(); } catch {}
    const chunks = chunkText(text);
    let i = 0;
    bumpSpeak(+1);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      bumpSpeak(-1);
      onEnd?.();
    };
    const sayNext = () => {
      if (i >= chunks.length) { finish(); return; }
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
  }, [supported, prefs, voices, bumpSpeak]);

  /**
   * Speak a single sentence without stopping previous speech.
   * Designed for streaming dialogue — queues utterances sequentially.
   */
  const speakSentence = useCallback(
    (text: string): void => {
      if (!prefs.enabled || !text.trim() || !supported) return;
      bumpSpeak(+1);
      const u = new SpeechSynthesisUtterance(text.trim());
      u.lang = "fr-FR";
      u.rate = prefs.rate;
      u.pitch = prefs.pitch;
      const v = voices.find((v) => v.voiceURI === prefs.voiceURI)
        ?? voices.find((v) => v.lang?.toLowerCase().startsWith("fr"))
        ?? voices[0];
      if (v) u.voice = v;
      let ended = false;
      const finish = () => { if (ended) return; ended = true; bumpSpeak(-1); };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    },
    [supported, prefs, voices, bumpSpeak],
  );

  const speak = useCallback(
    (text: string, onEnd?: () => void): void => {
      if (!prefs.enabled || !text.trim()) {
        onEnd?.();
        return;
      }
      if (isNative) {
        bumpSpeak(+1);
        nativeSpeak(text, { rate: prefs.rate, pitch: prefs.pitch }).then(() => {
          bumpSpeak(-1);
          onEnd?.();
        });
        return;
      }
      // Web: try ElevenLabs (high quality). Fallback to speechSynthesis.
      stop();
      bumpSpeak(+1);
      let settled = false;
      const finish = () => { if (settled) return; settled = true; bumpSpeak(-1); onEnd?.(); };
      (async () => {
        try {
          const resp = await fetch(TTS_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text, speed: prefs.rate }),
          });
          if (!resp.ok) throw new Error(`tts ${resp.status}`);
          const ct = resp.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            // Fallback path will manage its own speak counter
            bumpSpeak(-1); settled = true;
            speakWebFallback(text, onEnd);
            return;
          }
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          const a = new Audio(url);
          a.preload = "auto";
          audioRef.current = a;
          a.onended = finish;
          a.onerror = () => {
            bumpSpeak(-1); settled = true;
            speakWebFallback(text, onEnd);
          };
          await a.play();
        } catch (e) {
          console.warn("ElevenLabs TTS failed, falling back", e);
          bumpSpeak(-1); settled = true;
          speakWebFallback(text, onEnd);
        }
      })();
    },
    [prefs, stop, speakWebFallback, bumpSpeak],
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

  // Auto-recovery: if Scribe disconnects unexpectedly while we believe we're listening,
  // surface any captured text and clear UI state cleanly.
  const wasConnectedRef = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    languageCode: "fr",
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

  useEffect(() => {
    if (isNative) return;
    const connected = !!(scribe as any).isConnected;
    if (wasConnectedRef.current && !connected && listening) {
      const out = (finalRef.current || liveRef.current).trim();
      finalRef.current = "";
      liveRef.current = "";
      setListening(false);
      if (out) onResultRef.current?.(out);
      else onErrorRef.current?.("Micro coupé — touche pour reprendre");
    }
    wasConnectedRef.current = connected;
  }, [(scribe as any).isConnected, listening]);


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
        setListening(true);
        nativeStartListening(
          (partial) => {
            onPartialRef.current?.(partial);
          },
          (finalText) => {
            setListening(false);
            if (finalText.trim()) onResultRef.current?.(finalText);
          },
          { silenceMs: 1800, maxMs: 20000 },
        ).then((ok) => {
          if (!ok) {
            setListening(false);
            onErrorRef.current?.("Micro indisponible");
          }
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
    speak, stop, speakSentence,
    sttSupported, listening, startListening, stopListening,
  };
}
