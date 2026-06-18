"use client";

import { useEffect, useState } from "react";
import { DayWindow, getAvailability, getSettings, saveAvailability, saveSettings, DEFAULT_MODEL } from "@/lib/model";
import { ping } from "@/lib/ai";

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [weekday, setWeekday] = useState<DayWindow[]>([]);
  const [weekend, setWeekend] = useState<DayWindow[]>([]);
  const [savedHours, setSavedHours] = useState(false);

  useEffect(() => {
    const s = getSettings();
    setKey(s.anthropicKey ?? "");
    setModel(s.model ?? DEFAULT_MODEL);
    const a = getAvailability();
    setWeekday(a.weekday); setWeekend(a.weekend);
  }, []);

  function saveKey() { saveSettings({ anthropicKey: key.trim() || undefined, model: model.trim() || DEFAULT_MODEL }); setStatus("Saved."); }
  async function test() {
    saveKey(); setBusy(true); setStatus("Testing…");
    try { const r = await ping(); setStatus(r.toLowerCase().includes("ready") ? "✓ Connected." : `Connected: ${r}`); }
    catch (e) { setStatus(`✗ ${e instanceof Error ? e.message : "Failed"}`); }
    finally { setBusy(false); }
  }
  function saveHours() { saveAvailability(weekday, weekend); setSavedHours(true); setTimeout(() => setSavedHours(false), 2500); }

  return (
    <>
      <header className="lt"><div><h1>Settings</h1></div></header>

      <div className="section-label">Your available hours</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>Claudio only schedules inside these windows — set them to your real day.</p>
        <Windows label="Weekdays (Mon–Fri)" windows={weekday} onChange={setWeekday} />
        <Windows label="Weekends (Sat–Sun)" windows={weekend} onChange={setWeekend} />
        <div className="row" style={{ marginTop: 16 }}>
          {savedHours && <span className="small" style={{ color: "var(--green)" }}>✓ Saved</span>}
          <span className="spacer" />
          <button className="btn sm" onClick={saveHours}>Save hours</button>
        </div>
      </div>

      <div className="section-label">Claudio AI</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>Powers quick capture, chore setup and goal plans. Stored only on this device; sent straight to Anthropic.</p>
        <label>Anthropic API key</label>
        <input type="password" value={key} placeholder="sk-ant-…" onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <label>Model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
        <p className="small muted">Try <code>claude-sonnet-4-6</code> or <code>claude-haiku-4-5-20251001</code>.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn grey sm" onClick={saveKey}>Save</button>
          <span className="spacer" />
          <button className="btn sm" onClick={test} disabled={busy || !key.trim()}>{busy ? "Testing…" : "Save & test"}</button>
        </div>
        {status && <p className="small" style={{ marginTop: 10 }}>{status}</p>}
      </div>

      <div className="section-label">Connections</div>
      <div className="card">
        <div className="row"><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Coach Claudio</div><div className="small muted">Your workouts appear on the right day.</div></div><span className="small" style={{ color: "var(--green)" }}>● Connected</span></div>
      </div>

      <p className="small muted center" style={{ marginTop: 8 }}>Get a key at console.anthropic.com → API Keys.</p>
    </>
  );
}

function Windows({ label, windows, onChange }: { label: string; windows: DayWindow[]; onChange: (w: DayWindow[]) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ marginBottom: 8 }}>{label}</label>
      {windows.map((w, i) => (
        <div key={i} className="row" style={{ marginBottom: 8 }}>
          <input type="time" value={w.start} onChange={(e) => onChange(windows.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} style={{ flex: 1 }} />
          <span className="muted">to</span>
          <input type="time" value={w.end} onChange={(e) => onChange(windows.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} style={{ flex: 1 }} />
          <button className="icon-btn danger" aria-label="Remove" onClick={() => onChange(windows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn plain sm" onClick={() => onChange([...windows, { start: "18:00", end: "20:00" }])}>+ Add window</button>
    </div>
  );
}
