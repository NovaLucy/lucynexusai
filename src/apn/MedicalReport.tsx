import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import { Trash2 } from "lucide-react";

const MEDICAL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/apn-medical`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
}

type Trends = {
  total: number;
  topSymptoms: { name: string; count: number }[];
  intensityTimeline: { date: string; intensity: number }[];
  medications: string[];
  allergies: string[];
  redFlagsRecent: { date: string; flags: string[] }[];
  recent: { id: string; date: string; symptoms: string[]; intensity: number | null; duration: string | null; text: string | null }[];
};

type Tab = "trends" | "history" | "report";

export default function MedicalReport({ open, onOpenChange, sessionId }: Props) {
  const [tab, setTab] = useState<Tab>("trends");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState(0);

  const callMedical = async (body: any) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("auth required");
    const r = await fetch(MEDICAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return r.json();
  };

  const loadTrends = async () => {
    setLoading(true);
    try { setTrends(await callMedical({ action: "trends" })); }
    catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  };

  const loadReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const j = await callMedical({ action: "report", sessionId });
      setReport(j?.report ?? "_Aucune donnée_");
      setReportCount(j?.count ?? 0);
    } catch { setReport("_Erreur de génération_"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    if (tab === "trends" || tab === "history") loadTrends();
    if (tab === "report") loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const deleteEntry = async (id: string) => {
    if (!confirm("Supprimer cette entrée ?")) return;
    try {
      await callMedical({ action: "delete", id });
      toast.success("Entrée supprimée");
      loadTrends();
    } catch { toast.error("Erreur"); }
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Compte-rendu de pré-consultation", margin, y);
    y += 22;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Document préparatoire — généré le ${new Date().toLocaleDateString("fr-FR")} — n'est pas un diagnostic.`, margin, y);
    y += 18;
    doc.setTextColor(0);

    const lines = report.split("\n");
    for (const raw of lines) {
      let line = raw.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/, "");
      const isHeading = /^#+\s/.test(raw) || /^[A-ZÀ-Ý][^.]{2,40}:?$/.test(raw.trim());
      if (raw.startsWith("# ")) continue; // already in title
      doc.setFont("helvetica", isHeading ? "bold" : "normal");
      doc.setFontSize(isHeading ? 12 : 10.5);
      const wrapped = doc.splitTextToSize(line || " ", maxW);
      for (const w of wrapped) {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(w, margin, y);
        y += isHeading ? 16 : 14;
      }
    }
    doc.save(`pre-consultation-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!border-0 !bg-transparent !shadow-none w-[min(580px,96vw)] p-0 font-mono text-sm overflow-hidden"
      >
        <div className="dark-matter !border-0 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest">
            <span className="mood-text">── PRÉ-MÉDECIN</span>
            <span className="text-foreground/30 flex-1">{"─".repeat(40)}</span>
            <button onClick={() => onOpenChange(false)} className="bracket-btn">[X]</button>
          </div>

          <div className="flex gap-1 px-3 pb-2 text-[10px]">
            {(["trends", "history", "report"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="bracket-btn flex-1"
                data-active={tab === t ? "true" : "false"}
                style={tab === t ? { borderColor: "hsl(var(--foreground) / 0.4)" } : {}}
              >
                {t === "trends" ? "[TENDANCES]" : t === "history" ? "[HISTORIQUE]" : "[COMPTE-RENDU]"}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <p className="text-[10px] text-foreground/50 leading-relaxed">
              Lucy n'est pas médecin. Ces données t'aident à préparer une consultation.
            </p>

            {loading && <p className="text-foreground/60">Chargement…</p>}

            {tab === "trends" && !loading && trends && (
              <>
                {trends.total === 0 ? (
                  <p className="text-foreground/60">Aucune donnée santé pour l'instant. Active le mode pré-médecin et parle de tes symptômes.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-foreground/50">Volume</div>
                      <div className="text-2xl">{trends.total} <span className="text-xs text-foreground/50">entrée{trends.total > 1 ? "s" : ""} santé</span></div>
                    </div>

                    {trends.intensityTimeline.length > 1 && (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-foreground/50">Intensité dans le temps</div>
                        <div className="h-32 -mx-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trends.intensityTimeline.map((p) => ({ ...p, label: new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) }))}>
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--foreground) / 0.5)" }} />
                              <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: "hsl(var(--foreground) / 0.5)" }} width={20} />
                              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--foreground) / 0.2)", fontSize: 11 }} />
                              <Line type="monotone" dataKey="intensity" stroke="hsl(var(--foreground) / 0.85)" strokeWidth={1.5} dot={{ r: 2 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {trends.topSymptoms.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-foreground/50">Symptômes récurrents</div>
                        <div className="h-40 -mx-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends.topSymptoms} layout="vertical" margin={{ left: 10 }}>
                              <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--foreground) / 0.5)" }} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--foreground) / 0.7)" }} width={100} />
                              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--foreground) / 0.2)", fontSize: 11 }} />
                              <Bar dataKey="count" fill="hsl(var(--foreground) / 0.55)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {trends.medications.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-foreground/50 mb-1">Traitements évoqués</div>
                        <div className="text-xs text-foreground/80">{trends.medications.join(" · ")}</div>
                      </div>
                    )}
                    {trends.allergies.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-foreground/50 mb-1">Allergies</div>
                        <div className="text-xs text-foreground/80">{trends.allergies.join(" · ")}</div>
                      </div>
                    )}
                    {trends.redFlagsRecent.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-red-300/80 mb-1">⚠ Drapeaux rouges récents</div>
                        <div className="text-xs text-red-200/80 space-y-1">
                          {trends.redFlagsRecent.map((rf, i) => (
                            <div key={i}>· {new Date(rf.date).toLocaleDateString("fr-FR")} : {rf.flags.join(", ")}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {tab === "history" && !loading && trends && (
              <div className="space-y-2">
                {trends.recent.length === 0 ? (
                  <p className="text-foreground/60">Aucune entrée enregistrée.</p>
                ) : (
                  trends.recent.map((e) => (
                    <div key={e.id} className="border ascii-border p-3 bg-black/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-foreground/50">
                          {new Date(e.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          {e.intensity != null && <span className="ml-2 text-foreground/70">· {e.intensity}/10</span>}
                          {e.duration && <span className="ml-2 text-foreground/50">· {e.duration}</span>}
                        </div>
                        <button onClick={() => deleteEntry(e.id)} className="opacity-50 hover:opacity-100 transition" aria-label="Supprimer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {e.symptoms.length > 0 && (
                        <div className="text-foreground/85">{e.symptoms.join(" · ")}</div>
                      )}
                      {e.text && (
                        <div className="text-foreground/55 italic text-[11px]">« {e.text.slice(0, 180)}{e.text.length > 180 ? "…" : ""} »</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "report" && !loading && report && (
              <>
                <div className="flex gap-2">
                  <button onClick={async () => { await navigator.clipboard.writeText(report); toast.success("Copié"); }} className="bracket-btn flex-1">[COPIER]</button>
                  <button onClick={exportPDF} className="bracket-btn flex-1">[PDF]</button>
                </div>
                {reportCount > 0 && (
                  <p className="text-[10px] text-foreground/40">Basé sur {reportCount} entrée{reportCount > 1 ? "s" : ""} santé.</p>
                )}
                <pre className="whitespace-pre-wrap text-xs text-foreground/90 font-mono leading-relaxed border ascii-border p-3 bg-black/40">{report}</pre>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
