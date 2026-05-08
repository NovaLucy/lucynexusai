import { useEffect, useState } from "react";
import { toast } from "sonner";
import OrbCanvas from "@/apn/OrbCanvas";
import TopBar from "@/apn/TopBar";
import Composer from "@/apn/Composer";
import ChatLog from "@/apn/ChatLog";
import ControlsDrawer from "@/apn/ControlsDrawer";
import AsciiSidebarLeft from "@/apn/AsciiSidebarLeft";
import AsciiSidebarRight from "@/apn/AsciiSidebarRight";
import AmbientChars from "@/apn/AmbientChars";
import MedicalReport from "@/apn/MedicalReport";
import Face from "@/apn/Face";
import { useFaceApparition, type FaceFrequency } from "@/apn/useFaceApparition";
import { useIsMobile } from "@/hooks/use-mobile";
import Onboarding from "@/apn/auth/Onboarding";
import Lock from "@/apn/auth/Lock";
import { useAuth } from "@/apn/auth/useAuth";
import { matchCommand } from "@/apn/voiceCommands";
import { useAPN } from "@/apn/useAPN";
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
  const faceVisible = useFaceApparition(faceFrequency, 3200);

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

  const extractHealth = (userMessage: string) => {
    if (!medicalMode) return;
    const recent = apn.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    fetch(MEDICAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

  const handlePhoto = (dataUrl: string) => {
    void dataUrl;
    handleSend("Je viens de te partager une photo. Qu'est-ce que tu en penses ?");
  };

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

  const handleSend = async (text: string) => {
    if (busy) return;
    if (runCommand(matchCommand(text))) return;
    setBusy(true);
    tapLight();
    voice.stop();
    extractHealth(text);
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
      <main className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-xs text-foreground/40">[APN] init…</div>
      </main>
    );
  }
  if (auth.status === "needs-enrollment") {
    return <Onboarding onDone={auth.onEnrolled} />;
  }
  if (auth.status === "locked") {
    return <Lock onUnlock={auth.unlock} onReset={auth.onReset} />;
  }

  return (
    <main
      className="relative w-screen overflow-hidden bg-black flex flex-col"
      style={{ height: "100dvh" }}
    >
      <h1 className="sr-only">APN — Agent Personnel Numérique</h1>

      {/* Ambient floating chars background */}
      <div className="absolute inset-0 pointer-events-none">
        <AmbientChars />
      </div>

      {/* Top bar */}
      <div className="relative z-20 pt-safe pl-safe pr-safe">
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
        />
      </div>

      {medicalMode && (
        <div className="relative z-20 px-3 py-1 text-[10px] uppercase tracking-widest text-center bg-red-950/40 text-red-200 border-b border-red-900/60">
          ⚠ MODE PRÉ-MÉDECIN — APN n'est pas un médecin. Aide à la préparation, pas un diagnostic.
        </div>
      )}

      {/* Mobile-only compact stat strip (replaces hidden sidebars) */}
      <div className="md:hidden relative z-20 flex items-center gap-3 px-3 py-1 text-[10px] uppercase tracking-widest border-b ascii-border bg-black/60 overflow-x-auto">
        <span className="text-foreground/50">MSG <span className="text-foreground tabular-nums">{String(apn.profile?.message_count ?? apn.messages.length).padStart(3, "0")}</span></span>
        <span className="text-foreground/30">│</span>
        <span className="text-foreground/50">STATE <span className="mood-text">{apn.state.slice(0, 4).toUpperCase()}</span></span>
        <span className="text-foreground/30">│</span>
        <span className="text-foreground/50">MOOD <span className="mood-text">{apn.mood.slice(0, 4).toUpperCase()}</span></span>
        {apn.profile?.last_topic && (
          <>
            <span className="text-foreground/30">│</span>
            <span className="text-foreground/50 truncate">› <span className="mood-text">{apn.profile.last_topic.slice(0, 18)}</span></span>
          </>
        )}
      </div>

      {/* 3-column layout */}
      <div className="relative z-10 flex-1 flex min-h-0">
        <AsciiSidebarLeft state={apn.state} />

        {/* Center: orb */}
        <section className="relative flex-1 flex flex-col min-w-0">
          {/* Orb container */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-3">
            <div className="relative ascii-border-dashed scanlines"
              style={{
                width: isMobile ? "min(58dvh, 96%)" : "min(72dvh, 92%)",
                aspectRatio: "1 / 1",
                maxHeight: "100%",
              }}
            >
              {/* corner labels */}
              <div className="absolute -top-3 left-2 px-1 bg-black text-[10px] uppercase tracking-widest mood-text">
                ┌─ NEURAL CORE ─┐
              </div>
              <div className="absolute -top-3 right-2 px-1 bg-black text-[10px] tabular-nums text-foreground/40">
                [{apn.state.toUpperCase().slice(0, 4)}]
              </div>
              <div className="absolute -bottom-3 left-2 px-1 bg-black text-[10px] text-foreground/40 tabular-nums">
                FREQ:{(apn.mood.charCodeAt(0) * 7).toString(16).toUpperCase()}HZ
              </div>
              <div className="absolute -bottom-3 right-2 px-1 bg-black text-[10px] text-foreground/40">
                └─ v0.1 ─┘
              </div>

              <OrbCanvas state={apn.state} mood={apn.mood} intensity={intensity} pixelRatioCap={pixelRatio} />

              {/* Face apparition overlay */}
              {faceVisible && (
                <div
                  key={`face-${Date.now()}`}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none face-apparition"
                >
                  <Face mood={apn.mood} state={apn.state} size={isMobile ? "md" : "lg"} blink variant="overlay" />
                </div>
              )}
            </div>
          </div>

          {/* Caption */}
          <div className="px-4 pb-3 text-center" aria-live="polite">
            <p className="font-mono text-xs sm:text-sm uppercase tracking-widest mood-text">
              <span className="text-foreground/40">{">"} </span>
              {apn.caption}
              <span className="cursor-blink" />
            </p>
          </div>
        </section>

        <AsciiSidebarRight
          msgCount={apn.profile?.message_count ?? apn.messages.length}
          topic={apn.profile?.last_topic}
          loops={loops}
          name={apn.profile?.display_name}
        />
      </div>

      {/* Composer at bottom */}
      <div
        className="relative z-20 pl-safe pr-safe transition-[padding] duration-200"
        style={{ paddingBottom: "calc(var(--keyboard-h, 0px) + max(env(safe-area-inset-bottom), 0px))" }}
      >
        <Composer
          onSend={(t) => { setComposerText(""); handleSend(t); }}
          onMic={handleMic}
          onPhoto={handlePhoto}
          micActive={voice.listening}
          sttSupported={voice.sttSupported}
          disabled={busy}
          value={composerText}
          onValueChange={setComposerText}
          polishEnabled={polishEnabled}
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
      />
      <MedicalReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={apn.sessionId}
      />
    </main>
  );
}
