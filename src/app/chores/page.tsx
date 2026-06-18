"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { addChore, deleteChore, listChores, Chore, TimeOfDay } from "@/lib/model";
import { configureChores, hasApiKey } from "@/lib/ai";

const WEEKDAYS = [{ n: 1, l: "M" }, { n: 2, l: "T" }, { n: 3, l: "W" }, { n: 4, l: "T" }, { n: 5, l: "F" }, { n: 6, l: "S" }, { n: 7, l: "S" }];
type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

export default function ChoresPage() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [freq, setFreq] = useState<Freq>("WEEKLY");
  const [byWeekday, setByWeekday] = useState<number[]>([new Date().getDay() || 7]);
  const [tod, setTod] = useState<TimeOfDay>("ANY");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () => setChores(listChores());
  useEffect(refresh, []);

  function reset() { setTitle(""); setDescription(""); setMinutes(20); setFreq("WEEKLY"); setByWeekday([new Date().getDay() || 7]); setTod("ANY"); setNote(""); }

  function addManual() {
    if (!title.trim()) return;
    addChore({ title: title.trim(), minutes, timeOfDay: tod, energy: "LOW", cadence: { freq, byWeekday: freq === "WEEKLY" ? byWeekday : undefined } });
    reset(); setOpen(false); refresh();
  }

  async function withClaudio() {
    const text = [title.trim(), description.trim()].filter(Boolean).join(". ");
    if (!text) return;
    if (!hasApiKey()) { setNote("Add your API key in Settings to use Claudio."); return; }
    setBusy(true); setNote("Claudio is setting it up…");
    try {
      const cs = await configureChores(text);
      for (const c of cs) addChore({ title: c.title, minutes: c.minutes, timeOfDay: c.timeOfDay, energy: c.energy, cadence: c.cadence, segments: c.segments ?? undefined, automationNote: c.automationNote ?? undefined });
      reset(); setOpen(false); refresh();
    } catch (e) { setNote(`Couldn't set up: ${e instanceof Error ? e.message : "error"}`); }
    finally { setBusy(false); }
  }

  return (
    <>
      <header className="lt"><div><h1>Chores</h1><div className="sub">Recurring upkeep, scheduled across your week.</div></div></header>

      {chores.length === 0 ? (
        <div className="empty"><div className="mark">🧺</div><h2>No chores yet</h2><p>Add recurring upkeep — laundry, cleaning, bins. Describe it and Claudio handles the timing, multi-step waits, and follow-ups.</p></div>
      ) : (
        <div className="list">
          {chores.map((c) => (
            <div key={c.id} className="item">
              <span className="dot-src src-chore" style={{ width: 9, height: 9 }} />
              <div className="item-main" style={{ cursor: "default" }}>
                <div className="item-title">{c.title}</div>
                <div className="item-sub">{cadenceLabel(c)} · {c.minutes}m{c.segments?.length ? ` · ${c.segments.length} steps` : ""}{c.automationNote ? ` · ✦ ${c.automationNote}` : ""}</div>
              </div>
              <button className="icon-btn danger" aria-label="Delete" onClick={() => { deleteChore(c.id); refresh(); }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => { reset(); setOpen(true); }}>+ Chore</button>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="New chore">
        <label>What needs doing regularly?</label>
        <input value={title} placeholder="e.g. Laundry" onChange={(e) => setTitle(e.target.value)} autoFocus />
        <label>Describe it (optional) — Claudio sets up timing & follow-ups</label>
        <textarea rows={2} value={description} placeholder="e.g. Every Saturday: load, dry ~90 min, quick fold — and a separate 'fold & put away' the next day." onChange={(e) => setDescription(e.target.value)} />

        <label>How often?</label>
        <div className="pills">
          {(["DAILY", "WEEKLY", "MONTHLY"] as Freq[]).map((f) => <button key={f} className={`pill ${freq === f ? "on" : ""}`} onClick={() => setFreq(f)}>{f.charAt(0) + f.slice(1).toLowerCase()}</button>)}
        </div>
        {freq === "WEEKLY" && (
          <div className="pills" style={{ marginTop: 10 }}>
            {WEEKDAYS.map((d) => <button key={d.n} className={`pill day ${byWeekday.includes(d.n) ? "on" : ""}`} onClick={() => setByWeekday((w) => w.includes(d.n) ? w.filter((x) => x !== d.n) : [...w, d.n])}>{d.l}</button>)}
          </div>
        )}
        <div className="row" style={{ marginTop: 4 }}>
          <div style={{ flex: 1 }}><label>Minutes</label><input type="number" min={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></div>
          <div style={{ flex: 1 }}><label>Best time</label><select value={tod} onChange={(e) => setTod(e.target.value as TimeOfDay)}><option value="ANY">Any</option><option value="MORNING">Morning</option><option value="MIDDAY">Midday</option><option value="EVENING">Evening</option></select></div>
        </div>

        {note && <p className="small" style={{ marginTop: 12 }}>{note}</p>}
        <button className="btn block" style={{ marginTop: 16 }} onClick={withClaudio} disabled={busy}>{busy ? "Setting up…" : "✦ Let Claudio set it up"}</button>
        <button className="btn grey block" style={{ marginTop: 10 }} onClick={addManual} disabled={busy}>Add manually</button>
      </Sheet>
    </>
  );
}

function cadenceLabel(c: Chore): string {
  if (c.cadence.freq === "WEEKLY" && c.cadence.byWeekday?.length) {
    const n = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return c.cadence.byWeekday.map((d) => n[d]).join("/");
  }
  return c.cadence.freq.toLowerCase();
}
