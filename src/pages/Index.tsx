import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// OrbCanvas remplacé par VolumetricFace (AGI core)
import TopBar from "@/apn/TopBar";
import Composer from "@/apn/Composer";
import ChatLog from "@/apn/ChatLog";
import ControlsDrawer from "@/apn/ControlsDrawer";
import AmbientChars from "@/apn/AmbientChars";
import MedicalReport from "@/apn/MedicalReport";
import VolumetricFace from "@/apn/agi/MoodBubble";

import { useFaceApparition, type FaceFrequency } from "@/apn/useFaceApparition";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/apn/auth/useAuth";
import { matchCommand } from "@/apn/voiceCommands";
import { useAPN } from "@/apn/useAPN";
import { supabase } from "@/integrations/supabase/client";
import { useVoice } from "@/apn/useVoice";
import { tapLight, tapMedium } from "@/native";
import { cancelAllAPNNotifs, scheduleAPNFollowup } from "@/apn/notifications";

const MEDICAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apn-medical`;

export default function Index() {
  const auth = useAuth();
  const apn = useAPN();
  const voice = useVoice();
  const isMobile = useIsMobile();
  const [intensity, setIntensity] = useState(1.0);
  const [pixelRatio, setPixelRatio] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 1.25 : 1.5));
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [polishEnabled, setPolishEnabled] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem("apn:polish") ?? "true"); } catch { return true; }
  });
  const [medicalMode, setMedicalMode] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem("apn:medical") ?? "false"); } catch { return false; }
  });
  const [faceFrequency, setFaceFrequency] = useState<FaceFrequency>(() => {
    try { return (localStorage.getItem("apn:face") as FaceFrequency) ?? "normal"; } catch { return "normal"; }
  });
  const speakingPinned = apn.state === "speaking" || apn.state === "thinking";
  const { trigger: triggerFace } = useFaceApparition(faceFrequency, {
    pinned: speakingPinned && faceFrequency !== "off",
    showMs: 4800,
  });
  const [shockKey, setShockKey] = useState(0);
  const [ritual, setRitual] = useState<"open" | "close" | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Mark activity (resets sleep timer + wakes if sleeping)
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (apn.state === "sleeping") apn.wake();
  }, [apn]);

  // Auto-sleep after 90s of inactivity (only from standby)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (apn.state !== "standby") return;
      if (Date.now() - lastActivityRef.current > 90_000) {
        apn.setSleeping();
      }
    }, 5_000);
    return () => window.clearInterval(id);
  }, [apn.state, apn]);

  // Trigger ritual on activity transitions
  const playRitual = useCallback((kind: "open" | "close") => {
    setRitual(kind);
    window.setTimeout(() => setRitual(null), kind === "open" ? 4800 : 1500);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("apn:polish", JSON.stringify(polishEnabled)); } catch {}
  }, [polishEnabled]);
  useEffect(() => {
    try { localStorage.setItem("apn:medical", JSON.stringify(medicalMode)); } catch {}
  }, [medicalMode]);
  useEffect(() => {
    try { localStorage.setItem("apn:face", faceFrequency); } catch {}
  }, [faceFrequency]);

  useEffect(() => {
    if (apn.error) toast.error(apn.error);
  }, [apn.error]);

  useEffect(() => {
    if (!apn.profile?.message_count) return;
    const topic = apn.profile.last_topic ?? (apn.profile.open_loops?.[0] as any)?.topic;
    if (!topic) return;
    cancelAllAPNNotifs().then(() => {
      scheduleAPNFollowup({
        title: "APN",
        body: `Tu pensais à "${topic}". Tu en es où ?`,
        inMinutes: 60 * 4,
      });
    });
  }, [apn.profile?.message_count, apn.profile?.last_topic]);

  const extractHealth = async (userMessage: string) => {
    if (!medicalMode) return;
    const recent = apn.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return; // medical extraction requires authenticated user
    fetch(MEDICAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "extract",
        sessionId: apn.sessionId,
        userMessage,
        recent,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        const flags: string[] = j?.extracted?.red_flags ?? [];
        if (flags.length > 0) {
          toast.error(`⚠ Drapeau rouge détecté : ${flags.join(", ")}. Consulter en urgence.`, {
            duration: 8000,
          });
        } else if (j?.saved) {
          toast.success("Information santé enregistrée");
        }
      })
      .catch(() => {});
  };

  // (vision intégrée au composer : la photo est envoyée avec le message via handleSend)

  const runCommand = (cmd: ReturnType<typeof matchCommand>) => {
    if (!cmd) return false;
    switch (cmd.action.type) {
      case "medical": setMedicalMode(cmd.action.value); break;
      case "voice":   voice.setPrefs({ ...voice.prefs, enabled: cmd.action.value }); break;
      case "polish":  setPolishEnabled(cmd.action.value); break;
      case "openLog": setLogOpen(true); break;
      case "openCfg": setCfgOpen(true); break;
      case "report":  setReportOpen(true); break;
    }
    toast.success(`⌘ ${cmd.label}`);
    return true;
  };

  const handleSend = async (text: string, imageDataUrl?: string) => {
    if (busy) return;
    markActivity();
    if (!imageDataUrl && runCommand(matchCommand(text))) return;
    setBusy(true);
    tapLight();
    voice.stop();
    playRitual("open");
    if (text) extractHealth(text);
    await apn.send(text, {
      onAssistantStart: () => {},
      onAssistantEnd: (full) => {
        if (voice.prefs.enabled) {
          voice.speak(full, () => { apn.setStandby(); playRitual("close"); });
        } else {
          apn.setStandby();
          playRitual("close");
        }
        setBusy(false);
      },
    }, { imageDataUrl });
    setBusy(false);
  };

  const handleMic = () => {
    markActivity();
    if (voice.listening) {
      voice.stopListening();
      apn.setListeningState(false);
      return;
    }
    tapMedium();
    apn.setListeningState(true);
    setComposerText("");
    const ok = voice.startListening(
      (text) => {
        apn.setListeningState(false);
        setComposerText("");
        if (text.trim()) handleSend(text);
      },
      (partial) => {
        setComposerText(partial);
      },
      (errMsg) => {
        apn.setListeningState(false);
        toast.error(errMsg);
      },
    );
    if (!ok) {
      apn.setListeningState(false);
      toast.error("La reconnaissance vocale n'est pas disponible.");
    }
  };

  const loops = apn.profile?.open_loops?.length ?? 0;

  if (auth.status === "loading") {
    return (
      <main className="w-screen h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-xs text-foreground/40">[APN] init…</div>
      </main>
    );
  }

  return (
    <main
      className="relative w-screen overflow-hidden bg-background flex flex-col mood-ambient"
      style={{ height: "100dvh" }}
      data-state={apn.state}
      data-mood={apn.mood}
    >
      <h1 className="sr-only">APN — Agent Personnel Numérique</h1>

      {/* Ambient floating chars background (subtle) */}
      <div className="absolute inset-0 pointer-events-none z-[1] opacity-[0.08]">
        <AmbientChars />
      </div>

      {/* Top bar */}
      <div className="relative z-20 pt-safe pl-safe pr-safe float-soft-2">
        <TopBar
          state={apn.state}
          mood={apn.mood}
          name={apn.profile?.display_name}
          onOpenLog={() => setLogOpen(true)}
          onOpenCfg={() => setCfgOpen(true)}
          medicalMode={medicalMode}
          onToggleMedical={() => {
            setMedicalMode((v) => !v);
            toast.info(!medicalMode ? "Mode pré-médecin activé" : "Mode pré-médecin désactivé");
          }}
          syncStatus={apn.syncStatus}
          lastSyncAt={apn.lastSyncAt}
          sessionId={apn.sessionId}
        />
      </div>

      {medicalMode && (
        <div className="relative z-20 px-3 py-1 text-[10px] uppercase tracking-widest text-center bg-red-950/40 text-red-200 border-b border-red-900/60">
          ⚠ MODE PRÉ-MÉDECIN — APN n'est pas un médecin. Aide à la préparation, pas un diagnostic.
        </div>
      )}

      {/* Center stage — clean, sidebars removed */}
      <div className="relative z-10 flex-1 flex min-h-0">
        <section className="relative flex-1 flex flex-col min-w-0">

          <div className="relative flex-1 flex items-center justify-center z-10">
            <div
              className="relative w-full h-full"
              style={{
                maxHeight: "100%",
              }}
            >
              {/* Pulsing mood halo behind the core */}
              <div className="core-halo" aria-hidden />

              {/* Sleeping veil — darkens corners when APN dozes */}
              <div className="sleeping-veil" aria-hidden />

              {/* Ritual layer — iris + dark-matter wave on interaction edges */}
              {ritual && (
                <div className={`ritual-layer ritual-${ritual}`} aria-hidden>
                  <div className="ritual-iris" />
                  <div className="ritual-wave" />
                  <div className="ritual-wave ritual-wave-2" />
                </div>
              )}

              <div
                className="absolute inset-0 cursor-pointer flex items-center justify-center"
                onClick={() => {
                  tapMedium();
                  markActivity();
                  if (apn.state === "sleeping") {
                    playRitual("open");
                  } else {
                    setShockKey((k) => k + 1);
                    triggerFace(5400, "reveal");
                  }
                }}
                role="button"
                aria-label="Réveiller APN"
              >
                <div className="relative" style={{ width: "85%", height: "85%" }}>
                  <VolumetricFace
                    mood={apn.mood}
                    state={apn.state}
                    speaking={speakingPinned}
                    intensity={intensity}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Caption — soft, human */}
          <div className="px-6 pb-4 text-center relative z-20 float-drift" aria-live="polite">
            <p className="text-base sm:text-xl md:text-2xl font-light tracking-tight text-foreground/85">
              {apn.caption}
            </p>
            <div
              className="mt-3 h-px w-12 mx-auto"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--mood) / 0.5), transparent)",
              }}
            />
          </div>
        </section>
      </div>

      {/* Composer at bottom */}
      <div
        className="relative z-20 pl-safe pr-safe transition-[padding] duration-200 float-soft"
        style={{ paddingBottom: "calc(var(--keyboard-h, 0px) + max(env(safe-area-inset-bottom), 0px))" }}
      >
        <Composer
          onSend={(t, img) => { setComposerText(""); handleSend(t, img); }}
          onMic={handleMic}
          micActive={voice.listening}
          sttSupported={voice.sttSupported}
          disabled={busy}
          value={composerText}
          onValueChange={(v) => { markActivity(); setComposerText(v); }}
          polishEnabled={polishEnabled && !voice.listening}
          mood={apn.mood}
          state={apn.state}
        />
      </div>

      {/* Overlays */}
      <ChatLog messages={apn.messages} open={logOpen} onClose={() => setLogOpen(false)} />
      <ControlsDrawer
        open={cfgOpen}
        onOpenChange={setCfgOpen}
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
        polishEnabled={polishEnabled}
        setPolishEnabled={setPolishEnabled}
        medicalMode={medicalMode}
        setMedicalMode={setMedicalMode}
        onOpenReport={() => { setCfgOpen(false); setReportOpen(true); }}
        faceFrequency={faceFrequency}
        setFaceFrequency={setFaceFrequency}
      />
      <MedicalReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={apn.sessionId}
      />
    </main>
  );
}
