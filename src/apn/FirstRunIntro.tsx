import { useEffect, useState } from "react";
import { Mic, Keyboard, Sparkles, X } from "lucide-react";

const KEY = "lucy:onboarded:v1";

/**
 * One-time intro: 3 short cards explaining the 3 ways to talk to Lucy.
 * Dismissible, persisted in localStorage.
 */
export default function FirstRunIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, []);

  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/70 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 sm:p-8"
        style={{
          background: "hsl(var(--background) / 0.85)",
          border: "1px solid hsl(var(--foreground) / 0.08)",
          boxShadow: "0 30px 80px -20px hsl(var(--foreground) / 0.4)",
        }}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 p-1.5 rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-foreground/10"
          aria-label="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <h2 className="dm-text text-lg sm:text-xl mb-1">
          Bonjour. Je suis Lucy.
        </h2>
        <p className="hud-label mb-6">
          Trois façons de me parler.
        </p>

        <ul className="space-y-3 chat-text text-sm">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 p-1.5 rounded-full bg-foreground/[0.06]">
              <Mic className="w-3.5 h-3.5 opacity-70" />
            </span>
            <span><b className="font-normal">Touche</b> l'orbe pour me parler.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 p-1.5 rounded-full bg-foreground/[0.06]">
              <Keyboard className="w-3.5 h-3.5 opacity-70" />
            </span>
            <span><b className="font-normal">Double-touche</b> ou bouton clavier pour écrire.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 p-1.5 rounded-full bg-foreground/[0.06]">
              <Sparkles className="w-3.5 h-3.5 opacity-70" />
            </span>
            <span>Dis simplement <b className="font-normal">« Lucy »</b> pour me réveiller (à activer dans les réglages).</span>
          </li>
        </ul>

        <button
          onClick={close}
          className="ghost-btn hud-label mt-6 w-full py-2.5 rounded-full"
        >
          C'est parti
        </button>
      </div>
    </div>
  );
}
