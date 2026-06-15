"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { chat, hasApiKey } from "@/lib/ai";

interface Msg { role: "user" | "assistant"; text: string }
type History = Parameters<typeof chat>[0];

export default function ChatPage() {
  const [keyed, setKeyed] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Good day. I'm Claudio. Tell me what's on your plate and I'll arrange it — try \"build my day\", \"add a 20-minute call this afternoon\", or \"how are my streaks?\"." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<History>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setKeyed(hasApiKey()); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    if (!hasApiKey()) {
      setMessages((m) => [...m, { role: "assistant", text: "I'm not yet connected. Add your Anthropic API key in Settings and I'll be right with you." }]);
      return;
    }
    setBusy(true);
    try {
      const res = await chat(history.current, text);
      history.current = res.history;
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `My apologies — ${e instanceof Error ? e.message : "something went wrong"}.` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">At your service</p>
        <h1 className="display">Claudio</h1>
      </header>

      {!keyed && (
        <div className="card" style={{ borderColor: "var(--brass-soft)" }}>
          <p className="small" style={{ margin: 0 }}>
            ✦ Claudio needs your Anthropic API key to converse. <Link href="/settings" style={{ color: "var(--brass-deep)", fontWeight: 600 }}>Open Settings →</Link>
            <br />Everything else — planning, drag, approve, tasks, goals, streaks — works without it.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="who">{m.role === "user" ? "You" : "Claudio"}</div>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {busy && <div className="chat-msg assistant"><div className="who">Claudio</div><div className="bubble muted">Attending to it…</div></div>}
        <div ref={endRef} />
      </div>

      <div className="chat-bar">
        <input value={input} placeholder="Message Claudio…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} style={{ flex: 1 }} />
        <button className="btn brass" onClick={send} disabled={busy}>Send</button>
      </div>
    </>
  );
}
