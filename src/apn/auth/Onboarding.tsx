import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  captureFaceEmbedding,
  enroll,
  loadFaceModels,
  normalizePassphrase,
} from "./biometry";

interface Props {
  onDone: () => void;
}

type Step = "intro" | "face" | "voice" | "pin" | "saving";

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [faceShots, setFaceShots] = useState<number[][]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // start camera when entering face step
  useEffect(() => {
    if (step !== "face") return;
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
        toast.error("Caméra indisponible : " + (e?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [step]);

  const captureShot = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    const emb = await captureFaceEmbedding(videoRef.current);
    setBusy(false);
    if (!emb) {
      toast.error("Aucun visage détecté, recadre-toi face caméra.");
      return;
    }
    setFaceShots((prev) => [...prev, Array.from(emb)]);
    toast.success(`Capture ${faceShots.length + 1}/3`);
  };

  const finalize = async () => {
    if (pin.length < 4) return toast.error("PIN ≥ 4 chiffres");
    if (pin !== pin2) return toast.error("PIN différent");
    setStep("saving");
    try {
      await enroll({
        faceEmbeddings: faceShots,
        voicePassphrase: normalizePassphrase(passphrase),
        pin,
      });
      toast.success("Profil créé");
      onDone();
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message ?? e));
      setStep("pin");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md ascii-border-dashed p-5 space-y-4 font-mono">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest mood-text">[LUCY] ENRÔLEMENT</div>
          <div className="text-[10px] text-foreground/50 mt-1">
            Visage + voix + PIN — stockés localement, chiffrés, jamais envoyés.
          </div>
        </div>

        {step === "intro" && (
          <div className="space-y-3 text-sm">
            <p>Pour protéger tes données, Lucy se verrouille derrière :</p>
            <ul className="text-xs text-foreground/70 list-disc pl-5 space-y-1">
              <li>3 captures de ton <b>visage</b></li>
              <li>une <b>phrase secrète</b> à prononcer</li>
              <li>un <b>code PIN</b> de secours</li>
            </ul>
            <button className="bracket-btn w-full" onClick={() => setStep("face")}>
              [COMMENCER]
            </button>
          </div>
        )}

        {step === "face" && (
          <div className="space-y-3">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full aspect-[4/3] bg-black border border-foreground/20"
            />
            <div className="text-xs text-foreground/60 text-center">
              Captures : {faceShots.length} / 3
            </div>
            <div className="flex gap-2">
              <button
                className="bracket-btn flex-1"
                onClick={captureShot}
                disabled={busy || faceShots.length >= 3}
              >
                [{busy ? "..." : "CAPTURER"}]
              </button>
              <button
                className="bracket-btn flex-1"
                disabled={faceShots.length < 3}
                onClick={() => setStep("voice")}
              >
                [SUIVANT]
              </button>
            </div>
          </div>
        )}

        {step === "voice" && (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60">
              Choisis une phrase secrète (5-30 caractères) que tu prononceras pour te connecter.
            </p>
            <input
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="ex: ouvre toi sésame"
              className="w-full bg-black border border-foreground/30 px-2 py-2 text-sm focus:outline-none focus:border-foreground/70"
            />
            <button
              className="bracket-btn w-full"
              disabled={normalizePassphrase(passphrase).length < 5}
              onClick={() => setStep("pin")}
            >
              [SUIVANT]
            </button>
          </div>
        )}

        {step === "pin" && (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60">PIN de secours (≥ 4 chiffres)</p>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN"
              className="w-full bg-black border border-foreground/30 px-2 py-2 text-sm tracking-widest focus:outline-none focus:border-foreground/70"
            />
            <input
              type="password"
              inputMode="numeric"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirmer"
              className="w-full bg-black border border-foreground/30 px-2 py-2 text-sm tracking-widest focus:outline-none focus:border-foreground/70"
            />
            <button className="bracket-btn w-full" onClick={finalize}>
              [VALIDER]
            </button>
          </div>
        )}

        {step === "saving" && (
          <div className="text-center text-xs text-foreground/60 py-6">Chiffrement…</div>
        )}
      </div>
    </div>
  );
}
