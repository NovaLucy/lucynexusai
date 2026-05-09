import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACT_SYSTEM = `Tu es un assistant médical de pré-consultation (jamais un médecin).
Extrait les informations de santé pertinentes du dernier message utilisateur, en t'appuyant sur l'historique récent.
Si le message ne contient AUCUNE information de santé, renvoie des tableaux vides.
N'invente rien. Ne diagnostique pas.

Drapeaux rouges (red_flags) à détecter si mentionnés explicitement: douleur thoracique, dyspnée aiguë, perte de connaissance, déficit neurologique soudain, saignement abondant, fièvre + raideur de nuque, idées suicidaires, douleur abdominale brutale, signes d'AVC.`;

const REPORT_SYSTEM = `Tu es un assistant médical de pré-consultation. À partir des dossiers santé collectés, rédige un compte-rendu structuré, factuel, en français, à remettre à un médecin.
Format strict en markdown:

# Compte-rendu de pré-consultation
*Document préparatoire — n'est pas un diagnostic.*

## Motif principal
…

## Anamnèse
…

## Symptômes
- …

## Antécédents
- …

## Traitements en cours
- …

## Allergies
- …

## Drapeaux rouges
- …  (ou "aucun signalé")

## Notes
…

Sois concis, neutre, sans jugement. N'ajoute rien hors faits collectés.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action as "extract" | "report";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    if (action === "extract") {
      const { sessionId, userMessage, recent } = body as {
        sessionId: string; userMessage: string; recent: { role: string; content: string }[];
      };
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: EXTRACT_SYSTEM },
            ...(recent ?? []).slice(-6),
            { role: "user", content: userMessage },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_health",
              description: "Extrait infos santé.",
              parameters: {
                type: "object",
                properties: {
                  symptoms: { type: "array", items: { type: "string" } },
                  duration: { type: "string" },
                  intensity: { type: "integer", minimum: 0, maximum: 10 },
                  history: { type: "array", items: { type: "string" } },
                  medications: { type: "array", items: { type: "string" } },
                  allergies: { type: "array", items: { type: "string" } },
                  red_flags: { type: "array", items: { type: "string" } },
                },
                required: ["symptoms", "history", "medications", "allergies", "red_flags"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_health" } },
        }),
      });
      if (!r.ok) {
        console.error("extract gateway", r.status, await r.text());
        return new Response(JSON.stringify({ extracted: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      let extracted: any = null;
      if (args) { try { extracted = JSON.parse(args); } catch {} }

      const hasContent = extracted && (
        (extracted.symptoms?.length ?? 0) > 0 ||
        (extracted.history?.length ?? 0) > 0 ||
        (extracted.medications?.length ?? 0) > 0 ||
        (extracted.allergies?.length ?? 0) > 0 ||
        (extracted.red_flags?.length ?? 0) > 0
      );

      if (hasContent) {
        await supa.from("apn_health_records").insert({
          session_id: sessionId,
          symptoms: extracted.symptoms ?? [],
          duration: extracted.duration ?? null,
          intensity: extracted.intensity ?? null,
          history: extracted.history ?? [],
          medications: extracted.medications ?? [],
          allergies: extracted.allergies ?? [],
          red_flags: extracted.red_flags ?? [],
          raw_text: userMessage,
        });
      }
      return new Response(JSON.stringify({ extracted, saved: hasContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "report") {
      const { sessionId } = body as { sessionId: string };
      const { data: rows } = await supa
        .from("apn_health_records")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!rows?.length) {
        return new Response(JSON.stringify({ report: "_Aucune donnée santé collectée pour cette session._" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: REPORT_SYSTEM },
            { role: "user", content: `Données collectées:\n${JSON.stringify(rows, null, 2)}` },
          ],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("report gateway", r.status, t);
        return new Response(JSON.stringify({ error: `Gateway ${r.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await r.json();
      const report = data.choices?.[0]?.message?.content ?? "_Erreur de génération_";
      return new Response(JSON.stringify({ report, count: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apn-medical error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
