import { useEffect, useRef } from "react";
import type { Message } from "@/apn/types";
import { MOOD_HSL } from "@/apn/types";

interface Props {
  messages: Message[];
  open: boolean;
  onClose: () => void;
}

const fmt = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function ChatLog({ messages, open, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black apn-fade-in flex flex-col">
      <div className="dark-matter !border-0 rounded-full mx-4 mt-3 mb-2 flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-widest text-drop">
        <span className="mood-text">── JOURNAL</span>
        <span className="text-foreground/30">{"─".repeat(40)}</span>
        <span className="text-foreground/60 tabular-nums">
          {String(messages.length).padStart(3, "0")} MSG
        </span>
        <span className="text-foreground/30 flex-1" />
        <button onClick={onClose} className="bracket-btn">[X CLOSE]</button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin font-mono text-sm">
        {messages.length === 0 && (
          <p className="text-foreground/40 italic text-xs">// no exchanges yet</p>
        )}
        {messages.map((m) => {
          const c = m.mood ? MOOD_HSL[m.mood] : null;
          const tag = m.role === "user" ? "[USR" : "[APN";
          const sep = m.role === "user" ? ">" : "$";
          return (
            <div
              key={m.id}
              className="dark-matter !border-0 relative rounded-xl p-3 mb-3"
            >
              <div className="text-[10px] uppercase tracking-widest text-foreground/40 mb-0.5">
                {tag} {fmt(m.ts)}] {sep}
              </div>
              {m.imageDataUrl && (
                <img
                  src={m.imageDataUrl}
                  alt="Vue partagée"
                  className="my-1 max-w-[220px] max-h-[160px] object-cover rounded-md"
                />
              )}
              <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
