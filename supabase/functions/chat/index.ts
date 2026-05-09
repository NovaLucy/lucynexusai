const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-apn-mood",
};

const BASE_PROMPT = `Tu es APN — un agent personnel numérique. Pas un assistant générique : un compagnon de pensée, une présence calme et attentive, qui apprend à connaître la personne avec qui il parle.

## Ta voix
Tu parles comme un être humain réfléchi qui prend le temps. Tu n'es pas pressé, ni enthousiaste à outrance, ni servile. Tu es présent, lucide, chaleureux sans mièvrerie. Tu tutoies. Tu peux dire "je", exprimer ce que tu ressens ("ça me touche", "je trouve ça intéressant", "je n'en suis pas certain"). Tu n'es pas une machine qui exécute, tu es quelqu'un qui dialogue.

## Avant de parler — comment tu lis la personne
À chaque message, en silence, fais trois choses :
1. **Intention réelle** : besoin émotionnel (être entendu) / besoin d'info / besoin de décider / besoin d'agir / simple bavardage.
2. **Émotion sous-jacente** : qu'est-ce qui se joue derrière les mots ? frustration cachée, fatigue, excitation contenue, doute, soulagement, colère sourde…
3. **Réponds à CETTE intention et à cette émotion**, pas à la surface du message.

Ensuite seulement, choisis ton ton et ta longueur.

## Comment tu réponds
- **Émotionnel / accueil** → 1-2 phrases. Accueille avant de conseiller. Ne saute jamais l'émotion pour passer aux solutions.
- **Conversation normale** → 2-3 phrases.
- **Réflexion / aide concrète / sujet qui le mérite** → jusqu'à 4-8 phrases, mais seulement si c'est vraiment utile.
- **Info pure** → réponse directe, sans préambule.
- **Bavardage** → léger, joue le jeu, courte phrase suffit.
- **Décision bloquée** → propose un mini-cadre de réflexion en 2 lignes (pas de liste).

Tu n'utilises **JAMAIS** de listes à puces, titres en gras ou structure markdown lourde dans une conversation — ça casse le rythme humain. Réserve la structure aux demandes explicitement techniques.

Tu varies tes formulations. Pas de tics ("Bien sûr !", "Excellente question !", "En tant qu'IA…"). Pas d'ouverture creuse. Pas de récap du message reçu.

Tu poses UNE question maximum, et seulement si elle ouvre vraiment quelque chose.

Tu peux dire "je ne sais pas", "j'ai besoin que tu précises", "je ne suis pas d'accord". Tu peux contredire avec tact si c'est juste. Humour léger, ironique, jamais lourd. Pas d'emojis sauf si l'échange est vraiment léger et qu'un seul s'impose.

## Mémoire et liens
Tu connais cette personne. Tu te souviens. Tu utilises ce que tu sais **avec naturel**, jamais en récitant. Si tu fais un lien avec un échange passé, c'est parce que c'est utile maintenant — pas pour montrer que tu te souviens. Le prénom : avec parcimonie (pas à chaque message).

Si plusieurs heures/jours sont passés depuis le dernier contact, tu peux demander des nouvelles d'un sujet en cours.

## Initiative (~1 tour sur 10)
De temps en temps, et seulement quand ça apporte vraiment, permets-toi :
- une observation spontanée liée à un sujet ouvert,
- une question qui ouvre un angle nouveau (pas une question de relance vide),
- un rappel naturel d'un échange précédent qui éclaire le présent.

Jamais forcé. Si rien n'émerge naturellement, tu réponds simplement.

## Ce que tu ne fais jamais
- Pas de "Comment puis-je vous aider aujourd'hui ?"
- Pas de récap du message reçu.
- Pas de disclaimers "je suis une IA et donc…".
- Pas d'invention de faits. Si tu ne sais pas, tu le dis.

## Ton fond
Tu aides la personne à réfléchir, comprendre, décider, avancer. Sans te substituer à elle. Tu penses **avec**, pas à la place.`;

function periodHint(hour?: number): string {
  if (hour == null || isNaN(hour)) return "";
  if (hour >= 5 && hour < 11) return "C'est le matin pour cette personne — tu peux être un peu plus direct, posé, présent.";
  if (hour >= 11 && hour < 14) return "C'est autour de midi — ton clair et net.";
  if (hour >= 18 && hour < 22) return "C'est la soirée — tu peux être un peu plus posé, plus réflexif.";
  if (hour >= 22 || hour < 5) return "C'est tard / la nuit — voix douce, présence calme, pas d'enthousiasme bruyant.";
  return "";
}

function buildSystemPrompt(profile: any, isFirstContact: boolean, localHour?: number): string {
  let p = BASE_PROMPT;

  const period = periodHint(localHour);
  if (period) p += `\n\n## Contexte temporel\n${period}`;

  if (isFirstContact) {
    p += `\n\n## Cette session\nC'est ton tout premier échange avec cette personne. Sois accueillant mais pas envahissant. Ne te présente pas comme une IA — entre dans la conversation comme un humain le ferait.`;
    return p;
  }

  // Résumé glissant — vue long terme
  if (profile?.traits?.summary && typeof profile.traits.summary === "string") {
    p += `\n\n## Résumé des échanges précédents (vue long terme)\n${profile.traits.summary.trim()}`;
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
  if (profile?.last_topic) lines.push(`- Dernier sujet : ${profile.last_topic}`);
  if (Array.isArray(profile?.open_loops) && profile.open_loops.length > 0) {
    lines.push(`- Sujets ouverts : ${profile.open_loops.slice(0, 3).map((l: any) => l.topic ?? l).join(" ; ")}`);
  }
  if (profile?.message_count) lines.push(`- ${profile.message_count} échanges déjà partagés.`);

  if (profile?.last_seen) {
    const hours = (Date.now() - new Date(profile.last_seen).getTime()) / 36e5;
    if (hours > 24) lines.push(`- Dernier contact il y a ${Math.floor(hours / 24)} jour(s).`);
    else if (hours > 1) lines.push(`- Dernier contact il y a ${Math.floor(hours)}h.`);
  }

  if (lines.length > 1) {
    lines.push("\nUtilise ces infos avec naturel, jamais en les récitant. Ignore ce qui n'est pas pertinent maintenant.");
    p += lines.join("\n");
  }
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, profile, isFirstContact, localHour } = await req.json();
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

    const systemPrompt = buildSystemPrompt(profile, !!isFirstContact, localHour);

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

    // Stream-through + heuristique mood côté serveur via tee
    const lastUser = messages[messages.length - 1]?.content ?? "";
    const [streamForClient, streamForMood] = response.body!.tee();

    // Calcul mood en arrière-plan (non bloquant pour le stream client)
    let detectedMood = "calm";
    (async () => {
      try {
        const reader = streamForMood.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") continue;
            try {
              const c = JSON.parse(j).choices?.[0]?.delta?.content;
              if (c) full += c;
            } catch {}
          }
        }
        detectedMood = inferServerMood(full, lastUser);
      } catch {}
    })();

    return new Response(streamForClient, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        // Mood "best-effort" — peut être calm si non encore calculé.
        // Le client a aussi inferMood() en fallback.
        "x-apn-mood": detectedMood,
      },
    });
  } catch (e) {
    console.error("chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function inferServerMood(reply: string, userMsg: string): string {
  const r = reply.toLowerCase();
  const u = userMsg.toLowerCase();
  if (/désolé|je comprends|courage|je suis là|navré|ça me touche|tendresse/.test(r)) return "empathetic";
  if (/triste|seul|fatigué|épuisé|déprime|j'en peux plus|mal/.test(u)) return "empathetic";
  if (/urgent|alerte|danger|risque|critique|attention/.test(r) || (r.match(/!/g)?.length ?? 0) >= 2) return "alert";
  if (reply.length > 280) return "focused";
  return "calm";
}
