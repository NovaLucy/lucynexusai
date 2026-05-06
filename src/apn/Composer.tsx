import { useState, type FormEvent } from "react";
import { ArrowUp, Mic, MicOff } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onMic?: () => void;
  micActive?: boolean;
  sttSupported?: boolean;
  disabled?: boolean;
}

export default function Composer({ onSend, onMic, micActive, sttSupported, disabled }: Props) {
  const [value, setValue] = useState("");

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
      style={{ width: "min(620px, 92vw)" }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Parle-moi…"
        aria-label="Message à APN"
        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-[15px] font-mono"
        disabled={disabled}
      />
      {sttSupported && (
        <button
          type="button"
          onClick={onMic}
          aria-label={micActive ? "Arrêter l'écoute" : "Parler à APN"}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
            micActive ? "bg-emerald-500/30 text-emerald-200" : "hover:bg-white/5 text-foreground/70"
          }`}
        >
          {micActive ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      )}
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="Envoyer"
        className="h-10 w-10 rounded-full mood-bg text-background flex items-center justify-center disabled:opacity-30 transition-opacity"
        style={{ color: "hsl(var(--background))" }}
      >
        <ArrowUp size={18} />
      </button>
    </form>
  );
}
