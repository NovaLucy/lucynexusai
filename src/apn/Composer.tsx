import { useEffect, useRef, useState, type FormEvent } from "react";
import { cameraAvailable, pickPhoto } from "./camera";
import { usePolish } from "./usePolish";

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
    // Only replace if the field still holds the version we polished
    if (value.trim() === original.trim()) {
      setValue(corrected);
    }
  });

  // Trigger polish whenever value changes (debounced inside the hook)
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

  return (
    <form
      onSubmit={submit}
      className="w-full flex items-center gap-2 px-3 py-2 border-t ascii-border bg-black"
    >
      <span className="mood-text shrink-0 select-none font-medium">{">"}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="parle-moi_"
        aria-label="Message à APN"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
        spellCheck={false}
        className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-foreground/30 font-mono caret-transparent"
        style={{ caretColor: "hsl(var(--mood))" }}
        disabled={disabled}
      />
      {polishEnabled && polishing && value.trim().length > 3 && (
        <span className="text-[10px] uppercase tracking-widest text-foreground/40 shrink-0 hidden sm:inline">
          ✨ corr…
        </span>
      )}
      {cameraAvailable && (
        <button type="button" onClick={handlePhoto} className="bracket-btn" aria-label="Envoyer une photo">
          [CAM]
        </button>
      )}
      {sttSupported && (
        <button
          type="button"
          onClick={onMic}
          aria-label={micActive ? "Arrêter l'écoute" : "Parler"}
          className={`bracket-btn ${micActive ? "bracket-btn-rec" : ""}`}
        >
          {micActive ? "[●REC]" : "[MIC]"}
        </button>
      )}
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Envoyer"
        className="bracket-btn bracket-btn-active disabled:bracket-btn"
      >
        [SEND ↵]
      </button>
    </form>
  );
}
