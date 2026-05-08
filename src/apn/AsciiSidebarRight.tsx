interface Props {
  msgCount: number;
  topic?: string | null;
  loops: number;
  name?: string | null;
}

const memBlocks = (pct: number) => {
  const filled = Math.round((pct / 100) * 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
};

export default function AsciiSidebarRight({ msgCount, topic, loops, name }: Props) {
  const memPct = Math.min(100, Math.round((msgCount / 200) * 100));
  return (
    <aside
      className="hidden md:flex flex-col gap-2 py-3 px-2 text-[10px] leading-[14px] border-l ascii-border bg-black/60"
      style={{ width: 128 }}
      aria-hidden
    >
      <div className="text-foreground/40 uppercase tracking-widest">── MEMORY ──</div>
      <div className="text-foreground/60">
        MSG <span className="text-foreground tabular-nums">{String(msgCount).padStart(3, "0")}</span>
      </div>
      <div className="text-foreground/60">
        MEM <span className="mood-text">{memBlocks(memPct)}</span>
      </div>
      <div className="text-foreground/60 tabular-nums">{memPct}%</div>

      <div className="mt-3 text-foreground/40 uppercase tracking-widest">── STATE ──</div>
      <div className="text-foreground/60">
        LOOP <span className="text-foreground tabular-nums">{String(loops).padStart(2, "0")}</span>
      </div>
      {topic && (
        <div className="text-foreground/60 break-words">
          TOPIC<br />
          <span className="mood-text">› {topic.slice(0, 14)}</span>
        </div>
      )}
      {name && (
        <>
          <div className="mt-3 text-foreground/40 uppercase tracking-widest">── USER ──</div>
          <div className="text-foreground/60 break-words">
            <span className="text-foreground">{name.slice(0, 14)}</span>
          </div>
        </>
      )}
      <div className="mt-3 text-foreground/40 uppercase tracking-widest">── NET ──</div>
      <div className="text-foreground/60">PING <span className="text-foreground">012ms</span></div>
      <div className="text-foreground/60">ENC <span className="mood-text">●OK</span></div>
    </aside>
  );
}
