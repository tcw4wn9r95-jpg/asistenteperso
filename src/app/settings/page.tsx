"use client";

import { useEffect, useState } from "react";
import { DayWindow, getAvailability, getSettings, saveAvailability, saveSettings, DEFAULT_MODEL } from "@/lib/model";
import { ping } from "@/lib/ai";
import { requestNotificationPermission } from "@/lib/nudges";
import { disablePush, enablePush, testPush } from "@/lib/push";
import { planWeek } from "@/lib/planner";

const LEADS = [
  { min: 0, label: "At time" },
  { min: 5, label: "5 min" },
  { min: 10, label: "10 min" },
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 hr" },
];

export default function SettingsPage() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [weekday, setWeekday] = useState<DayWindow[]>([]);
  const [weekend, setWeekend] = useState<DayWindow[]>([]);
  const [savedHours, setSavedHours] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [remNote, setRemNote] = useState("");
  const [leadMin, setLeadMin] = useState(0);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [push, setPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState("");

  useEffect(() => {
    const s = getSettings();
    setKey(s.anthropicKey ?? "");
    setModel(s.model ?? DEFAULT_MODEL);
    setReminders(Boolean(s.remindersEnabled));
    setLeadMin(s.notifyLeadMin ?? 0);
    setQuietStart(s.quietStart ?? "");
    setQuietEnd(s.quietEnd ?? "");
    setPushUrl(s.pushUrl ?? "");
    setPush(Boolean(s.pushEnabled));
    const a = getAvailability();
    setWeekday(a.weekday); setWeekend(a.weekend);
  }, []);

  async function togglePush(on: boolean) {
    if (!on) { await disablePush(); setPush(false); setPushNote(""); return; }
    if (!pushUrl.trim()) { setPushNote("Add the reminder service URL first."); return; }
    saveSettings({ pushUrl: pushUrl.trim() });
    setPushBusy(true); setPushNote("Subscribing…");
    try {
      const week = await planWeek();
      await enablePush(week);
      setPush(true); setPushNote("✓ On. Reminders will arrive even when the app is closed.");
    } catch (e) { setPush(false); setPushNote(`✗ ${e instanceof Error ? e.message : "Failed"}`); }
    finally { setPushBusy(false); }
  }
  async function doTestPush() {
    setPushBusy(true); setPushNote("Sending a test…");
    try { await testPush(); setPushNote("Sent — it should appear shortly."); }
    catch (e) { setPushNote(`✗ ${e instanceof Error ? e.message : "Failed"}`); }
    finally { setPushBusy(false); }
  }

  // Save notification timing, then re-upload the schedule so closed-app push
  // reflects the new lead time / quiet hours immediately.
  async function saveTiming(p: { notifyLeadMin?: number; quietStart?: string; quietEnd?: string }) {
    saveSettings(p);
    try { const { syncSchedule } = await import("@/lib/push"); await syncSchedule(await planWeek()); } catch { /* best effort */ }
  }
  function chooseLead(min: number) { setLeadMin(min); void saveTiming({ notifyLeadMin: min }); }
  function changeQuiet(start: string, end: string) {
    setQuietStart(start); setQuietEnd(end);
    void saveTiming({ quietStart: start || undefined, quietEnd: end || undefined });
  }

  async function toggleReminders(on: boolean) {
    if (on) {
      const granted = await requestNotificationPermission();
      if (!granted) { setRemNote("Notifications are blocked — enable them for this site in your browser/OS settings."); setReminders(false); saveSettings({ remindersEnabled: false }); return; }
      setRemNote("On. You'll be nudged at an item's time while the app is open.");
    } else { setRemNote(""); }
    setReminders(on);
    saveSettings({ remindersEnabled: on });
  }

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

      <div className="section-label">Reminders</div>
      <div className="card">
        <div className="row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Nudge me at the time</div>
            <div className="small muted">A live “Up next” on your Week, plus a notification when an item’s time arrives (while the app is open).</div>
          </div>
          <input type="checkbox" className="switch" checked={reminders} onChange={(e) => toggleReminders(e.target.checked)} />
        </div>
        {remNote && <p className="small" style={{ marginTop: 10 }}>{remNote}</p>}

        <div className="divider" />
        <div style={{ fontWeight: 600 }}>When should they fire?</div>
        <div className="small muted" style={{ marginBottom: 10 }}>Applies to both in-app nudges and closed-app reminders.</div>
        <label style={{ marginTop: 0 }}>Lead time</label>
        <div className="pills">
          {LEADS.map((l) => (
            <button key={l.min} className={`pill ${leadMin === l.min ? "on" : ""}`} onClick={() => chooseLead(l.min)}>{l.label}</button>
          ))}
        </div>
        <label style={{ marginTop: 16 }}>Quiet hours (no reminders)</label>
        <div className="row">
          <input type="time" value={quietStart} onChange={(e) => changeQuiet(e.target.value, quietEnd)} style={{ flex: 1 }} aria-label="Quiet from" />
          <span className="muted">to</span>
          <input type="time" value={quietEnd} onChange={(e) => changeQuiet(quietStart, e.target.value)} style={{ flex: 1 }} aria-label="Quiet until" />
          {(quietStart || quietEnd) && <button className="icon-btn danger" aria-label="Clear quiet hours" onClick={() => changeQuiet("", "")}>✕</button>}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Leave empty for none. Overnight windows (e.g. 22:00 → 07:00) are supported.</p>
      </div>

      <div className="card" style={{ marginTop: -2 }}>
        <div style={{ fontWeight: 600 }}>…even when the app is closed</div>
        <p className="small muted" style={{ marginTop: 4 }}>Connect the free reminder service (one-time setup — see <code>server-push/README.md</code>) and paste its URL below. On iPhone, first add Claudio to your Home Screen.</p>
        <label>Reminder service URL</label>
        <input value={pushUrl} placeholder="https://claudio-push.<you>.workers.dev" onChange={(e) => setPushUrl(e.target.value)} onBlur={() => saveSettings({ pushUrl: pushUrl.trim() || undefined })} autoComplete="off" />
        <div className="row" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Closed-app reminders</div><div className="small muted">{push ? "On" : "Off"}</div></div>
          {pushBusy ? <span className="small muted">working…</span> : <input type="checkbox" className="switch" checked={push} onChange={(e) => togglePush(e.target.checked)} />}
        </div>
        {push && <button className="btn grey sm" style={{ marginTop: 12 }} onClick={doTestPush} disabled={pushBusy}>Send test notification</button>}
        {pushNote && <p className="small" style={{ marginTop: 10 }}>{pushNote}</p>}
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
