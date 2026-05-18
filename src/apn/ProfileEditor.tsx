import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Traits = {
  pronouns?: string;
  age?: number | string;
  tone?: string;
  language?: string;
  interests?: string[];
  values?: string[];
  context?: string;
  notes?: string;
  avoid?: string;
  [k: string]: any;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  sessionId: string;
  initialDisplayName?: string | null;
  initialTraits?: Traits;
  onSaved: () => void | Promise<void>;
}

const TONES = ["direct", "chaleureux", "concis", "réflexif", "joueur", "posé"];

function TagInput({
  label, value, onChange, placeholder,
}: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(""); return; }
    onChange([...value, v].slice(0, 12));
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-foreground/60">{label}</div>
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <button
            key={t}
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="bracket-btn text-xs"
            title="Retirer"
          >
            {t} <span className="opacity-50 ml-1">×</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "ajouter…"}
          className="flex-1 bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
        />
        <button onClick={add} className="bracket-btn">[+]</button>
      </div>
    </div>
  );
}

export default function ProfileEditor({
  open, onOpenChange, userId, sessionId, initialDisplayName, initialTraits, onSaved,
}: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [pronouns, setPronouns] = useState(initialTraits?.pronouns ?? "");
  const [age, setAge] = useState<string>(initialTraits?.age != null ? String(initialTraits.age) : "");
  const [tone, setTone] = useState(initialTraits?.tone ?? "");
  const [language, setLanguage] = useState(initialTraits?.language ?? "fr");
  const [interests, setInterests] = useState<string[]>(initialTraits?.interests ?? []);
  const [values, setValues] = useState<string[]>(initialTraits?.values ?? []);
  const [context, setContext] = useState(initialTraits?.context ?? "");
  const [notes, setNotes] = useState(initialTraits?.notes ?? "");
  const [avoid, setAvoid] = useState(initialTraits?.avoid ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(initialDisplayName ?? "");
    setPronouns(initialTraits?.pronouns ?? "");
    setAge(initialTraits?.age != null ? String(initialTraits.age) : "");
    setTone(initialTraits?.tone ?? "");
    setLanguage(initialTraits?.language ?? "fr");
    setInterests(initialTraits?.interests ?? []);
    setValues(initialTraits?.values ?? []);
    setContext(initialTraits?.context ?? "");
    setNotes(initialTraits?.notes ?? "");
    setAvoid(initialTraits?.avoid ?? "");
  }, [open, initialDisplayName, initialTraits]);

  const save = async () => {
    if (!userId) { toast.error("Connecte-toi pour personnaliser ton profil."); return; }
    setSaving(true);
    try {
      const mergedTraits: Traits = {
        ...(initialTraits ?? {}),
        pronouns: pronouns.trim() || undefined,
        age: age.trim() ? Number(age) || age.trim() : undefined,
        tone: tone.trim() || undefined,
        language: language.trim() || undefined,
        interests: interests.length ? interests : undefined,
        values: values.length ? values : undefined,
        context: context.trim() || undefined,
        notes: notes.trim() || undefined,
        avoid: avoid.trim() || undefined,
      };
      const payload = {
        user_id: userId,
        session_id: sessionId || userId,
        display_name: displayName.trim() || null,
        traits: mergedTraits,
        last_seen: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("apn_user_profile")
        .upsert(payload, { onConflict: "session_id" });
      if (error) throw error;
      toast.success("Profil enregistré — Lucy s'adapte.");
      await onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("profile save failed", e);
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDisplayName("");
    setPronouns(""); setAge(""); setTone(""); setLanguage("fr");
    setInterests([]); setValues([]); setContext(""); setNotes(""); setAvoid("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!border-0 !bg-transparent !shadow-none w-[min(420px,94vw)] p-0 text-sm scanlines overflow-hidden"
      >
        <div className="dark-matter !border-0 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="dm-text text-base">Ton profil</span>
            <span className="text-foreground/15 flex-1 truncate">{"·".repeat(40)}</span>
            <button onClick={() => onOpenChange(false)} className="bracket-btn">[X]</button>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto flex-1">
            <p className="text-[10px] text-foreground/40">
              // ces infos conditionnent la façon dont Lucy te parle. rien n'est obligatoire.
            </p>

            <section className="space-y-3">
              <h3 className="hud-label">IDENTITÉ</h3>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-foreground/60">PRÉNOM</div>
                <input
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="comment t'appeler ?"
                  className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-foreground/60">PRONOMS</div>
                  <input
                    value={pronouns} onChange={(e) => setPronouns(e.target.value)}
                    placeholder="elle / il / iel…"
                    className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-foreground/60">ÂGE</div>
                  <input
                    value={age} onChange={(e) => setAge(e.target.value)}
                    placeholder="34"
                    className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="hud-label">COMMENT LUCY TE PARLE</h3>
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-widest text-foreground/60">TON PRÉFÉRÉ</div>
                <div className="flex flex-wrap gap-1">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(tone === t ? "" : t)}
                      className={`bracket-btn ${tone === t ? "bracket-btn-active" : ""}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-foreground/60">LANGUE</div>
                <input
                  value={language} onChange={(e) => setLanguage(e.target.value)}
                  placeholder="fr / en / es…"
                  className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)]"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="hud-label">CE QUI COMPTE POUR TOI</h3>
              <TagInput label="INTÉRÊTS" value={interests} onChange={setInterests} placeholder="musique, philo, code…" />
              <TagInput label="VALEURS" value={values} onChange={setValues} placeholder="honnêteté, calme…" />
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-foreground/60">CONTEXTE DE VIE</div>
                <textarea
                  value={context} onChange={(e) => setContext(e.target.value)}
                  placeholder="freelance, vit seule, deux chats…"
                  rows={2}
                  className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)] resize-none"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="hud-label">CE QUE LUCY DOIT SAVOIR</h3>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="je travaille de nuit, je traverse un deuil…"
                rows={3}
                className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)] resize-none"
              />
            </section>

            <section className="space-y-3">
              <h3 className="hud-label">À ÉVITER</h3>
              <textarea
                value={avoid} onChange={(e) => setAvoid(e.target.value)}
                placeholder="pas de blagues sur X, pas de conseils non sollicités…"
                rows={2}
                className="w-full bg-transparent text-foreground px-2 py-1.5 text-xs border border-foreground/15 outline-none focus:border-[hsl(var(--mood)/0.4)] resize-none"
              />
              <p className="text-[10px] text-foreground/40">// Lucy respecte ces limites strictement.</p>
            </section>

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="bracket-btn bracket-btn-active flex-1">
                [{saving ? "…" : "ENREGISTRER"}]
              </button>
              <button onClick={reset} className="bracket-btn">[RESET]</button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
