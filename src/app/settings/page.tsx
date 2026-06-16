"use client";

import { useEffect, useState } from "react";
import { DayWindow, getAvailabilityGroups, getSettings, saveAvailabilityGroups, saveSettings } from "@/lib/engine";
import { chat } from "@/lib/ai";
import { DEFAULT_MODEL } from "@/lib/store";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [weekday, setWeekday] = useState<DayWindow[]>([]);
  const [weekend, setWeekend] = useState<DayWindow[]>([]);
  const [availSaved, setAvailSaved] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setKey(s.anthropicKey ?? "");
    setModel(s.model ?? DEFAULT_MODEL);
    const g = getAvailabilityGroups();
    setWeekday(g.weekday.length ? g.weekday : [{ start: "08:00", end: "21:00" }]);
    setWeekend(g.weekend.length ? g.weekend : [{ start: "09:00", end: "20:00" }]);
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

  function saveAvail() {
    saveAvailabilityGroups(weekday, weekend);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2500);
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Preferences</p>
        <h1 className="display">Settings</h1>
      </header>

      <section className="card">
        <h2 className="card-title">Your available hours</h2>
        <p className="muted small">When are you free for tasks? Claudio only schedules inside these windows — set them to your real day so the times make sense.</p>

        <WindowEditor label="Weekdays (Mon–Fri)" windows={weekday} onChange={setWeekday} />
        <WindowEditor label="Weekends (Sat–Sun)" windows={weekend} onChange={setWeekend} />

        <div className="row" style={{ marginTop: 16 }}>
          {availSaved && <span className="small" style={{ color: "var(--sage)" }}>✓ Saved — rebuild a day to apply</span>}
          <span className="spacer" />
          <button className="btn primary" onClick={saveAvail}>Save hours</button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Claudio AI</h2>
        <p className="muted small">
          Your Anthropic API key powers the chatbot, smart task setup and goal plans. It is stored only
          on this device (in your browser) and sent directly to Anthropic — never to any server.
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

function WindowEditor({ label, windows, onChange }: { label: string; windows: DayWindow[]; onChange: (w: DayWindow[]) => void }) {
  function set(i: number, field: "start" | "end", value: string) {
    onChange(windows.map((w, j) => (j === i ? { ...w, [field]: value } : w)));
  }
  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ marginBottom: 8 }}>{label}</label>
      {windows.map((w, i) => (
        <div key={i} className="row" style={{ marginBottom: 8, flexWrap: "nowrap" }}>
          <input type="time" value={w.start} onChange={(e) => set(i, "start", e.target.value)} style={{ flex: 1 }} />
          <span className="muted">to</span>
          <input type="time" value={w.end} onChange={(e) => set(i, "end", e.target.value)} style={{ flex: 1 }} />
          <button className="icon-btn danger" aria-label="Remove window" onClick={() => onChange(windows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn ghost tiny" onClick={() => onChange([...windows, { start: "18:00", end: "20:00" }])}>+ Add window</button>
    </div>
  );
}
