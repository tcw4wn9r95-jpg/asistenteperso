"use client";

import { useState } from "react";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// In the static build there's no server, so Claudio's AI lives behind an external
// endpoint (a small serverless function or an Action-backed proxy) that holds the
// Claude key. Set NEXT_PUBLIC_CHAT_ENDPOINT to enable it.
const ENDPOINT = process.env.NEXT_PUBLIC_CHAT_ENDPOINT || "";

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi, I'm Claudio. I can help you reason about your day and plans. (Live chat needs the AI endpoint configured — your schedule, tasks, goals and streaks all work without it.)",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    if (!ENDPOINT) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Claudio's AI endpoint isn't configured yet (set NEXT_PUBLIC_CHAT_ENDPOINT). Everything else in the app works offline." },
      ]);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? "(no reply)" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Couldn't reach Claudio's AI endpoint." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Claudio</h1>
      </div>

      {!ENDPOINT && (
        <div className="card" style={{ borderColor: "var(--warn)", fontSize: 13 }}>
          ⚠️ AI chat is offline. Deterministic planning, drag, approve, tasks, goals and streaks
          all work without it. Wire <b>NEXT_PUBLIC_CHAT_ENDPOINT</b> to a Claude-backed endpoint to enable chat.
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="who">{m.role === "user" ? "You" : "Claudio"}</div>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {busy && <div className="muted">Claudio is thinking…</div>}
      </div>

      <div className="row">
        <input value={input} placeholder="Message Claudio…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} style={{ flex: 1 }} />
        <button className="btn" onClick={send} disabled={busy}>Send</button>
      </div>
    </>
  );
}
