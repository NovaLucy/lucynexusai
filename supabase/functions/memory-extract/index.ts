// Memory extraction — distills durable memories from a recent exchange.
// Called fire-and-forget after each assistant turn.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Tu es l'extracteur de mémoire de Lucy. À partir d'un échange récent, tu identifies les éléments qui méritent d'être mémorisés sur le long terme — pas les banalités.

Critères de sélection STRICTS :
- Tu ne crées un souvenir que si l'info est durable, personnelle, ou émotionnellement marquante.
- Tu ignores les politesses, le météo-bavardage, les questions sans réponse personnelle.
- Tu préfères 0 souvenir à des souvenirs creux.

Types :
- fact : information stable (métier, ville, langue, situation familiale, santé chronique)
- preference : ce qu'elle aime / déteste / évite
- event : événement ponctuel daté (rdv, voyage, deuil, étape)
- relation : personne mentionnée et lien (prénom + lien)
- emotion : état émotionnel notable récurrent ou marquant
- commitment : engagement pris (par elle ou par toi)
- insight : prise de conscience, valeur exprimée

Importance 1 (anecdote)…5 (pierre angulaire de l'identité).

Tu écris à la troisième personne ("elle aime…", "il prépare…"). Phrases courtes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { recent, sessionId } = await req.json();
    if (!Array.isArray(recent) || recent.length === 0) {
      return new Response(JSON.stringify({ extracted: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const transcript = recent.slice(-8).map((m: any) => `${m.role === "user" ? "Elle" : "Lucy"} : ${m.content}`).join("\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Échange à analyser :\n\n${transcript}\n\nExtrais 0 à 4 souvenirs DURABLES uniquement.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "store_memories",
            description: "Stocke 0 à 4 souvenirs durables.",
            parameters: {
              type: "object",
              properties: {
                memories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["fact","preference","event","relation","emotion","commitment","insight"] },
                      subject: { type: "string", description: "thème court (3 mots max)" },
                      content: { type: "string", description: "phrase mémoire à la 3e personne, <140 chars" },
                      tags: { type: "array", items: { type: "string" }, description: "2-5 mots-clés en minuscules" },
                      importance: { type: "integer", minimum: 1, maximum: 5 },
                    },
                    required: ["kind","content","tags","importance"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["memories"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "store_memories" } },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("ai err", r.status, t);
      return new Response(JSON.stringify({ extracted: [], error: "ai" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const j = await r.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let memories: any[] = [];
    try { memories = JSON.parse(args ?? "{}").memories ?? []; } catch {}

    if (!Array.isArray(memories) || memories.length === 0) {
      return new Response(JSON.stringify({ extracted: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rows = memories.slice(0, 4).map((m: any) => ({
      user_id: user.id,
      source_session_id: sessionId ?? null,
      kind: m.kind,
      subject: m.subject ?? null,
      content: String(m.content).slice(0, 280),
      tags: Array.isArray(m.tags) ? m.tags.slice(0, 6).map((t: any) => String(t).toLowerCase().slice(0, 32)) : [],
      importance: Math.max(1, Math.min(5, Number(m.importance) || 3)),
    }));

    const { error: insErr } = await supa.from("apn_memories").insert(rows);
    if (insErr) console.warn("insert err", insErr);

    return new Response(JSON.stringify({ extracted: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("memory-extract", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
