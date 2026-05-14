import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// OrbCanvas remplacé par VolumetricFace (AGI core)
import Composer from "@/apn/Composer";
import ChatLog from "@/apn/ChatLog";
import ControlsDrawer from "@/apn/ControlsDrawer";
import AmbientChars from "@/apn/AmbientChars";
import MedicalReport from "@/apn/MedicalReport";
import VolumetricFace from "@/apn/agi/MoodBubble";
import Subtitles from "@/apn/Subtitles";
import { pickWakeGreeting } from "@/apn/wakeGreeting";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Archive, Settings, Stethoscope, LogOut, Keyboard } from "lucide-react";

import { useFaceApparition, type FaceFrequency } from "@/apn/useFaceApparition";
import { useReality } from "@/apn/useReality";
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
  const reality = useReality();
  const [intensity, setIntensity] = useState(1.0);
  const [pixelRatio, setPixelRatio] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 1.25 : 1.5));
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerOpen, setComposerOpen] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem("lucy:composer") ?? "false"); } catch { return false; }
  });
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
  const lastWakeGreetingAtRef = useRef<number>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSentence, setCurrentSentence] = useState<string | null>(null);
  const navigate = useNavigate();

  // Streaming assistant text (for live caption before first full sentence)
  const lastAssistant = apn.messages.length > 0 && apn.messages[apn.messages.length - 1].role === "assistant"
    ? apn.messages[apn.messages.length - 1].content
    : "";

  // Mark activity (resets sleep timer + wakes if sleeping)
  const wakeRef = useRef<() => void>(() => {});
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (apn.state === "sleeping") wakeRef.current();
  }, [apn.state]);

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

  const handleMicRef = useRef<() => void>(() => {});

  const ttsBufferRef = useRef("");
  const ttsSpokenRef = useRef(0);

  const flushTTS = useCallback((full: string, end?: boolean) => {
    const raw = full.slice(ttsSpokenRef.current);
    if (!raw && !end) return;
    ttsBufferRef.current += raw;
    ttsSpokenRef.current = full.length;
    if (!end) {
      const m = ttsBufferRef.current.match(/(.+?[.!?…])(\s+|$)/);
      if (!m) return;
      const sentence = m[1].trim();
      ttsBufferRef.current = ttsBufferRef.current.slice(m[0].length);
      setCurrentSentence(sentence);
      if (voice.prefs.enabled) voice.speakSentence(sentence);
    } else {
      if (ttsBufferRef.current.trim()) {
        const sentence = ttsBufferRef.current.trim();
        setCurrentSentence(sentence);
        if (voice.prefs.enabled) voice.speakSentence(sentence);
      }
      ttsBufferRef.current = "";
    }
  }, [voice]);

  // Speak a synthetic line (e.g. wake greeting) — visible in subtitles + voiced.
  const speakLine = useCallback((line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    setCurrentSentence(trimmed);
    if (voice.prefs.enabled) voice.speakSentence(trimmed);
    window.setTimeout(() => {
      setCurrentSentence((cur) => (cur === trimmed ? null : cur));
    }, Math.max(2200, trimmed.length * 70));
  }, [voice]);

  const wakeWithGreeting = useCallback(() => {
    apn.wake();
    const now = Date.now();
    if (now - lastWakeGreetingAtRef.current < 30_000) return;
    lastWakeGreetingAtRef.current = now;
    const line = pickWakeGreeting({
      lastInteractionAt: lastActivityRef.current,
      displayName: apn.profile?.display_name ?? null,
      lastTopic: apn.profile?.last_topic ?? null,
    });
    speakLine(line);
  }, [apn, speakLine]);
  wakeRef.current = wakeWithGreeting;

  const handleSend = async (text: string, imageDataUrl?: string) => {
    if (busy) return;
    markActivity();
    if (!imageDataUrl && runCommand(matchCommand(text))) return;
    setBusy(true);
    tapLight();
    voice.stop();
    ttsBufferRef.current = "";
    ttsSpokenRef.current = 0;
    setCurrentSentence(null);
    playRitual("open");
    if (text) extractHealth(text);
    const realitySnap = await reality.snapshot(!imageDataUrl);
    await apn.send(text, {
      onAssistantStart: () => {},
      onAssistantChunk: (fullSoFar) => {
        flushTTS(fullSoFar);
      },
      onAssistantEnd: (full) => {
        flushTTS(full, true);
        if (voice.prefs.enabled) {
          // If no native TTS fired (empty or single word), ensure we speak the full
          if (ttsSpokenRef.current === 0) {
            voice.speak(full, () => {
              apn.setStandby();
              playRitual("close");
              window.setTimeout(() => {
                if (!voice.listening && voice.sttSupported) handleMicRef.current();
              }, 350);
            });
          } else {
            apn.setStandby();
            playRitual("close");
            window.setTimeout(() => {
              if (!voice.listening && voice.sttSupported) handleMicRef.current();
            }, 350);
          }
        } else {
          apn.setStandby();
          playRitual("close");
        }
        setBusy(false);
      },
    }, { imageDataUrl, reality: realitySnap });
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
  handleMicRef.current = handleMic;

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

      {/* Floating menu (replaces TopBar) — discreet access to controls */}
      <div className="absolute top-0 right-0 z-30 pt-safe pr-safe">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="m-3 p-2 rounded-full text-foreground/30 hover:text-foreground/80 hover:bg-foreground/[0.04] transition-colors"
          aria-label="Menu"
          title="Menu"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-3 top-12 z-40 dark-matter !border-0 rounded-2xl py-2 px-1 min-w-[200px] flex flex-col text-xs text-foreground/80 shadow-xl">
              <button
                onClick={() => { setMenuOpen(false); setLogOpen(true); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.05] text-left"
              >
                <Archive className="w-3.5 h-3.5 opacity-60" /> Journal
              </button>
              <button
                onClick={() => { setMenuOpen(false); setCfgOpen(true); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.05] text-left"
              >
                <Settings className="w-3.5 h-3.5 opacity-60" /> Réglages
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setMedicalMode((v) => !v);
                  toast.info(!medicalMode ? "Mode pré-médecin activé" : "Mode pré-médecin désactivé");
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.05] text-left ${medicalMode ? "text-red-300/90" : ""}`}
              >
                <Stethoscope className="w-3.5 h-3.5 opacity-60" /> Mode pré-médecin
              </button>
              <div className="h-px my-1 bg-foreground/[0.06]" />
              <button
                onClick={() => { setMenuOpen(false); navigate("/logout"); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.05] text-left"
              >
                <LogOut className="w-3.5 h-3.5 opacity-60" /> Déconnexion
              </button>
            </div>
          </>
        )}
      </div>

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
                  if (apn.state === "sleeping") {
                    playRitual("open");
                    wakeWithGreeting();
                    lastActivityRef.current = Date.now();
                  } else {
                    markActivity();
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

          <Subtitles
            streamingText={lastAssistant}
            currentSentence={currentSentence}
            idleCaption={apn.caption}
            speaking={speakingPinned}
          />
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
      <ChatLog
        messages={apn.messages}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onClear={async () => {
          await apn.clearSession();
          toast.success("Session effacée");
        }}
        sessionId={apn.sessionId}
      />
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
        locEnabled={reality.locEnabled}
        setLocEnabled={reality.setLocEnabled}
        camEnabled={reality.camEnabled}
        setCamEnabled={reality.setCamEnabled}
        facing={reality.facing}
        setFacing={reality.setFacing}
        locationLabel={reality.location?.label ?? (reality.location ? `${reality.location.lat.toFixed(2)}, ${reality.location.lon.toFixed(2)}` : null)}
        nowLabel={`${reality.now.weekday} ${reality.now.dateLabel}, ${String(reality.now.hour).padStart(2, "0")}h${String(reality.now.minute).padStart(2, "0")}`}
      />
      <MedicalReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        sessionId={apn.sessionId}
      />
    </main>
  );
}
