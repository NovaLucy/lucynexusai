// Voice abstraction: native plugins on iOS/Android, Web Speech API fallback in browser.
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

const isNative = Capacitor.isNativePlatform();

// ---------- TTS ----------
export async function nativeSpeak(text: string, opts: { rate?: number; pitch?: number } = {}) {
  if (!isNative) return false;
  try {
    await TextToSpeech.stop();
    await TextToSpeech.speak({
      text,
      lang: "fr-FR",
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      volume: 1.0,
      category: "ambient",
    });
    return true;
  } catch (e) {
    console.warn("nativeSpeak failed", e);
    return false;
  }
}

export async function nativeStopTTS() {
  if (!isNative) return;
  try { await TextToSpeech.stop(); } catch {}
}

// ---------- STT ----------
export async function nativeSttSupported(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { available } = await SpeechRecognition.available();
    return !!available;
  } catch {
    return false;
  }
}

export async function nativeRequestSttPerms(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { permission } = await SpeechRecognition.checkPermissions() as any;
    if (permission === "granted") return true;
    const r = await SpeechRecognition.requestPermissions() as any;
    return r?.permission === "granted" || r?.speechRecognition === "granted";
  } catch {
    return false;
  }
}

export async function nativeStartListening(onResult: (text: string) => void): Promise<boolean> {
  if (!isNative) return false;
  const ok = await nativeRequestSttPerms();
  if (!ok) return false;
  try {
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener("partialResults", (data: any) => {
      const t = data?.matches?.[0];
      if (t) onResult(t);
    });
    await SpeechRecognition.start({
      language: "fr-FR",
      maxResults: 1,
      prompt: "",
      partialResults: true,
      popup: false,
    });
    return true;
  } catch (e) {
    console.warn("nativeStartListening failed", e);
    return false;
  }
}

export async function nativeStopListening() {
  if (!isNative) return;
  try { await SpeechRecognition.stop(); } catch {}
}
