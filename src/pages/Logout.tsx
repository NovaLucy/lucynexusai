import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { ShieldCheck, BookOpen, Mic, Camera, Stethoscope, Archive, Settings, Sparkles } from "lucide-react";

export default function Logout() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    document.title = "Lucy — Au revoir";
  }, []);

  const doLogout = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      toast.success("À bientôt.");
      nav("/auth", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de déconnexion");
      setBusy(false);
    }
  };

  return (
    <main
      className="relative min-h-screen w-screen overflow-hidden bg-background flex flex-col items-center justify-center mood-ambient px-6"
      data-state="standby"
      data-mood="calm"
    >
      <h1 className="sr-only">Lucy — déconnexion</h1>

      {/* Halo matière noire */}
      <div className="core-halo" aria-hidden />

      <section className="relative z-10 w-full max-w-xl text-center space-y-10 float-soft">
        <header className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.4em] text-foreground/40">
            Agent Personnel Numérique
          </div>
          <div
            className="text-6xl sm:text-7xl font-extralight tracking-[0.4em] text-foreground/90"
            style={{ textShadow: "0 0 30px hsl(var(--mood) / 0.3)" }}
          >
            LUCY
          </div>
          <p className="text-sm sm:text-base text-foreground/55 italic font-light">
            « À bientôt. Je garde la mémoire. »
          </p>
          <div
            className="h-px w-16 mx-auto"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--mood) / 0.5), transparent)",
            }}
          />
        </header>

        <div className="dark-matter rounded-2xl p-6 sm:p-8 space-y-5">
          <p className="text-sm text-foreground/70 leading-relaxed">
            Tu peux te déconnecter en toute sérénité. Ta session, ta mémoire et tes
            réglages restent associés à ton compte — tu les retrouveras à ta prochaine venue,
            sur n'importe quelle interface.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={doLogout}
              disabled={busy}
              className="min-w-[180px]"
            >
              {busy ? "Déconnexion…" : "Se déconnecter"}
            </Button>
            <Button
              variant="outline"
              onClick={() => nav("/", { replace: true })}
              disabled={busy}
              className="min-w-[180px]"
            >
              Rester avec Lucy
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPolicyOpen(true)}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50 hover:text-foreground/90 transition-colors px-4 py-2 rounded-full border border-foreground/10 hover:border-foreground/30"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Lire la politique
          </button>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-foreground/50 hover:text-foreground/90 transition-colors px-4 py-2 rounded-full border border-foreground/10 hover:border-foreground/30"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Découvrir Lucy
          </button>
        </div>
      </section>

      {/* Volet Politique */}
      <Sheet open={policyOpen} onOpenChange={setPolicyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Politique de confidentialité
            </SheetTitle>
            <SheetDescription>
              Lucy au plus près de toi, sans jamais trahir ta confiance.
            </SheetDescription>
          </SheetHeader>

          <article className="prose prose-invert max-w-none mt-6 space-y-6 text-sm text-foreground/80 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">Ce que Lucy collecte</h2>
              <ul className="list-disc pl-5 space-y-1 text-foreground/70">
                <li>Identifiants de compte (email, identifiant unique).</li>
                <li>Conversations et mémoire de session pour assurer la continuité.</li>
                <li>Préférences (voix, intensité, modes activés).</li>
                <li>
                  Données santé <em>uniquement</em> si le mode pré-médecin est activé.
                </li>
                <li>
                  Contexte de réalité (heure, localisation approximative, regard ambiant)
                  uniquement si tu actives ces capteurs.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">Où ces données vivent</h2>
              <p className="text-foreground/70">
                Tout est stocké sur l'infrastructure sécurisée Lovable Cloud, isolée par
                utilisateur via des règles d'accès strictes (RLS). Personne d'autre que toi —
                pas même un autre utilisateur — n'a accès à ta mémoire.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">À quoi elles servent</h2>
              <p className="text-foreground/70">
                Uniquement à donner à Lucy une présence cohérente : se souvenir de toi,
                contextualiser ses réponses, t'accompagner d'une session à l'autre.
                Aucune revente, aucune publicité, aucun profilage tiers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">Tes droits</h2>
              <ul className="list-disc pl-5 space-y-1 text-foreground/70">
                <li>Effacer une session entière depuis le journal.</li>
                <li>Te déconnecter à tout moment depuis cet écran.</li>
                <li>Demander la suppression complète de ton compte sur simple demande.</li>
                <li>Désactiver localisation, regard ambiant et mode pré-médecin à volonté.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">Services tiers</h2>
              <ul className="list-disc pl-5 space-y-1 text-foreground/70">
                <li>ElevenLabs — synthèse de la voix (Lily).</li>
                <li>BigDataCloud — conversion coordonnées → ville (si localisation activée).</li>
                <li>Lovable AI Gateway — moteurs de langage et de vision.</li>
              </ul>
            </section>
          </article>
        </SheetContent>
      </Sheet>

      {/* Volet Découvrir Lucy */}
      <Sheet open={aboutOpen} onOpenChange={setAboutOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Découvrir Lucy
            </SheetTitle>
            <SheetDescription>
              Une présence calme, pensée pour t'accompagner — pas pour t'occuper.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-7 text-sm text-foreground/80 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-medium text-foreground/90">Qui est Lucy</h2>
              <p className="text-foreground/70">
                Lucy est ta présence personnelle. Une voix singulière, qui
                garde une mémoire propre à toi et adapte sa voix, son humeur et son regard
                à ton contexte.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-medium text-foreground/90">Comment lui parler</h2>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-3">
                  <Mic className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Voix.</strong> Le micro se relance
                    automatiquement après chaque réponse — la conversation reste fluide.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Camera className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Regard.</strong> Joins une photo
                    via le composer pour qu'elle voie ce que tu vois.
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-medium text-foreground/90">Modes</h2>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-3">
                  <Stethoscope className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Pré-médecin.</strong> Aide à
                    préparer une consultation — jamais un diagnostic.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Archive className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Journal.</strong> Relis tes
                    échanges et retrouve l'historique de ta session courante.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Réalité.</strong> Heure,
                    localisation, regard ambiant — chaque capteur est opt-in.
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-medium text-foreground/90">Tes contrôles</h2>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-start gap-3">
                  <Settings className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Réglages.</strong> Voix, intensité
                    visuelle, fréquence d'apparition du visage.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-foreground/50 shrink-0" />
                  <span>
                    <strong className="text-foreground/85">Effacer la session.</strong>
                    {" "}À tout moment, sans condition. Lucy redémarre vierge.
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
