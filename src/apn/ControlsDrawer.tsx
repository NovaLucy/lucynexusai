import { Sheet, SheetContent } from "@/components/ui/sheet";

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
        className="!border-0 !bg-transparent !shadow-none w-[min(380px,92vw)] p-0 font-mono text-sm scanlines overflow-hidden"
      >
        <div className="dark-matter !border-0 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest">
            <span className="mood-text">── CONFIG</span>
            <span className="text-foreground/30 flex-1">{"─".repeat(40)}</span>
            <button onClick={() => p.onOpenChange(false)} className="bracket-btn">[X]</button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-foreground/40">── VOICE ──</h3>
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

          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest text-foreground/40">── INPUT ──</h3>
            <button
              onClick={() => p.setPolishEnabled(!p.polishEnabled)}
              className={`bracket-btn w-full text-left ${p.polishEnabled ? "bracket-btn-active" : ""}`}
            >
              [{p.polishEnabled ? "X" : " "}] AUTO-CORRECTION ✨
            </button>
            <p className="text-[10px] text-foreground/40">// corrige fautes & ponctuation pendant la saisie</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest text-foreground/40">── PRÉ-MÉDECIN ──</h3>
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
              APN n'est pas un médecin. Aide à la préparation, pas un diagnostic.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest text-foreground/40">── VISAGE APN ──</h3>
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
            <p className="text-[10px] text-foreground/40">// apparitions ASCII du visage d'APN dans l'orbe</p>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-foreground/40">── RENDER ──</h3>
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
