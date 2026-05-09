import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MEDICAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apn-medical`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
}

export default function MedicalReport({ open, onOpenChange, sessionId }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setReport(null);
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const r = await fetch(MEDICAL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "report", sessionId }),
        });
        const j = await r.json();
        setReport(j?.report ?? "_Aucune donnée_");
        setCount(j?.count ?? 0);
      } catch {
        setReport("_Erreur de génération_");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, sessionId]);


  const copy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    toast.success("Compte-rendu copié");
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apn-pre-consultation-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-black border-l ascii-border w-[min(520px,96vw)] p-0 font-mono text-sm scanlines"
      >
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest border-b ascii-border">
          <span className="mood-text">── PRÉ-CONSULTATION</span>
          <span className="text-foreground/30 flex-1">{"─".repeat(40)}</span>
          <button onClick={() => onOpenChange(false)} className="bracket-btn">[X]</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100dvh - 44px)" }}>
          <p className="text-[10px] text-foreground/50 leading-relaxed">
            APN n'est pas un médecin. Ce document est une aide à la préparation
            d'une consultation, jamais un diagnostic.
          </p>

          {loading && <p className="text-foreground/60">Génération du compte-rendu…</p>}

          {!loading && report && (
            <>
              <div className="flex gap-2">
                <button onClick={copy} className="bracket-btn flex-1">[COPIER]</button>
                <button onClick={download} className="bracket-btn flex-1">[.MD]</button>
              </div>
              {count > 0 && (
                <p className="text-[10px] text-foreground/40">
                  Basé sur {count} entrée{count > 1 ? "s" : ""} santé.
                </p>
              )}
              <pre className="whitespace-pre-wrap text-xs text-foreground/90 font-mono leading-relaxed border ascii-border p-3 bg-black/40">
                {report}
              </pre>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
