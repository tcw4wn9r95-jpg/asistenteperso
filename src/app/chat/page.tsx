"use client";

import { useEffect, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function ChatPage() {
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAiOn(d.aiConfigured))
      .catch(() => setAiOn(false));
  }, []);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi, I'm Claudio. Tell me what's on your plate and I'll fit it into your day. Try: \"build my day\" or \"add a 20-minute call to the afternoon\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply ?? "(no reply)" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong reaching me." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Claudio</h1>
      </div>

      {aiOn === false && (
        <div className="card" style={{ borderColor: "var(--warn)", fontSize: 13 }}>
          ⚠️ Claude is offline — set <b>ANTHROPIC_API_KEY</b> in <code>.env</code> and restart to
          enable chat. Scheduling and tasks work without it.
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
        <input
          value={input}
          placeholder="Message Claudio…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          style={{ flex: 1 }}
        />
        <button className="btn" onClick={send} disabled={busy}>Send</button>
      </div>
    </>
  );
}
