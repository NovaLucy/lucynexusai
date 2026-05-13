import { useEffect, useRef, useState, type FormEvent } from "react";
import { cameraAvailable, pickPhoto } from "./camera";
import { usePolish } from "./usePolish";
import { Mic, MicOff, Camera, ArrowRight } from "lucide-react";
import type { Mood, AgentState } from "./types";

interface Props {
  onSend: (text: string) => void;
  onMic?: () => void;
  onPhoto?: (dataUrl: string) => void;
  micActive?: boolean;
  sttSupported?: boolean;
  disabled?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  polishEnabled?: boolean;
  mood?: Mood;
  state?: AgentState;
}

export default function Composer({
  onSend, onMic, onPhoto, micActive, sttSupported, disabled,
  value: extValue, onValueChange, polishEnabled = true,
}: Props) {
  const [internal, setInternal] = useState("");
  const value = extValue !== undefined ? extValue : internal;
  const setValue = (v: string) => {
    if (onValueChange) onValueChange(v);
    else setInternal(v);
  };
  const [polishing, setPolishing] = useState(false);
  const lastSentRef = useRef<string>("");

  const polish = usePolish(polishEnabled, (corrected, original) => {
    setPolishing(false);
    if (value.trim() === original.trim()) setValue(corrected);
  });

  useEffect(() => {
    if (!polishEnabled) return;
    if (!value.trim()) return;
    if (value === lastSentRef.current) return;
    setPolishing(true);
    polish(value);
    const t = window.setTimeout(() => setPolishing(false), 1500);
    return () => window.clearTimeout(t);
  }, [value, polishEnabled, polish]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    lastSentRef.current = value;
    onSend(value);
    setValue("");
  };

  const handlePhoto = async () => {
    const dataUrl = await pickPhoto();
    if (dataUrl) onPhoto?.(dataUrl);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const hasText = value.trim().length > 0;

  return (
    <div className="w-full flex justify-center px-4 sm:px-6 pb-4 sm:pb-6">
      <div className="relative w-full max-w-2xl group">
        {/* Soft mood aura, intensifies on focus / hasText */}
        <div
          className="pointer-events-none absolute -inset-1 rounded-full blur-xl opacity-25 group-focus-within:opacity-90 transition-opacity duration-700"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(var(--mood) / 0.35) 50%, transparent 100%)",
            opacity: hasText ? 0.7 : undefined,
          }}
          aria-hidden
        />

        <form
          onSubmit={submit}
          className="relative flex items-center gap-2 rounded-full border border-foreground/10 bg-background/40 backdrop-blur-2xl px-3 sm:px-4 py-2.5 transition-all duration-300 focus-within:border-[hsl(var(--mood)/0.4)] focus-within:bg-background/60"
        >
          {cameraAvailable && (
            <button
              type="button"
              onClick={handlePhoto}
              className="shrink-0 p-2 rounded-full text-foreground/40 hover:text-foreground/80 transition-colors"
              aria-label="Envoyer une photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Commencer à parler…"
            aria-label="Message à APN"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="send"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent outline-none text-foreground/90 placeholder:text-foreground/30 text-sm font-light tracking-wide py-1.5 px-2"
            disabled={disabled}
          />

          {polishEnabled && polishing && hasText && (
            <span
              className="text-[9px] uppercase tracking-[0.25em] mood-text shrink-0 hidden sm:inline animate-pulse"
              aria-hidden
            >
              ✨
            </span>
          )}

          {sttSupported && (
            <button
              type="button"
              onClick={onMic}
              aria-label={micActive ? "Arrêter l'écoute" : "Parler"}
              className={`shrink-0 p-2 rounded-full transition-colors ${
                micActive
                  ? "text-red-300 bg-red-500/10 animate-pulse"
                  : "text-foreground/40 hover:text-foreground/80"
              }`}
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <button
            type="submit"
            disabled={!hasText || disabled}
            aria-label="Envoyer"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: hasText ? "hsl(var(--mood) / 0.18)" : "hsl(var(--foreground) / 0.04)",
              border: `1px solid hsl(var(--mood) / ${hasText ? 0.45 : 0.15})`,
              color: hasText ? "hsl(var(--mood))" : "hsl(var(--foreground) / 0.4)",
              boxShadow: hasText ? "0 0 20px hsl(var(--mood) / 0.35)" : undefined,
            }}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
