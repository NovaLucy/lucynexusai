// Memory recall — picks the most relevant memories for the upcoming exchange.
// Lightweight scoring: tag/keyword overlap + importance + recency, no embeddings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP = new Set(["le","la","les","un","une","des","de","du","au","aux","et","ou","mais","donc","car","ni","or","est","es","sont","tu","je","il","elle","on","nous","vous","ils","elles","ce","cet","cette","ces","ma","mon","mes","ta","ton","tes","sa","son","ses","que","qui","quoi","dont","où","ne","pas","plus","y","en","à","si","sur","pour","par","avec","sans","dans","comme","aussi","très","bien","fait","faire","être","avoir","oui","non","peut","être","aujourd","hui","alors","donc","quand","dire","dis"]);

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

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

    const { query, limit = 6 } = await req.json();
    const tokens = new Set(tokenize(String(query ?? "")));

    // Pull a working set: top by importance + recent
    const { data: rows, error } = await supa
      .from("apn_memories")
      .select("id, kind, subject, content, tags, importance, created_at, last_used_at, use_count")
      .eq("user_id", user.id)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw error;

    const now = Date.now();
    const scored = (rows ?? []).map((r) => {
      const ttoks = new Set([
        ...tokenize(r.content),
        ...tokenize(r.subject ?? ""),
        ...(r.tags ?? []).map((t: string) => t.toLowerCase()),
      ]);
      let overlap = 0;
      for (const t of tokens) if (ttoks.has(t)) overlap += 1;
      const ageDays = (now - new Date(r.created_at).getTime()) / 86_400_000;
      const recency = Math.exp(-ageDays / 60);                // soft 60-day half-life
      const imp = (r.importance ?? 3) / 5;
      const baseline = imp * 0.6 + recency * 0.4;             // always-relevant floor
      const score = overlap > 0 ? overlap * 1.4 + baseline : baseline * 0.55;
      return { r, score, overlap };
    });

    scored.sort((a, b) => b.score - a.score);
    const picks = scored.slice(0, Math.max(1, Math.min(12, Number(limit) || 6)))
      .filter((s) => s.score > 0.2);

    // Mark used (best-effort)
    const ids = picks.map((p) => p.r.id);
    if (ids.length) {
      void supa.from("apn_memories")
        .update({ last_used_at: new Date().toISOString() })
        .in("id", ids);
    }

    return new Response(JSON.stringify({
      memories: picks.map((p) => ({
        kind: p.r.kind,
        subject: p.r.subject,
        content: p.r.content,
        importance: p.r.importance,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("memory-recall", e);
    return new Response(JSON.stringify({ memories: [], error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
