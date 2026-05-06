import { useState, type FormEvent } from "react";
import { ArrowUp, Mic, MicOff, Camera as CameraIcon } from "lucide-react";
import { cameraAvailable, pickPhoto } from "./camera";

interface Props {
  onSend: (text: string) => void;
  onMic?: () => void;
  onPhoto?: (dataUrl: string) => void;
  micActive?: boolean;
  sttSupported?: boolean;
  disabled?: boolean;
}

export default function Composer({ onSend, onMic, onPhoto, micActive, sttSupported, disabled }: Props) {
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  const handlePhoto = async () => {
    const dataUrl = await pickPhoto();
    if (dataUrl) onPhoto?.(dataUrl);
  };


  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  return (
    <form
      onSubmit={submit}
      className="glass mood-ring rounded-full flex items-center gap-1 pl-5 pr-1.5 py-1.5 transition-shadow"
      style={{ width: "min(620px, 96vw)" }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Parle-moi…"
        aria-label="Message à APN"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
        className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground font-mono"
        disabled={disabled}
      />
      {cameraAvailable && (
        <button
          type="button"
          onClick={handlePhoto}
          aria-label="Envoyer une photo à APN"
          className="shrink-0 h-11 w-11 rounded-full hover:bg-white/5 text-foreground/70 flex items-center justify-center transition-colors"
        >
          <CameraIcon size={20} />
        </button>
      )}
      {sttSupported && (
        <button
          type="button"
          onClick={onMic}
          aria-label={micActive ? "Arrêter l'écoute" : "Parler à APN"}
          className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
            micActive ? "bg-emerald-500/30 text-emerald-200" : "hover:bg-white/5 text-foreground/70"
          }`}
        >
          {micActive ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
      )}
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Envoyer"
        className="shrink-0 h-11 w-11 rounded-full mood-bg flex items-center justify-center disabled:opacity-30 transition-opacity"
        style={{ color: "hsl(var(--background))" }}
      >
        <ArrowUp size={20} />
      </button>
    </form>
  );
}
