"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/engine";
import { chat } from "@/lib/ai";
import { DEFAULT_MODEL } from "@/lib/store";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setKey(s.anthropicKey ?? "");
    setModel(s.model ?? DEFAULT_MODEL);
  }, []);

  function save() {
    saveSettings({ anthropicKey: key.trim() || undefined, model: model.trim() || DEFAULT_MODEL });
    setStatus("Saved.");
  }

  async function test() {
    save();
    setBusy(true);
    setStatus("Testing…");
    try {
      const res = await chat([], "Reply with just the word: ready");
      setStatus(res.reply.toLowerCase().includes("ready") ? "✓ Connected — Claudio is at your service." : `Connected. Claudio said: ${res.reply}`);
    } catch (e) {
      setStatus(`✗ ${e instanceof Error ? e.message : "Connection failed"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Preferences</p>
        <h1 className="display">Settings</h1>
      </header>

      <section className="card">
        <h2 className="card-title">Claudio AI</h2>
        <p className="muted small">
          Your Anthropic API key powers the chatbot and smart task setup. It is stored only on this
          device (in your browser) and sent directly to Anthropic — never to any server.
        </p>
        <label>Anthropic API key</label>
        <input type="password" value={key} placeholder="sk-ant-…" onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <label>Model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
        <p className="muted small">
          Suggested: <code>claude-sonnet-4-6</code> (quality) or <code>claude-haiku-4-5-20251001</code> (faster, cheaper).
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={save}>Save</button>
          <span className="spacer" />
          <button className="btn" onClick={test} disabled={busy || !key.trim()}>
            {busy ? "Testing…" : "Save & test"}
          </button>
        </div>
        {status && <p className="small" style={{ marginTop: 10 }}>{status}</p>}
      </section>

      <p className="muted small" style={{ textAlign: "center" }}>
        Get a key at console.anthropic.com → API Keys.
      </p>
    </>
  );
}
