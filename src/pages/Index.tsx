import { useEffect, useState } from "react";
import { toast } from "sonner";
import OrbCanvas from "@/apn/OrbCanvas";
import MicroHUD from "@/apn/MicroHUD";
import Composer from "@/apn/Composer";
import ChatLog from "@/apn/ChatLog";
import ControlsDrawer from "@/apn/ControlsDrawer";
import { useAPN } from "@/apn/useAPN";
import { useVoice } from "@/apn/useVoice";

export default function Index() {
  const apn = useAPN();
  const voice = useVoice();
  const [intensity, setIntensity] = useState(1.0);
  const [pixelRatio, setPixelRatio] = useState(1.5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (apn.error) toast.error(apn.error);
  }, [apn.error]);

  const handleSend = async (text: string) => {
    if (busy) return;
    setBusy(true);
    voice.stop();
    await apn.send(text, {
      onAssistantStart: () => {},
      onAssistantEnd: (full) => {
        if (voice.prefs.enabled) {
          voice.speak(full, () => apn.setStandby());
        } else {
          apn.setStandby();
        }
        setBusy(false);
      },
    });
    setBusy(false);
  };

  const handleMic = () => {
    if (voice.listening) {
      voice.stopListening();
      apn.setListeningState(false);
      return;
    }
    apn.setListeningState(true);
    const ok = voice.startListening((text) => {
      apn.setListeningState(false);
      if (text.trim()) handleSend(text);
    });
    if (!ok) {
      apn.setListeningState(false);
      toast.error("La reconnaissance vocale n'est pas disponible sur ce navigateur.");
    }
  };

  const knowsYou = !!(apn.profile?.display_name || apn.profile?.message_count);

  return (
    <main
      className="relative w-screen overflow-hidden"
      style={{ backgroundColor: "#03040a", height: "100dvh" }}
    >
      <h1 className="sr-only">APN — Agent Personnel Numérique</h1>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-3 pt-safe pl-safe pr-safe">
        <div className="pt-3 flex items-center gap-2">
          <MicroHUD state={apn.state} />
          {knowsYou && apn.profile?.display_name && (
            <span className="hidden sm:inline glass rounded-full px-3 py-1.5 text-[11px] uppercase tracking-widest text-foreground/70">
              {apn.profile.display_name}
            </span>
          )}
        </div>
        <div className="pt-3 flex items-center gap-2">
          <ChatLog messages={apn.messages} />
          <ControlsDrawer
            voiceEnabled={voice.prefs.enabled}
            setVoiceEnabled={(v) => voice.setPrefs({ ...voice.prefs, enabled: v })}
            voices={voice.voices}
            voiceURI={voice.prefs.voiceURI}
            setVoiceURI={(v) => voice.setPrefs({ ...voice.prefs, voiceURI: v })}
            rate={voice.prefs.rate}
            setRate={(n) => voice.setPrefs({ ...voice.prefs, rate: n })}
            pitch={voice.prefs.pitch}
            setPitch={(n) => voice.setPrefs({ ...voice.prefs, pitch: n })}
            intensity={intensity}
            setIntensity={setIntensity}
            pixelRatio={pixelRatio}
            setPixelRatio={setPixelRatio}
            onTestVoice={() => voice.speak("Bonjour. Je suis APN. Je suis prêt à t'aider.")}
            onStopVoice={() => voice.stop()}
          />
        </div>
      </div>

      {/* Orbe centrée */}
      <div
        className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ width: "min(58dvh, 88vw)", height: "min(58dvh, 88vw)" }}
      >
        <OrbCanvas state={apn.state} mood={apn.mood} intensity={intensity} pixelRatioCap={pixelRatio} />
      </div>

      {/* Caption d'état */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none px-4"
        style={{ top: "calc(40% + min(29dvh, 44vw) + 18px)" }}
        aria-live="polite"
      >
        <p className="font-display text-lg sm:text-xl tracking-wide mood-text drop-shadow-[0_0_18px_hsl(var(--mood)/0.4)]">
          {apn.caption}
        </p>
      </div>

      {/* Composer — bottom, safe-area aware */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 w-full flex justify-center px-3 pb-safe"
        style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <Composer
          onSend={handleSend}
          onMic={handleMic}
          micActive={voice.listening}
          sttSupported={voice.sttSupported}
          disabled={busy}
        />
      </div>
    </main>
  );
}
