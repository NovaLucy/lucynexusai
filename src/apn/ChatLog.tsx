import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import type { Message } from "@/apn/types";
import { MOOD_HSL } from "@/apn/types";

interface Props { messages: Message[]; }

export default function ChatLog({ messages }: Props) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fermer le journal" : "Ouvrir le journal"}
        className="glass h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
      >
        {open ? <X size={18} /> : <MessageSquare size={18} />}
      </button>
      {open && (
        <div
          className="glass apn-fade-in fixed bottom-24 right-4 w-[min(420px,92vw)] max-h-[60vh] rounded-3xl overflow-hidden flex flex-col z-30"
        >
          <div className="px-4 py-3 border-b border-white/5 text-xs uppercase tracking-widest text-muted-foreground font-display">
            Journal
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucun échange pour l'instant.</p>
            )}
            {messages.map((m) => {
              const c = m.mood ? MOOD_HSL[m.mood] : null;
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "ml-auto bg-white/5" : "mr-auto bg-black/30 font-mono"
                  }`}
                  style={
                    m.role === "user" && c
                      ? { borderRight: `2px solid hsl(${c.h} ${c.s}% ${c.l}% / 0.6)` }
                      : undefined
                  }
                >
                  {m.content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
