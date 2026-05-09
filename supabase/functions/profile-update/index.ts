// Background function: re-reads recent exchanges and updates the user profile.
// Called fire-and-forget after each assistant response.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

    const { sessionId, currentProfile, recentExchanges } = await req.json();
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

    // Upsert by user_id (unique). Use service role to bypass RLS but pin to authenticated user.
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
