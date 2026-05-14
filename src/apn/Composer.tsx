import { useEffect, useRef, useState, type FormEvent } from "react";
import { cameraAvailable, pickPhoto } from "./camera";
import { usePolish } from "./usePolish";
import { Mic, MicOff, Camera, ArrowRight, X } from "lucide-react";
import type { Mood, AgentState } from "./types";

interface Props {
  onSend: (text: string, imageDataUrl?: string) => void;
  onMic?: () => void;
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
  onSend, onMic, micActive, sttSupported, disabled,
  value: extValue, onValueChange, polishEnabled = true,
}: Props) {
  const [internal, setInternal] = useState("");
  const value = extValue !== undefined ? extValue : internal;
  const setValue = (v: string) => {
    if (onValueChange) onValueChange(v);
    else setInternal(v);
  };
  const [polishing, setPolishing] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
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
    if (disabled) return;
    const text = value.trim();
    if (!text && !attachedImage) return;
    lastSentRef.current = value;
    onSend(text || "Regarde.", attachedImage ?? undefined);
    setValue("");
    setAttachedImage(null);
  };

  const handlePhoto = async () => {
    const dataUrl = await pickPhoto();
    if (dataUrl) setAttachedImage(dataUrl);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const hasText = value.trim().length > 0;
  const canSubmit = (hasText || !!attachedImage) && !disabled;

  return (
    <div className="w-full flex justify-center px-4 sm:px-6 pb-4 sm:pb-6">
      <div className="relative w-full max-w-2xl group">
        {/* Soft mood aura */}
        <div
          className="pointer-events-none absolute -inset-1 rounded-3xl blur-xl opacity-25 group-focus-within:opacity-90 transition-opacity duration-700"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(var(--mood) / 0.35) 50%, transparent 100%)",
            opacity: hasText || attachedImage ? 0.7 : undefined,
          }}
          aria-hidden
        />

        {/* Image preview */}
        {attachedImage && (
          <div className="dark-matter !border-0 relative mb-2 inline-flex items-start gap-2 rounded-2xl p-2">
            <img
              src={attachedImage}
              alt="Aperçu"
              className="w-20 h-20 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="p-1 rounded-full text-foreground/50 hover:text-foreground/90 hover:bg-foreground/10 transition-colors"
              aria-label="Retirer la photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="self-end text-[10px] uppercase tracking-widest text-foreground/40 pr-1">
              vue partagée
            </span>
          </div>
        )}

        <form
          onSubmit={submit}
          className="dark-matter !border-0 relative flex items-center gap-2 rounded-full px-3 sm:px-4 py-2.5 transition-all duration-300"
        >
          {cameraAvailable && (
            <button
              type="button"
              onClick={handlePhoto}
              className="ghost-btn shrink-0 p-2 rounded-full"
              data-active={attachedImage ? "true" : "false"}
              aria-label="Partager une photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={attachedImage ? "Dis-moi quoi regarder…" : "Commencer à parler…"}
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
              className="ghost-btn shrink-0 p-2 rounded-full"
              data-mic={micActive ? "true" : "false"}
            >
              {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Envoyer"
            className="ghost-btn shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            data-active={canSubmit ? "true" : "false"}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
