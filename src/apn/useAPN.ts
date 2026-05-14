import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyMoodToRoot } from "./mood";
import { inferMood } from "./intent";
import type { AgentState, Message, Mood } from "./types";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PROFILE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-update`;

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return `Bearer ${token}`;
}

type UserProfile = {
  display_name?: string | null;
  traits?: Record<string, any>;
  last_topic?: string | null;
  open_loops?: any[];
  message_count?: number;
  last_seen?: string;
  first_seen?: string;
};

type Persona = {
  traits?: Record<string, number>;
  quirks?: string[];
  bond_level?: number;
  inside_jokes?: any[];
  stance?: string | null;
};

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

async function uploadVisionImage(userId: string, dataUrl: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!m) return null;
    const mime = m[1];
    const ext = mime.split("/")[1] ?? "jpg";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("apn-vision")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.warn("vision upload failed", error);
      return null;
    }
    return path;
  } catch (e) {
    console.warn("vision upload error", e);
    return null;
  }
}

export function useAPN() {
  const [userId, setUserId] = useState<string | null>(null);
  const sessionId = useRef<string>("");
  const profileRef = useRef<UserProfile | null>(null);
  const personaRef = useRef<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<AgentState>("standby");
  const [mood, setMood] = useState<Mood>("calm");
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>("Je suis prêt.");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  // Bind to auth user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) sessionId.current = uid;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const uid = s?.user?.id ?? null;
      setUserId(uid);
      if (uid) sessionId.current = uid;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load history + profile + persona
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setSyncStatus("loading");
      try {
        const [{ data: memData, error: memErr }, { data: profData, error: profErr }, { data: persData }] = await Promise.all([
          supabase
            .from("apn_memory")
            .select("user_msg, apn_msg, created_at, intent")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("apn_user_profile")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("apn_persona")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);
        if (memErr || profErr) throw memErr ?? profErr;

        const rows = (memData ?? []).reverse();
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

        if (profData) {
          const p = profData as UserProfile;
          profileRef.current = p;
          setProfile(p);
        }
        if (persData) {
          const pp = persData as Persona;
          personaRef.current = pp;
          setPersona(pp);
        }
        setSyncStatus("saved");
        setLastSyncAt(Date.now());
      } catch (e) {
        console.warn("load failed", e);
        setSyncStatus("error");
      }
    })();
  }, [userId]);

  const setMoodAndApply = useCallback((m: Mood) => {
    setMood(m);
    applyMoodToRoot(m);
  }, []);

  useEffect(() => { applyMoodToRoot(mood); }, [mood]);

  const persist = useCallback(async (userMsg: string, apnMsg: string, m: Mood, imagePath: string | null) => {
    if (!userId) return;
    setSyncStatus("saving");
    const { error } = await supabase.from("apn_memory").insert({
      session_id: sessionId.current,
      user_id: userId,
      user_msg: userMsg,
      apn_msg: apnMsg,
      intent: { mood: m },
      meta: imagePath ? { image_path: imagePath } : {},
    });
    if (error) {
      console.warn("persist failed", error);
      setSyncStatus("error");
    } else {
      setSyncStatus("saved");
      setLastSyncAt(Date.now());
    }
  }, [userId]);

  const updateProfileAsync = useCallback(async (userMsg: string, apnMsg: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.access_token) return;
      const recent = [
        ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg },
        { role: "assistant", content: apnMsg },
      ];
      const resp = await fetch(PROFILE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: await getAuthHeader(),
        },
        body: JSON.stringify({
          sessionId: sessionId.current,
          currentProfile: profileRef.current,
          currentPersona: personaRef.current,
          recentExchanges: recent,
        }),
      });
      if (resp.ok) {
        const j = await resp.json();
        if (j?.profile) {
          profileRef.current = j.profile;
          setProfile(j.profile);
        }
        if (j?.persona) {
          personaRef.current = j.persona;
          setPersona(j.persona);
        }
      }
    } catch (e) {
      console.warn("profile-update failed", e);
    }
  }, [messages]);

  const streamFromGateway = useCallback(
    async (
      userInput: string,
      imageDataUrl: string | undefined,
      history: Message[],
      onDelta: (chunk: string) => void,
      reality?: any,
    ) => {
      const historyMsgs = history.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const visionImage = imageDataUrl ?? reality?.ambientImageDataUrl ?? undefined;
      const isAmbient = !imageDataUrl && !!reality?.ambientImageDataUrl;
      const userContent = visionImage
        ? [
            { type: "text", text: userInput || (isAmbient ? "(regard ambiant)" : "Regarde.") },
            { type: "image_url", image_url: { url: visionImage } },
          ]
        : userInput;
      const ctxMessages = [...historyMsgs, { role: "user", content: userContent }];

      const isFirstContact = !profileRef.current && history.length === 0;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: await getAuthHeader(),
        },
        body: JSON.stringify({
          messages: ctxMessages,
          profile: profileRef.current,
          persona: personaRef.current,
          hasImage: !!visionImage,
          isAmbientGlance: isAmbient,
          isFirstContact,
          localHour: new Date().getHours(),
          reality: reality
            ? {
                now: reality.now,
                location: reality.location,
                hasAmbient: !!reality.ambientImageDataUrl,
              }
            : undefined,
        }),
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
      opts?: { imageDataUrl?: string; reality?: any },
    ) => {
      const text = input.trim();
      if (!text && !opts?.imageDataUrl && !opts?.reality?.ambientImageDataUrl) return;
      setError(null);

      const imageDataUrl = opts?.imageDataUrl;
      const reality = opts?.reality;
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text || "Regarde.",
        ts: Date.now(),
        imageDataUrl,
      };
      setMessages((p) => [...p, userMsg]);
      setState("thinking");
      setCaption(imageDataUrl ? "Je regarde…" : "Je réfléchis…");

      const uploadPromise = imageDataUrl && userId
        ? uploadVisionImage(userId, imageDataUrl)
        : Promise.resolve(null);

      try {
        let full = "";
        let started = false;
        const assistantId = crypto.randomUUID();
        await streamFromGateway(text || "Regarde.", imageDataUrl, messages, (chunk) => {
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
        }, reality);
        const m = inferMood(full);
        setMoodAndApply(m);
        setMessages((p) => p.map((mm) => (mm.id === assistantId ? { ...mm, mood: m } : mm)));
        const imagePath = await uploadPromise;
        await persist(text || "Regarde.", full, m, imagePath);
        updateProfileAsync(text || "Regarde.", full);
        hooks.onAssistantEnd?.(full, m);
      } catch (e: any) {
        const msg = e?.message ?? "Erreur inconnue";
        setError(msg);
        setState("standby");
        setCaption("Je suis prêt.");
      }
    },
    [messages, persist, setMoodAndApply, streamFromGateway, updateProfileAsync, userId],
  );

  const setStandby = useCallback(() => {
    setState("standby");
    setCaption("Je suis prêt.");
  }, []);
  const setListeningState = useCallback((on: boolean) => {
    setState(on ? "listening" : "standby");
    setCaption(on ? "Je t'écoute…" : "Je suis prêt.");
  }, []);
  const setSleeping = useCallback(() => {
    setState("sleeping");
    setCaption("…");
  }, []);
  const wake = useCallback(() => {
    setState((s) => (s === "sleeping" ? "standby" : s));
    setCaption((c) => (c === "…" ? "Je suis là." : c));
  }, []);

  return {
    sessionId: sessionId.current,
    messages, state, mood, caption, error, profile, persona,
    syncStatus, lastSyncAt,
    send, setStandby, setListeningState, setSleeping, wake,
  };
}
