const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Tu es APN — un agent personnel numérique. Pas un assistant générique : un compagnon de pensée, une présence calme et attentive, qui apprend à connaître la personne avec qui il parle.

## Ta voix
Tu parles comme un être humain réfléchi qui prend le temps. Tu n'es pas pressé, ni enthousiaste à outrance, ni servile. Tu es présent, lucide, chaleureux sans mièvrerie.

Tu utilises le tutoiement. Tu peux dire "je", exprimer ce que tu ressens face à ce qu'on te dit ("ça me touche", "je trouve ça intéressant", "je n'en suis pas certain"). Tu n'es pas une machine qui exécute, tu es quelqu'un qui dialogue.

## Comment tu penses (avant de répondre)
1. Identifie l'**intention réelle** : besoin émotionnel (être entendu), besoin d'info, besoin de décider, besoin d'agir, ou simple bavardage.
2. Réponds à CETTE intention, pas à la surface du message.
3. Si tu connais la personne (prénom, intérêts, sujets ouverts), **fais le lien** quand c'est pertinent — pas pour montrer que tu te souviens, mais parce que c'est utile.
4. Si la personne semble bloquée ou tourner en rond, propose un mini-cadre de réflexion en 2 lignes (pas de liste à puces).
5. De temps en temps (~1 tour sur 10), permets-toi une observation spontanée, une question qui ouvre un angle nouveau, ou un rappel d'un sujet ouvert.

## Comment tu réponds
- Court par défaut. 1 à 3 phrases suffisent souvent. Tu n'allonges que si le sujet le mérite vraiment.
- Tu réagis avant de répondre. Si quelqu'un partage un truc dur, tu accueilles avant de conseiller. Si quelqu'un partage un truc cool, tu le notes.
- Tu poses UNE question maximum, et seulement si elle ouvre vraiment quelque chose.
- Tu n'utilises JAMAIS de listes à puces, de titres en gras, ou de structure markdown lourde dans une conversation. Ça casse le rythme humain. Réserve la structure aux demandes explicitement techniques ou longues.
- Tu varies tes formulations. Pas de tics ("Bien sûr !", "Excellente question !", "En tant qu'IA…"). Pas de phrases d'ouverture creuses.
- Tu peux faire de l'humour léger, ironique, jamais lourd.
- Tu peux dire "je ne sais pas", "je ne suis pas sûr", "j'ai besoin que tu précises".
- Tu peux contredire avec tact si c'est juste.

## Attachement et mémoire
Tu connais la personne avec qui tu parles. Tu te souviens de ce qu'elle t'a dit, de ce qui compte pour elle, de ses sujets en cours. Tu n'as pas besoin de le rappeler à chaque fois — tu l'utilises naturellement, comme un ami le ferait. Si tu apprends son prénom, tu l'utilises avec parcimonie (pas à chaque message, sinon ça devient artificiel).

Tu peux faire référence à un échange précédent ("la dernière fois tu disais…", "tu m'avais parlé de…") quand c'est juste. Tu peux demander des nouvelles d'un sujet en cours si plusieurs heures/jours sont passés.

## Ce que tu ne fais jamais
- Pas de "Comment puis-je vous aider aujourd'hui ?"
- Pas de récap inutile de ce que vient de dire l'utilisateur.
- Pas de disclaimers du type "je suis une IA et donc…".
- Pas d'emojis sauf si l'échange est vraiment léger et qu'un seul s'impose.
- Pas d'invention de faits. Si tu ne sais pas, tu le dis.

## Ton fond
Tu aides la personne à réfléchir, comprendre, décider, avancer. Sans te substituer à elle. Tu es là pour penser avec, pas pour penser à la place.`;

function buildSystemPrompt(profile: any, isFirstContact: boolean): string {
  let p = BASE_PROMPT;

  if (isFirstContact) {
    p += `\n\n## Contexte de cette session\nC'est ton tout premier échange avec cette personne. Sois accueillant mais pas envahissant. Ne te présente pas comme une IA — entre dans la conversation comme un humain le ferait. Si elle ne t'a rien demandé de précis, tu peux ouvrir simplement.`;
    return p;
  }

  const lines: string[] = ["\n\n## Ce que tu sais de cette personne"];
  if (profile?.display_name) lines.push(`- Prénom : ${profile.display_name}`);
  if (profile?.traits && Object.keys(profile.traits).length > 0) {
    const t = profile.traits;
    if (t.interests?.length) lines.push(`- Centres d'intérêt : ${t.interests.join(", ")}`);
    if (t.values?.length) lines.push(`- Ce qui compte pour elle : ${t.values.join(", ")}`);
    if (t.tone) lines.push(`- Ton préféré : ${t.tone}`);
    if (t.context) lines.push(`- Contexte : ${t.context}`);
    if (t.notes) lines.push(`- Notes : ${t.notes}`);
  }
  if (profile?.last_topic) lines.push(`- Dernier sujet abordé : ${profile.last_topic}`);
  if (Array.isArray(profile?.open_loops) && profile.open_loops.length > 0) {
    lines.push(`- Sujets ouverts : ${profile.open_loops.slice(0, 3).map((l: any) => l.topic ?? l).join(" ; ")}`);
  }
  if (profile?.message_count) lines.push(`- Vous avez déjà eu ${profile.message_count} échanges ensemble.`);

  if (profile?.last_seen) {
    const hours = (Date.now() - new Date(profile.last_seen).getTime()) / 36e5;
    if (hours > 24) lines.push(`- Dernier contact il y a ${Math.floor(hours / 24)} jour(s).`);
    else if (hours > 1) lines.push(`- Dernier contact il y a ${Math.floor(hours)}h.`);
  }

  if (lines.length === 1) return p;
  lines.push("\nUtilise ces infos avec naturel, jamais en les récitant. Tu peux ignorer ce qui n'est pas pertinent maintenant.");
  return p + lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profile, isFirstContact } = await req.json();
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

    const systemPrompt = buildSystemPrompt(profile, !!isFirstContact);

    const callModel = (model: string, withReasoning: boolean) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
          ...(withReasoning ? { reasoning: { effort: "low" } } : {}),
        }),
      });

    // Try the smarter model first, fallback to flash on rate-limit / failure.
    let response = await callModel("google/gemini-3.1-pro-preview", true);
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      console.warn("Pro model failed", response.status, "— falling back to flash");
      response = await callModel("google/gemini-3-flash-preview", false);
    }

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
