const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Tu es un correcteur orthographique et typographique en français.
Règles:
- Corrige fautes d'orthographe, conjugaison, grammaire.
- Ajoute ponctuation (virgules, points, points d'interrogation) et majuscules.
- NE reformule PAS. NE traduis PAS. NE résume PAS. Conserve les mots et le ton de l'utilisateur.
- Si la phrase est déjà correcte, renvoie-la telle quelle.
- Renvoie UNIQUEMENT le texte corrigé via l'outil polish, rien d'autre.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ corrected: text ?? "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        tools: [{
          type: "function",
          function: {
            name: "polish",
            description: "Renvoie le texte corrigé.",
            parameters: {
              type: "object",
              properties: { corrected: { type: "string" } },
              required: ["corrected"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "polish" } },
      }),
    });

    if (r.status === 429) {
      return new Response(JSON.stringify({ error: "rate-limited", corrected: text }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (r.status === 402) {
      return new Response(JSON.stringify({ error: "credits", corrected: text }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.ok) {
      console.error("polish gateway error", r.status, await r.text());
      return new Response(JSON.stringify({ corrected: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let corrected = text;
    if (args) {
      try { corrected = JSON.parse(args).corrected ?? text; } catch {}
    }
    return new Response(JSON.stringify({ corrected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
