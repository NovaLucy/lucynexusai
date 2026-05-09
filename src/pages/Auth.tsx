import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = mode === "signup" ? "APN — Créer un compte" : "APN — Connexion";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/", { replace: true });
    });
  }, [mode, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé. Vérifie tes mails pour confirmer.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur d'authentification");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Erreur Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    nav("/", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Créer un compte" : "Connexion à APN"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Tes conversations, profil et dossiers santé restent privés.
          </p>
        </header>

        <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signup" ? "Créer le compte" : "Se connecter"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline w-full text-center"
        >
          {mode === "signup" ? "J'ai déjà un compte" : "Créer un compte"}
        </button>
      </section>
    </main>
  );
}
