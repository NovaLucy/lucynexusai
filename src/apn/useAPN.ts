import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyMoodToRoot } from "./mood";
import { inferMood, quickReply } from "./intent";
import type { AgentState, Message, Mood } from "./types";

const SESSION_KEY = "apn:session_id";

function getSessionId() {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function useAPN() {
  const sessionId = useRef<string>(getSessionId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<AgentState>("standby");
  const [mood, setMood] = useState<Mood>("calm");
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>("Je suis prêt.");

  // load last 5 exchanges
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("apn_memory")
        .select("user_msg, apn_msg, created_at, intent")
        .eq("session_id", sessionId.current)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) { console.warn("load memory failed", error); return; }
      const rows = (data ?? []).reverse();
      const msgs: Message[] = [];
      for (const r of rows) {
        const t = new Date(r.created_at).getTime();
        msgs.push({ id: crypto.randomUUID(), role: "user", content: r.user_msg, ts: t });
        msgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: r.apn_msg,
          ts: t + 1,
          mood: (r.intent as any)?.mood as Mood | undefined,
        });
      }
      setMessages(msgs);
    })();
  }, []);

  const setMoodAndApply = useCallback((m: Mood) => {
    setMood(m);
    applyMoodToRoot(m);
  }, []);

  useEffect(() => { applyMoodToRoot(mood); }, [mood]);

  const persist = useCallback(async (userMsg: string, apnMsg: string, m: Mood) => {
    const { error } = await supabase.from("apn_memory").insert({
      session_id: sessionId.current,
      user_msg: userMsg,
      apn_msg: apnMsg,
      intent: { mood: m },
      meta: {},
    });
    if (error) console.warn("persist failed", error);
  }, []);

  const streamFromGateway = useCallback(
    async (userInput: string, history: Message[], onDelta: (chunk: string) => void) => {
      const ctxMessages = [
        ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userInput },
      ];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: ctxMessages }),
      });

      if (!resp.ok) {
        let msg = "Erreur de la passerelle IA.";
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      if (!resp.body) throw new Error("Réponse vide");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onDelta(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      if (buf.trim()) {
        for (let raw of buf.split("\n")) {
          if (!raw || raw.startsWith(":") || !raw.startsWith("data: ")) continue;
          const json = raw.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onDelta(content);
          } catch {}
        }
      }
    },
    [],
  );

  const send = useCallback(
    async (
      input: string,
      hooks: { onAssistantStart?: () => void; onAssistantEnd?: (full: string, mood: Mood) => void },
    ) => {
      const text = input.trim();
      if (!text) return;
      setError(null);
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, ts: Date.now() };
      setMessages((p) => [...p, userMsg]);
      setState("thinking");
      setCaption("Je réfléchis…");

      // quick reply path (no LLM)
      const quick = quickReply(text);
      if (quick) {
        const m = inferMood(quick.content);
        setMoodAndApply(m);
        const assistantMsg: Message = {
          id: crypto.randomUUID(), role: "assistant", content: quick.content, mood: m, ts: Date.now(),
        };
        setMessages((p) => [...p, assistantMsg]);
        setState("speaking");
        setCaption("Je parle.");
        hooks.onAssistantStart?.();
        await persist(text, quick.content, m);
        hooks.onAssistantEnd?.(quick.content, m);
        return;
      }

      try {
        let full = "";
        let started = false;
        const assistantId = crypto.randomUUID();
        await streamFromGateway(text, messages, (chunk) => {
          full += chunk;
          if (!started) {
            started = true;
            hooks.onAssistantStart?.();
            setState("speaking");
            setCaption("Je parle.");
            setMessages((p) => [...p, { id: assistantId, role: "assistant", content: chunk, ts: Date.now() }]);
          } else {
            setMessages((p) =>
              p.map((m) => (m.id === assistantId ? { ...m, content: full } : m)),
            );
          }
        });
        const m = inferMood(full);
        setMoodAndApply(m);
        setMessages((p) => p.map((mm) => (mm.id === assistantId ? { ...mm, mood: m } : mm)));
        await persist(text, full, m);
        hooks.onAssistantEnd?.(full, m);
      } catch (e: any) {
        const msg = e?.message ?? "Erreur inconnue";
        setError(msg);
        setState("standby");
        setCaption("Je suis prêt.");
      }
    },
    [messages, persist, setMoodAndApply, streamFromGateway],
  );

  const setStandby = useCallback(() => {
    setState("standby");
    setCaption("Je suis prêt.");
  }, []);
  const setListeningState = useCallback((on: boolean) => {
    setState(on ? "listening" : "standby");
    setCaption(on ? "Je t'écoute…" : "Je suis prêt.");
  }, []);

  return {
    sessionId: sessionId.current,
    messages, state, mood, caption, error,
    send, setStandby, setListeningState,
  };
}
