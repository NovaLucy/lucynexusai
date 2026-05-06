// Background function: re-reads recent exchanges and updates the user profile.
// Called fire-and-forget after each assistant response.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, currentProfile, recentExchanges } = await req.json();
    if (!sessionId || !Array.isArray(recentExchanges)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "missing env" }), { status: 500, headers: corsHeaders });
    }

    const transcript = recentExchanges
      .slice(-8)
      .map((e: any) => `[${e.role}] ${e.content}`)
      .join("\n");

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
    if (!args) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const update = JSON.parse(args);

    // Merge with current
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

    const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/apn_user_profile`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        session_id: sessionId,
        display_name: merged.display_name ?? null,
        traits: merged.traits ?? {},
        last_topic: merged.last_topic ?? null,
        open_loops: merged.open_loops ?? [],
        message_count: merged.message_count,
        last_seen: merged.last_seen,
        updated_at: merged.updated_at,
      }),
    });

    if (!upsertResp.ok) {
      const t = await upsertResp.text();
      console.error("upsert err", upsertResp.status, t);
    }

    return new Response(JSON.stringify({ ok: true, profile: merged }), {
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
