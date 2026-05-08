import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  captureFaceEmbedding,
  euclidean,
  loadEnrollment,
  loadFaceModels,
  passphraseMatch,
  resetEnrollment,
} from "./biometry";

interface Props {
  onUnlock: () => void;
  onReset: () => void;
}

const FACE_THRESHOLD = 0.55; // euclidean — lower = stricter
const VOICE_THRESHOLD = 0.65; // 0..1 fuzzy

export default function Lock({ onUnlock, onReset }: Props) {
  const [stage, setStage] = useState<"face" | "voice" | "pin">("face");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pin, setPin] = useState("");
  const [voiceInput, setVoiceInput] = useState("");
  const [faceOk, setFaceOk] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<any>(null);

  useEffect(() => {
    if (stage !== "face") return;
    let cancelled = false;
    (async () => {
      try {
        await loadFaceModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        toast.error("Caméra indisponible");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [stage]);

  const tryFace = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    const emb = await captureFaceEmbedding(videoRef.current);
    if (!emb) {
      setBusy(false);
      toast.error("Visage non détecté");
      return;
    }
    setBusy(false);
    setStage("pin");
  };

  const tryVoice = async () => {
    const Rec: any =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Rec) {
      toast.error("Reconnaissance vocale indisponible — passe au PIN");
      setStage("pin");
      return;
    }
    const rec = new Rec();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognizerRef.current = rec;
    setBusy(true);
    rec.onresult = (e: any) => {
      const t = e?.results?.[0]?.[0]?.transcript ?? "";
      setVoiceInput(t);
      setBusy(false);
      toast.info(`Entendu : « ${t} »`);
    };
    rec.onerror = () => {
      setBusy(false);
      toast.error("Voix non captée");
    };
    rec.onend = () => setBusy(false);
    try { rec.start(); } catch { setBusy(false); }
  };

  const validate = async () => {
    if (pin.length < 4) return toast.error("PIN trop court");
    setBusy(true);
    const data = await loadEnrollment(pin);
    setBusy(false);
    if (!data) {
      const next = attempts + 1;
      setAttempts(next);
      toast.error(`PIN invalide (${next}/5)`);
      if (next >= 5) {
        toast.error("Trop d'échecs — réinitialisation requise");
      }
      return;
    }

    let faceMatched = faceOk;
    if (!faceMatched && videoRef.current && streamRef.current) {
      const emb = await captureFaceEmbedding(videoRef.current);
      if (emb) {
        const best = Math.min(
          ...data.faceEmbeddings.map((ref) => euclidean(emb, ref)),
        );
        faceMatched = best <= FACE_THRESHOLD;
      }
    }

    const voiceScore = passphraseMatch(voiceInput, data.voicePassphrase);
    const voiceOk = voiceScore >= VOICE_THRESHOLD;

    if (faceMatched && voiceOk) {
      toast.success("Bienvenue");
      onUnlock();
    } else if (!faceMatched && !voiceOk) {
      toast.error("Visage et voix non reconnus — accès refusé");
    } else if (!faceMatched) {
      toast.error("Visage non reconnu");
    } else {
      toast.error(
        `Phrase incorrecte (score ${(voiceScore * 100).toFixed(0)}%)`,
      );
    }
  };

  const doReset = () => {
    if (!confirm("Effacer le profil biométrique ?")) return;
    resetEnrollment();
    onReset();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md ascii-border-dashed p-5 space-y-4 font-mono">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest mood-text">[APN] VERROUILLÉ</div>
          <div className="text-[10px] text-foreground/50 mt-1">
            Visage + voix + PIN
          </div>
        </div>

        {stage === "face" && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full aspect-[4/3] bg-black border border-foreground/20"
            />
            <div className="flex gap-2">
              <button className="bracket-btn flex-1" disabled={busy} onClick={tryFace}>
                [{busy ? "..." : "VÉRIFIER VISAGE"}]
              </button>
              <button className="bracket-btn" onClick={() => setStage("voice")}>
                [PASSER]
              </button>
            </div>
          </div>
        )}

        {stage === "voice" && (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60">Prononce ta phrase secrète.</p>
            <button className="bracket-btn w-full" disabled={busy} onClick={tryVoice}>
              [{busy ? "ÉCOUTE..." : "🎤 PARLER"}]
            </button>
            {voiceInput && (
              <div className="text-[10px] text-foreground/40 italic">
                « {voiceInput} »
              </div>
            )}
            <button
              className="bracket-btn w-full"
              disabled={!voiceInput}
              onClick={() => setStage("pin")}
            >
              [SUIVANT]
            </button>
          </div>
        )}

        {stage === "pin" && (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60">PIN pour déchiffrer le profil</p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN"
              className="w-full bg-black border border-foreground/30 px-2 py-2 text-sm tracking-widest focus:outline-none focus:border-foreground/70"
              onKeyDown={(e) => e.key === "Enter" && validate()}
            />
            <button className="bracket-btn w-full" disabled={busy} onClick={validate}>
              [{busy ? "..." : "DÉVERROUILLER"}]
            </button>
            {voiceInput === "" && (
              <button className="bracket-btn w-full" onClick={() => setStage("voice")}>
                [← REVENIR À LA VOIX]
              </button>
            )}
          </div>
        )}

        <button
          className="text-[10px] text-foreground/40 hover:text-foreground/70 w-full text-center"
          onClick={doReset}
        >
          réinitialiser le profil
        </button>
      </div>
    </div>
  );
}
