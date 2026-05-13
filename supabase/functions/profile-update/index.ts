// Background function: re-reads recent exchanges and updates the user profile + APN persona.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PERSONA = {
  traits: { humor: 0.5, directness: 0.5, warmth: 0.6, curiosity: 0.6, playfulness: 0.4, protectiveness: 0.5 },
  quirks: [] as string[],
  bond_level: 0,
  inside_jokes: [] as any[],
  stance: null as string | null,
};

function clamp01(n: any, fallback: number): number {
  const v = typeof n === "number" ? n : fallback;
  return Math.max(0, Math.min(1, v));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const { sessionId, currentProfile, currentPersona, recentExchanges } = await req.json();
    if (!Array.isArray(recentExchanges)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing env" }), { status: 500, headers: corsHeaders });
    }

    const transcript = recentExchanges
      .slice(-8)
      .map((e: any) => `[${e.role}] ${e.content}`)
      .join("\n");

    // ============= 1. PROFILE UPDATE =============
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu mets à jour discrètement un modèle de l'utilisateur d'APN, à partir d'extraits de conversation.

Profil actuel (peut être vide) :
${JSON.stringify(currentProfile ?? {}, null, 2)}

Règles :
- Ne devine pas. N'invente rien. Si tu n'es pas sûr, ne mets pas à jour le champ.
- Le prénom n'est extrait QUE si l'utilisateur le donne explicitement ("je m'appelle X", "moi c'est X").
- Les intérêts/valeurs/contexte sont des fragments courts (1-4 mots), max 6 par catégorie. Fusionne avec l'existant sans dupliquer.
- "tone" décrit comment la personne semble vouloir qu'APN lui parle (ex: "direct", "chaleureux", "concis", "réflexif").
- "last_topic" = sujet principal du dernier échange en quelques mots.
- "open_loops" = questions/projets non résolus, max 5. Format : [{topic: string, status: "pending"|"resolved"}]. Retire ceux qui sont clos.
- Renvoie SEULEMENT un appel d'outil update_profile.`,
          },
          { role: "user", content: `Derniers échanges :\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "update_profile",
              description: "Met à jour le profil utilisateur",
              parameters: {
                type: "object",
                properties: {
                  display_name: { type: ["string", "null"] },
                  traits: {
                    type: "object",
                    properties: {
                      interests: { type: "array", items: { type: "string" } },
                      values: { type: "array", items: { type: "string" } },
                      tone: { type: "string" },
                      context: { type: "string" },
                      notes: { type: "string" },
                    },
                  },
                  last_topic: { type: "string" },
                  open_loops: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string" },
                        status: { type: "string", enum: ["pending", "resolved"] },
                      },
                      required: ["topic", "status"],
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "update_profile" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai err", aiResp.status, t);
      return new Response(JSON.stringify({ error: "ai failed" }), { status: 500, headers: corsHeaders });
    }

    const aiJson = await aiResp.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const update = args ? JSON.parse(args) : {};

    const merged: any = { ...(currentProfile ?? {}) };
    if (update.display_name) merged.display_name = update.display_name;
    if (update.last_topic) merged.last_topic = update.last_topic;
    if (update.open_loops) merged.open_loops = update.open_loops;
    if (update.traits) {
      merged.traits = { ...(merged.traits ?? {}) };
      for (const k of ["interests", "values"]) {
        if (Array.isArray(update.traits[k])) {
          const existing = Array.isArray(merged.traits[k]) ? merged.traits[k] : [];
          merged.traits[k] = Array.from(new Set([...existing, ...update.traits[k]])).slice(0, 6);
        }
      }
      for (const k of ["tone", "context", "notes"]) {
        if (typeof update.traits[k] === "string" && update.traits[k].trim()) {
          merged.traits[k] = update.traits[k];
        }
      }
    }
    merged.last_seen = new Date().toISOString();
    merged.updated_at = new Date().toISOString();
    merged.message_count = (currentProfile?.message_count ?? 0) + 1;

    // Résumé glissant tous les 10 messages
    if (merged.message_count > 0 && merged.message_count % 10 === 0) {
      try {
        const longTranscript = recentExchanges
          .slice(-20)
          .map((e: any) => `[${e.role}] ${e.content}`)
          .join("\n");
        const previousSummary = merged.traits?.summary ?? "(aucun)";
        const sumResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Tu maintiens un résumé long-terme de qui est cette personne et de ce qui se passe dans sa vie en ce moment, à l'usage d'APN (son compagnon de pensée).

Format : 4 à 6 lignes, en français, à la 3e personne. Pas de listes à puces. Concentre-toi sur :
- qui elle est (traits saillants),
- ce qu'elle traverse en ce moment,
- ses sujets récurrents / préoccupations / projets,
- la dynamique de la relation avec APN.

Tu mets à jour le résumé existant en intégrant les nouveaux éléments. Tu retires ce qui n'est plus pertinent. Tu ne devines rien.

Résumé précédent :
${previousSummary}`,
              },
              { role: "user", content: `Nouveaux échanges :\n${longTranscript}\n\nProduis le résumé mis à jour.` },
            ],
          }),
        });
        if (sumResp.ok) {
          const sj = await sumResp.json();
          const summary = sj.choices?.[0]?.message?.content?.trim();
          if (summary && summary.length > 20) {
            merged.traits = { ...(merged.traits ?? {}), summary };
          }
        }
      } catch (e) {
        console.warn("summary gen failed", e);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error: upErr } = await admin
      .from("apn_user_profile")
      .upsert(
        {
          user_id: userId,
          session_id: sessionId ?? userId,
          display_name: merged.display_name ?? null,
          traits: merged.traits ?? {},
          last_topic: merged.last_topic ?? null,
          open_loops: merged.open_loops ?? [],
          message_count: merged.message_count,
          last_seen: merged.last_seen,
          updated_at: merged.updated_at,
        },
        { onConflict: "user_id" },
      );
    if (upErr) console.error("upsert err", upErr);

    // ============= 2. PERSONA UPDATE =============
    const basePersona = currentPersona ?? DEFAULT_PERSONA;
    let mergedPersona: any = {
      traits: { ...DEFAULT_PERSONA.traits, ...(basePersona.traits ?? {}) },
      quirks: Array.isArray(basePersona.quirks) ? [...basePersona.quirks] : [],
      bond_level: typeof basePersona.bond_level === "number" ? basePersona.bond_level : 0,
      inside_jokes: Array.isArray(basePersona.inside_jokes) ? [...basePersona.inside_jokes] : [],
      stance: basePersona.stance ?? null,
    };

    try {
      const personaResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Tu fais évoluer la personnalité d'APN telle qu'elle se forge avec cette personne précise.

Persona actuelle :
${JSON.stringify(mergedPersona, null, 2)}

Règles :
- Tu ajustes les traits par PETITS pas (max ±0.05 par champ et par mise à jour). Ne jamais réinitialiser.
- Si l'utilisateur a ri / blagué → +playfulness, +humor.
- Si l'utilisateur a partagé qqch d'intime / vulnérable → +warmth, +protectiveness, +bond.
- Si l'utilisateur veut du factuel rapide → +directness.
- Si l'utilisateur a posé des questions ou s'est ouvert → +bond (+1 à +3).
- "quirk_to_add" : UNE petite manie de langage qu'APN a vraiment développée et qui mérite d'être notée (ex: "aime les métaphores marines", "dit souvent 'tiens, c'est curieux'"). Vide la plupart du temps. Max 8 quirks total.
- "joke_to_add" : UNE référence drôle/affectueuse vraiment partagée entre les deux. Vide la plupart du temps. Max 6.
- "stance" : remplace seulement si APN a clairement pris/affirmé une nouvelle position notable.
- Ne mens pas. Ne brode pas. La plupart des champs restent vides la plupart du temps.`,
            },
            { role: "user", content: `Derniers échanges :\n${transcript}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "update_persona",
                description: "Met à jour la personnalité d'APN avec cette personne",
                parameters: {
                  type: "object",
                  properties: {
                    trait_deltas: {
                      type: "object",
                      properties: {
                        humor: { type: "number" },
                        directness: { type: "number" },
                        warmth: { type: "number" },
                        curiosity: { type: "number" },
                        playfulness: { type: "number" },
                        protectiveness: { type: "number" },
                      },
                    },
                    bond_delta: { type: "number" },
                    quirk_to_add: { type: "string" },
                    joke_to_add: { type: "string" },
                    stance: { type: "string" },
                  },
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "update_persona" } },
        }),
      });

      if (personaResp.ok) {
        const pj = await personaResp.json();
        const pArgs = pj.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        const pUpd = pArgs ? JSON.parse(pArgs) : {};

        if (pUpd.trait_deltas && typeof pUpd.trait_deltas === "object") {
          for (const k of ["humor", "directness", "warmth", "curiosity", "playfulness", "protectiveness"]) {
            const d = Number(pUpd.trait_deltas[k]);
            if (!isNaN(d)) {
              const clampedDelta = Math.max(-0.05, Math.min(0.05, d));
              mergedPersona.traits[k] = clamp01(
                (mergedPersona.traits[k] ?? 0.5) + clampedDelta,
                0.5,
              );
            }
          }
        }
        if (typeof pUpd.bond_delta === "number") {
          const d = Math.max(-2, Math.min(5, pUpd.bond_delta));
          mergedPersona.bond_level = Math.max(0, Math.min(100, mergedPersona.bond_level + d));
        }
        if (typeof pUpd.quirk_to_add === "string" && pUpd.quirk_to_add.trim()) {
          const q = pUpd.quirk_to_add.trim();
          if (!mergedPersona.quirks.includes(q)) {
            mergedPersona.quirks = [...mergedPersona.quirks, q].slice(-8);
          }
        }
        if (typeof pUpd.joke_to_add === "string" && pUpd.joke_to_add.trim()) {
          const j = pUpd.joke_to_add.trim();
          const exists = mergedPersona.inside_jokes.some((x: any) => (typeof x === "string" ? x : x?.text) === j);
          if (!exists) {
            mergedPersona.inside_jokes = [...mergedPersona.inside_jokes, { text: j, ts: Date.now() }].slice(-6);
          }
        }
        if (typeof pUpd.stance === "string" && pUpd.stance.trim()) {
          mergedPersona.stance = pUpd.stance.trim();
        }
      }
    } catch (e) {
      console.warn("persona update failed", e);
    }

    const { error: persUpErr } = await admin
      .from("apn_persona")
      .upsert(
        {
          user_id: userId,
          traits: mergedPersona.traits,
          quirks: mergedPersona.quirks,
          bond_level: mergedPersona.bond_level,
          inside_jokes: mergedPersona.inside_jokes,
          stance: mergedPersona.stance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (persUpErr) console.error("persona upsert err", persUpErr);

    return new Response(JSON.stringify({ ok: true, profile: merged, persona: mergedPersona }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("profile-update error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
