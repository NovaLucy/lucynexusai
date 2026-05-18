import { useEffect, useRef } from "react";
import type { Message } from "@/apn/types";
import { MOOD_HSL } from "@/apn/types";

interface Props {
  messages: Message[];
  open: boolean;
  onClose: () => void;
  onClear?: () => void | Promise<void>;
  sessionId?: string;
  userName?: string | null;
}

const firstName = (n?: string | null) => {
  if (!n) return "Toi";
  const first = n.trim().split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
};

const fmt = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function ChatLog({ messages, open, onClose, onClear, sessionId, userName }: Props) {
  const userTag = firstName(userName);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!open) return null;

  const handleClear = async () => {
    if (!onClear) return;
    const ok = window.confirm(
      "Effacer toute la session ? Les échanges seront supprimés du serveur. Lucy te reconnaîtra à la prochaine connexion, mais sans souvenirs.",
    );
    if (!ok) return;
    await onClear();
  };

  const idShort = sessionId ? `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}` : "—";

  return (
    <div className="fixed inset-0 z-40 bg-black apn-fade-in flex flex-col">
      <div className="dark-matter !border-0 rounded-full mx-3 sm:mx-4 mt-3 mb-2 flex items-center gap-2 px-3 sm:px-4 py-2.5 text-drop overflow-hidden">
        <span className="dm-text shrink-0 text-sm">Journal</span>
        <span className="text-foreground/15 hidden sm:inline truncate flex-1">{"·".repeat(40)}</span>
        <span className="text-foreground/15 sm:hidden flex-1" />
        <span className="hud-label tabular-nums shrink-0 hidden sm:inline" title="Identifiant Lucy — identique sur toutes tes interfaces">
          LUCY·{idShort}
        </span>
        <span className="hud-label tabular-nums shrink-0">
          {String(messages.length).padStart(3, "0")} MSG
        </span>
        {onClear && (
          <button onClick={handleClear} className="bracket-btn shrink-0" title="Effacer la session">
            [EFFACER]
          </button>
        )}
        <button onClick={onClose} className="bracket-btn shrink-0">[X]</button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <p className="hud-label">// no exchanges yet</p>
        )}
        {messages.map((m) => {
          const c = m.mood ? MOOD_HSL[m.mood] : null;
          const isUser = m.role === "user";
          const tag = isUser ? userTag : "Lucy";
          const moodColor = c ? `hsl(${c.h} ${c.s}% ${c.l}%)` : "hsl(var(--mood))";
          return (
            <div
              key={m.id}
              className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative rounded-xl p-3 max-w-[78%] ${
                  isUser
                    ? "bg-foreground/[0.06] border-r-2"
                    : "dark-matter !border-0 border-l-2"
                }`}
                style={
                  isUser
                    ? { borderRightColor: "hsl(var(--foreground) / 0.35)" }
                    : { borderLeftColor: moodColor, boxShadow: `inset 2px 0 0 0 ${moodColor}` }
                }
              >
                <div className="hud-label mb-1.5 flex items-center gap-2">
                  {!isUser && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: moodColor }}
                    />
                  )}
                  <span style={!isUser ? { color: moodColor } : undefined}>
                    {isUser ? `[${tag.toUpperCase()}]` : "[LUCY]"}
                  </span>
                  <span className="opacity-40">·</span>
                  <span className="opacity-70">{fmt(m.ts)}</span>
                </div>
                {m.imageDataUrl && (
                  <img
                    src={m.imageDataUrl}
                    alt="Vue partagée"
                    className="my-1 max-w-[220px] max-h-[160px] object-cover rounded-md"
                  />
                )}
                <div className="chat-text whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
