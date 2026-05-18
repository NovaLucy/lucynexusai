import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";

type PermState = "granted" | "denied" | "prompt" | "unknown";

function usePermission(name: "microphone" | "camera"): [PermState, () => Promise<void>] {
  const [state, setState] = useState<PermState>("unknown");

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => { if (!cancelled && status) setState(status.state as PermState); };
    (async () => {
      try {
        status = await navigator.permissions?.query({ name: name as PermissionName });
        if (!status || cancelled) return;
        setState(status.state as PermState);
        status.addEventListener?.("change", onChange);
      } catch {
        setState("unknown");
      }
    })();
    return () => { cancelled = true; status?.removeEventListener?.("change", onChange); };
  }, [name]);

  const request = async () => {
    try {
      const constraints = name === "microphone" ? { audio: true } : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((t) => t.stop());
      setState("granted");
      toast.success(name === "microphone" ? "Micro autorisé" : "Caméra autorisée");
    } catch (e: any) {
      setState("denied");
      toast.error(
        e?.name === "NotAllowedError"
          ? "Permission refusée — active-la dans les réglages du navigateur."
          : "Impossible d'accéder à ce périphérique.",
      );
    }
  };

  return [state, request];
}

function PermRow({ label, hint, state, onRequest }: { label: string; hint: string; state: PermState; onRequest: () => void }) {
  const dot = state === "granted" ? "●" : state === "denied" ? "✕" : state === "prompt" ? "○" : "?";
  const color =
    state === "granted" ? "text-[hsl(var(--mood))]"
      : state === "denied" ? "text-red-400"
      : "text-foreground/50";
  return (
    <div className="space-y-1">
      <button
        onClick={onRequest}
        disabled={state === "granted"}
        className={`bracket-btn w-full text-left ${state === "granted" ? "bracket-btn-active" : ""}`}
      >
        <span className={`mr-2 ${color}`}>[{dot}]</span>{label}
        <span className="ml-2 text-foreground/40 text-[10px]">
          {state === "granted" ? "AUTORISÉ" : state === "denied" ? "REFUSÉ" : "AUTORISER"}
        </span>
      </button>
      <p className="text-[10px] text-foreground/40">// {hint}</p>
    </div>
  );
}

function PermissionsSection() {
  const [mic, askMic] = usePermission("microphone");
  const [cam, askCam] = usePermission("camera");
  return (
    <section className="space-y-3">
      <h3 className="hud-label">PERMISSIONS</h3>
      <PermRow label="MICROPHONE" hint="pour parler à Lucy à voix haute" state={mic} onRequest={askMic} />
      <PermRow label="CAMÉRA" hint="pour que Lucy voie ce que tu regardes" state={cam} onRequest={askCam} />
    </section>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | undefined;
  setVoiceURI: (v: string | undefined) => void;
  rate: number;
  setRate: (n: number) => void;
  pitch: number;
  setPitch: (n: number) => void;
  intensity: number;
  setIntensity: (n: number) => void;
  pixelRatio: number;
  setPixelRatio: (n: number) => void;
  onTestVoice: () => void;
  onStopVoice: () => void;
  polishEnabled: boolean;
  setPolishEnabled: (v: boolean) => void;
  medicalMode: boolean;
  setMedicalMode: (v: boolean) => void;
  onOpenReport: () => void;
  faceFrequency: "off" | "rare" | "normal" | "often";
  setFaceFrequency: (v: "off" | "rare" | "normal" | "often") => void;
  // Réalité
  locEnabled: boolean;
  setLocEnabled: (v: boolean) => void;
  camEnabled: boolean;
  setCamEnabled: (v: boolean) => void;
  facing: "user" | "environment";
  setFacing: (v: "user" | "environment") => void;
  locationLabel?: string | null;
  nowLabel?: string | null;
  kbdAutoOpen: boolean;
  setKbdAutoOpen: (v: boolean) => void;
  wakeWordEnabled: boolean;
  setWakeWordEnabled: (v: boolean) => void;
  turnTakingEnabled: boolean;
  setTurnTakingEnabled: (v: boolean) => void;
  onOpenProfile: () => void;
}

function AsciiSlider({
  label, min, max, step, value, onChange, format,
}: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (n: number) => void; format?: (n: number) => string;
}) {
  const pct = (value - min) / (max - min);
  const knobs = 12;
  const pos = Math.round(pct * (knobs - 1));
  const bar = Array.from({ length: knobs }, (_, i) => (i === pos ? "●" : "━")).join("");
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-foreground/60">
        <span>{label}</span>
        <span className="text-foreground tabular-nums">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="mood-text font-mono select-none">[{bar}]</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full opacity-0 -mt-5 h-5 cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}

export default function ControlsDrawer(p: Props) {
  const frVoices = [...p.voices].sort((a, b) => {
    const af = a.lang?.toLowerCase().startsWith("fr") ? 0 : 1;
    const bf = b.lang?.toLowerCase().startsWith("fr") ? 0 : 1;
    return af - bf;
  });

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent
        side="right"
        className="!border-0 !bg-transparent !shadow-none w-[min(380px,92vw)] p-0 text-sm scanlines overflow-hidden"
      >
        <div className="dark-matter !border-0 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="dm-text text-base">Réglages</span>
            <span className="text-foreground/15 flex-1 truncate">{"·".repeat(40)}</span>
            <button onClick={() => p.onOpenChange(false)} className="bracket-btn">[X]</button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <section className="space-y-3">
            <h3 className="hud-label">TON PROFIL</h3>
            <button onClick={p.onOpenProfile} className="bracket-btn w-full text-left">
              [👤 PERSONNALISER LUCY]
            </button>
            <p className="text-[10px] text-foreground/40">// prénom, ton, intérêts, contexte, à éviter — conditionne Lucy.</p>
          </section>


            <button
              onClick={() => p.setVoiceEnabled(!p.voiceEnabled)}
              className={`bracket-btn w-full text-left ${p.voiceEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.voiceEnabled ? "X" : " "}] TTS ENABLED
            </button>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-foreground/60">VOICE</div>
              <select
                value={p.voiceURI ?? ""}
                onChange={(e) => p.setVoiceURI(e.target.value || undefined)}
                className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
              >
                <option value="">AUTO (FR)</option>
                {frVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </option>
                ))}
              </select>
            </div>

            <AsciiSlider label="RATE" min={0.5} max={1.5} step={0.05} value={p.rate} onChange={p.setRate} format={(v) => `${v.toFixed(2)}x`} />
            <AsciiSlider label="PITCH" min={0.5} max={1.5} step={0.05} value={p.pitch} onChange={p.setPitch} />

            <div className="flex gap-2">
              <button onClick={p.onTestVoice} className="bracket-btn flex-1">[TEST]</button>
              <button onClick={p.onStopVoice} className="bracket-btn flex-1">[STOP]</button>
            </div>
          </section>

          <PermissionsSection />

          <section className="space-y-3">
            <h3 className="hud-label">RÉALITÉ</h3>
            <p className="text-[10px] text-foreground/40">
              // ancre Lucy dans ton temps, ton lieu, ton environnement
            </p>
            <div className="text-[10px] text-foreground/60 font-mono">
              <div>⏱  {p.nowLabel ?? "—"}</div>
              <div>📍  {p.locEnabled ? (p.locationLabel ?? "localisation…") : "désactivé"}</div>
            </div>
            <button
              onClick={() => p.setLocEnabled(!p.locEnabled)}
              className={`bracket-btn w-full text-left ${p.locEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.locEnabled ? "X" : " "}] LOCALISATION
            </button>
            <button
              onClick={() => p.setCamEnabled(!p.camEnabled)}
              className={`bracket-btn w-full text-left ${p.camEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.camEnabled ? "X" : " "}] REGARD AMBIANT
            </button>
            {p.camEnabled && (
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => p.setFacing("environment")}
                  className={`bracket-btn ${p.facing === "environment" ? "bracket-btn-active" : ""}`}
                >
                  ARRIÈRE
                </button>
                <button
                  onClick={() => p.setFacing("user")}
                  className={`bracket-btn ${p.facing === "user" ? "bracket-btn-active" : ""}`}
                >
                  AVANT
                </button>
              </div>
            )}
            <p className="text-[10px] text-foreground/40">
              // capture furtive d'un frame caméra à chaque message — analyse en direct
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="hud-label">INPUT</h3>
            <button
              onClick={() => p.setPolishEnabled(!p.polishEnabled)}
              className={`bracket-btn w-full text-left ${p.polishEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.polishEnabled ? "X" : " "}] AUTO-CORRECTION ✨
            </button>
            <p className="text-[10px] text-foreground/40">// corrige fautes & ponctuation pendant la saisie</p>
            <button
              onClick={() => p.setKbdAutoOpen(!p.kbdAutoOpen)}
              className={`bracket-btn w-full text-left ${p.kbdAutoOpen ? "bracket-btn-active" : ""}`}
            >
              [{p.kbdAutoOpen ? "X" : " "}] OUVRIR AU CLAVIER
            </button>
            <p className="text-[10px] text-foreground/40">// ouvrir le composer auto quand tu tapes sur un clavier physique</p>
            <button
              onClick={() => p.setWakeWordEnabled(!p.wakeWordEnabled)}
              className={`bracket-btn w-full text-left ${p.wakeWordEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.wakeWordEnabled ? "X" : " "}] MOT D'ÉVEIL « LUCY »
            </button>
            <p className="text-[10px] text-foreground/40">// dis "Lucy" en veille pour la réveiller (micro toujours à l'écoute)</p>
            <button
              onClick={() => p.setTurnTakingEnabled(!p.turnTakingEnabled)}
              className={`bracket-btn w-full text-left ${p.turnTakingEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.turnTakingEnabled ? "X" : " "}] CONVERSATION CONTINUE
            </button>
            <p className="text-[10px] text-foreground/40">// après chaque réponse, Lucy reste à l'écoute ~6s pour ta réplique</p>
          </section>

          <section className="space-y-3">
            <h3 className="hud-label">PRÉ-MÉDECIN</h3>
            <button
              onClick={() => p.setMedicalMode(!p.medicalMode)}
              className={`bracket-btn w-full text-left ${p.medicalMode ? "bracket-btn-active" : ""}`}
            >
              [{p.medicalMode ? "X" : " "}] MODE SANTÉ
            </button>
            <p className="text-[10px] text-foreground/40">
              // collecte symptômes, antécédents, traitements pour préparer une consultation
            </p>
            <button onClick={p.onOpenReport} className="bracket-btn w-full text-left">
              [📋 COMPTE-RENDU]
            </button>
            <p className="text-[10px] text-foreground/40 italic">
              Lucy n'est pas médecin. Elle aide à préparer, pas à diagnostiquer.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="hud-label">VISAGE DE LUCY</h3>
            <div className="grid grid-cols-4 gap-1">
              {(["off", "rare", "normal", "often"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => p.setFaceFrequency(f)}
                  className={`bracket-btn ${p.faceFrequency === f ? "bracket-btn-active" : ""}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-foreground/40">// apparitions ASCII du visage de Lucy dans l'orbe</p>
          </section>

          <section className="space-y-4">
            <h3 className="hud-label">RENDER</h3>
            <AsciiSlider label="QUALITY" min={0.75} max={2} step={0.25} value={p.pixelRatio} onChange={p.setPixelRatio} format={(v) => `${v.toFixed(2)}x`} />
            <AsciiSlider label="INTENSITY" min={0.5} max={1.5} step={0.05} value={p.intensity} onChange={p.setIntensity} />
            <p className="text-[10px] text-foreground/40">// quality: reload to apply</p>
          </section>
        </div>
      </div>
    </SheetContent>
  </Sheet>
  );
}
