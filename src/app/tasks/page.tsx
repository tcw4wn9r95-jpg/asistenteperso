"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createTask, deleteTask, listTasks, updateTask } from "@/lib/engine";
import { configureTask, hasApiKey } from "@/lib/ai";
import type { StoredTask } from "@/lib/store";

type Cadence = "ONE_OFF" | "DAILY" | "WEEKLY" | "MONTHLY";
const WEEKDAYS = [
  { n: 1, l: "M" }, { n: 2, l: "T" }, { n: 3, l: "W" }, { n: 4, l: "T" },
  { n: 5, l: "F" }, { n: 6, l: "S" }, { n: 7, l: "S" },
];

function recurrenceFor(cadence: Cadence, byWeekday: number[]): StoredTask["recurrence"] {
  switch (cadence) {
    case "DAILY": return { freq: "DAILY", interval: 1 };
    case "WEEKLY": return { freq: "WEEKLY", interval: 1, byWeekday: byWeekday.length ? byWeekday : [new Date().getDay() || 7] };
    case "MONTHLY": return { freq: "MONTHLY", interval: 1 };
    default: return undefined;
  }
}
function cadenceOf(t: StoredTask): Cadence {
  return (t.recurrence?.freq as Cadence) ?? "ONE_OFF";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Cadence>("ONE_OFF");
  const [byWeekday, setByWeekday] = useState<number[]>([new Date().getDay() || 7]);
  const [kind, setKind] = useState<StoredTask["kind"]>("CHORE");
  const [priority, setPriority] = useState(3);
  const [tod, setTod] = useState<StoredTask["preferredTimeOfDay"]>("ANY");
  const [energy, setEnergy] = useState<StoredTask["energy"]>("MED");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () => setTasks(listTasks());
  useEffect(refresh, []);

  function reset() {
    setEditingId(null);
    setTitle(""); setDescription(""); setCadence("ONE_OFF"); setNote("");
    setKind("CHORE"); setPriority(3); setTod("ANY"); setEnergy("MED");
    setByWeekday([new Date().getDay() || 7]);
  }

  function startEdit(t: StoredTask) {
    setEditingId(t.id);
    setTitle(t.title);
    setDescription(t.description ?? "");
    setCadence(cadenceOf(t));
    setByWeekday(t.recurrence?.byWeekday ?? [new Date().getDay() || 7]);
    setKind(t.kind); setPriority(t.priority); setTod(t.preferredTimeOfDay); setEnergy(t.energy);
    setNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveEdit() {
    if (!editingId || !title.trim()) return;
    updateTask(editingId, {
      title: title.trim(),
      description: description.trim() || undefined,
      kind, priority, preferredTimeOfDay: tod, energy,
      recurrence: recurrenceFor(cadence, byWeekday),
    });
    reset(); refresh();
  }

  function addManual() {
    if (!title.trim()) return;
    createTask({
      title: title.trim(),
      description: description.trim() || undefined,
      kind, priority, preferredTimeOfDay: tod, energy,
      recurrence: recurrenceFor(cadence, byWeekday),
    });
    reset(); refresh();
  }

  async function addWithClaudio() {
    const text = description.trim() || title.trim();
    if (!text) return;
    if (!hasApiKey()) { setNote("Add your Anthropic key in Settings to let Claudio configure tasks."); return; }
    setBusy(true); setNote("Claudio is configuring this…");
    try {
      const c = await configureTask(text);
      createTask({
        title: c.title || title.trim() || text.slice(0, 40),
        description: description.trim() || undefined,
        kind: c.kind, priority: c.priority, preferredTimeOfDay: c.preferredTimeOfDay,
        energy: c.energy, estimatedMinutes: c.estimatedMinutes,
        segments: c.segments?.map((s) => ({ ...s, requiresUserPresence: s.type !== "PASSIVE" })),
        recurrence: c.recurrence ? { freq: c.recurrence.freq, interval: 1, byWeekday: c.recurrence.byWeekday } : undefined,
      });
      reset(); refresh();
    } catch (e) {
      setNote(`Couldn't configure: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  function remove(taskId: string) {
    if (editingId === taskId) reset();
    deleteTask(taskId);
    refresh();
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Your duties</p>
        <h1 className="display">Tasks &amp; chores</h1>
      </header>

      <div className="card">
        {editingId && <p className="eyebrow" style={{ marginBottom: 8 }}>Editing task</p>}
        <label>What needs doing?</label>
        <input value={title} placeholder="e.g. Vacuum the flat" onChange={(e) => setTitle(e.target.value)} />

        {!editingId && (
          <>
            <label>Describe it (optional) — Claudio will set it up for you</label>
            <textarea
              value={description}
              placeholder="e.g. Run a load of laundry, hang to dry for about 90 min, then fold and put away. Weekly on Saturdays."
              onChange={(e) => setDescription(e.target.value)}
            />
          </>
        )}

        <label>Cadence</label>
        <div className="row">
          {(["ONE_OFF", "DAILY", "WEEKLY", "MONTHLY"] as Cadence[]).map((c) => (
            <button key={c} className={`btn tiny ${cadence === c ? "brass" : "ghost"}`} onClick={() => setCadence(c)} type="button">
              {c === "ONE_OFF" ? "One-off" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {cadence === "WEEKLY" && (
          <div className="row" style={{ marginTop: 10 }}>
            {WEEKDAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                className="icon-btn"
                style={byWeekday.includes(d.n) ? { background: "var(--brass)", color: "#fbf6ea", borderColor: "var(--brass)" } : {}}
                onClick={() => setByWeekday((w) => (w.includes(d.n) ? w.filter((x) => x !== d.n) : [...w, d.n]))}
              >
                {d.l}
              </button>
            ))}
          </div>
        )}

        <details style={{ marginTop: 14 }} open={!!editingId}>
          <summary className="muted small" style={{ cursor: "pointer" }}>Details (type, priority, time, energy)</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as StoredTask["kind"])}>
                <option value="CHORE">Chore</option>
                <option value="GENERIC">Task</option>
                <option value="STUDY">Study</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                <option value={1}>1 — top</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4 — low</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Best time</label>
              <select value={tod} onChange={(e) => setTod(e.target.value as StoredTask["preferredTimeOfDay"])}>
                <option value="ANY">Any</option><option value="MORNING">Morning</option><option value="MIDDAY">Midday</option><option value="EVENING">Evening</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Energy</label>
              <select value={energy} onChange={(e) => setEnergy(e.target.value as StoredTask["energy"])}>
                <option value="LOW">Low</option><option value="MED">Medium</option><option value="HIGH">High</option>
              </select>
            </div>
          </div>
        </details>

        {note && <p className="small" style={{ marginTop: 10 }}>{note} {note.includes("Settings") && <Link href="/settings" style={{ color: "var(--brass-deep)", fontWeight: 600 }}>Open Settings →</Link>}</p>}

        <div className="row" style={{ marginTop: 14 }}>
          {editingId ? (
            <>
              <button className="btn ghost" onClick={reset} type="button">Cancel</button>
              <span className="spacer" />
              <button className="btn brass" onClick={saveEdit} type="button">Save changes</button>
            </>
          ) : (
            <>
              <button className="btn brass" onClick={addWithClaudio} disabled={busy} type="button">✦ Let Claudio set it up</button>
              <span className="spacer" />
              <button className="btn secondary" onClick={addManual} disabled={busy} type="button">Add manually</button>
            </>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">No tasks yet. Add one above — or describe it and let Claudio do the rest.</div>
      ) : (
        tasks.map((t) => (
          <div key={t.id} className={`block ${editingId === t.id ? "editing" : ""}`}>
            <div style={{ flex: 1 }}>
              <div className="title">{t.title}</div>
              <div className="tag">
                {t.kind.toLowerCase()} · P{t.priority} · {t.estimatedMinutes}m
                {t.estimateSource === "APP_SUGGESTED" ? " (suggested)" : ""}
                {t.recurrence ? ` · ${cadenceLabel(t.recurrence)}` : " · one-off"}
                {t.segments.length ? ` · ${t.segments.length} steps` : ""}
              </div>
            </div>
            <button className="icon-btn" aria-label="Edit task" onClick={() => startEdit(t)}>✎</button>
            <button className="icon-btn" aria-label="Delete task" onClick={() => remove(t.id)}>✕</button>
          </div>
        ))
      )}
    </>
  );
}

function cadenceLabel(r: NonNullable<StoredTask["recurrence"]>): string {
  if (r.freq === "WEEKLY" && r.byWeekday?.length) {
    const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return r.byWeekday.map((d) => names[d]).join("/");
  }
  return r.freq.toLowerCase();
}
