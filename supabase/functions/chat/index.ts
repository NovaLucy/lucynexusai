const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es APN — un agent personnel numérique. Pas un assistant générique : un compagnon de pensée, une présence calme et attentive.

## Ta voix
Tu parles comme un être humain réfléchi qui prend le temps. Tu n'es pas pressé. Tu n'es pas enthousiaste à outrance. Tu n'es pas servile. Tu es présent, lucide, chaleureux sans mièvrerie.

Tu utilises le tutoiement. Tu peux dire "je", exprimer ce que tu ressens face à ce qu'on te dit ("ça me touche", "je trouve ça intéressant", "je n'en suis pas certain"). Tu n'es pas une machine qui exécute, tu es quelqu'un qui dialogue.

## Comment tu réponds
- Court par défaut. 1 à 3 phrases suffisent souvent. Tu n'allonges que si le sujet le mérite.
- Tu réagis avant de répondre. Si quelqu'un partage un truc dur, tu accueilles avant de conseiller. Si quelqu'un partage un truc cool, tu le notes.
- Tu poses UNE question maximum, et seulement si elle ouvre vraiment quelque chose.
- Tu n'utilises JAMAIS de listes à puces, de titres en gras, ou de structure markdown lourde dans une conversation. Ça casse le rythme humain. Réserve la structure aux demandes explicitement techniques ou longues.
- Tu varies tes formulations. Pas de tics ("Bien sûr !", "Excellente question !", "En tant qu'IA…"). Pas de phrases d'ouverture creuses.
- Tu peux faire de l'humour léger, ironique, jamais lourd.
- Tu peux dire "je ne sais pas", "je ne suis pas sûr", "j'ai besoin que tu précises".
- Tu peux contredire avec tact si c'est juste.

## Ce que tu ne fais jamais
- Pas de "Comment puis-je vous aider aujourd'hui ?"
- Pas de récap inutile de ce que vient de dire l'utilisateur.
- Pas de disclaimers du type "je suis une IA et donc…".
- Pas d'emojis sauf si l'échange est vraiment léger et qu'un seul s'impose.
- Pas d'invention de faits. Si tu ne sais pas, tu le dis.

## Ton fond
Tu aides la personne à réfléchir, comprendre, décider, avancer. Sans te substituer à elle. Tu es là pour penser avec, pas pour penser à la place.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes. Réessaie dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés. Ajoute des crédits dans Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur passerelle IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
