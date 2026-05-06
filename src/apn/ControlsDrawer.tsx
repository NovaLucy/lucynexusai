import { Settings, X } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
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
}

export default function ControlsDrawer(p: Props) {
  const [open, setOpen] = useState(false);
  const frVoices = [...p.voices].sort((a, b) => {
    const af = a.lang?.toLowerCase().startsWith("fr") ? 0 : 1;
    const bf = b.lang?.toLowerCase().startsWith("fr") ? 0 : 1;
    return af - bf;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Réglages"
          className="glass h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
        >
          <Settings size={18} />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-background/90 backdrop-blur-xl border-l border-white/5 w-[min(380px,92vw)]">
        <SheetHeader>
          <SheetTitle className="font-display tracking-wide">Réglages APN</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Voix</h3>
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-toggle">Activer la synthèse vocale</Label>
              <Switch id="tts-toggle" checked={p.voiceEnabled} onCheckedChange={p.setVoiceEnabled} />
            </div>
            <div className="space-y-2">
              <Label>Voix</Label>
              <select
                value={p.voiceURI ?? ""}
                onChange={(e) => p.setVoiceURI(e.target.value || undefined)}
                className="w-full bg-secondary text-foreground rounded-md px-3 py-2 text-sm border border-white/5"
              >
                <option value="">Auto (FR si disponible)</option>
                {frVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} — {v.lang}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Vitesse — {p.rate.toFixed(2)}x</Label>
              <Slider min={0.5} max={1.5} step={0.05} value={[p.rate]} onValueChange={([v]) => p.setRate(v)} />
            </div>
            <div className="space-y-2">
              <Label>Pitch — {p.pitch.toFixed(2)}</Label>
              <Slider min={0.5} max={1.5} step={0.05} value={[p.pitch]} onValueChange={([v]) => p.setPitch(v)} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={p.onTestVoice}>Test</Button>
              <Button variant="ghost" onClick={p.onStopVoice}>Stop</Button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Rendu</h3>
            <div className="space-y-2">
              <Label>Qualité — {p.pixelRatio.toFixed(2)}x</Label>
              <Slider min={0.75} max={2} step={0.25} value={[p.pixelRatio]} onValueChange={([v]) => p.setPixelRatio(v)} />
              <p className="text-xs text-muted-foreground">Recharge la page après changement.</p>
            </div>
            <div className="space-y-2">
              <Label>Intensité plasma — {p.intensity.toFixed(2)}</Label>
              <Slider min={0.5} max={1.5} step={0.05} value={[p.intensity]} onValueChange={([v]) => p.setIntensity(v)} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
