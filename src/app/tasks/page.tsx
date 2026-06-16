"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { createTask, deleteTask, listTasks, updateTask } from "@/lib/engine";
import { configureTasks, hasApiKey } from "@/lib/ai";
import type { StoredTask } from "@/lib/store";

type Cadence = "ONE_OFF" | "DAILY" | "WEEKLY" | "MONTHLY";
const WEEKDAYS = [
  { n: 1, l: "M" }, { n: 2, l: "T" }, { n: 3, l: "W" }, { n: 4, l: "T" },
  { n: 5, l: "F" }, { n: 6, l: "S" }, { n: 7, l: "S" },
];

function recurrenceFor(c: Cadence, wd: number[]): StoredTask["recurrence"] {
  if (c === "DAILY") return { freq: "DAILY", interval: 1 };
  if (c === "WEEKLY") return { freq: "WEEKLY", interval: 1, byWeekday: wd.length ? wd : [new Date().getDay() || 7] };
  if (c === "MONTHLY") return { freq: "MONTHLY", interval: 1 };
  return undefined;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [open, setOpen] = useState(false);
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

  function blank() {
    setEditingId(null); setTitle(""); setDescription(""); setCadence("ONE_OFF");
    setByWeekday([new Date().getDay() || 7]); setKind("CHORE"); setPriority(3); setTod("ANY"); setEnergy("MED"); setNote("");
  }
  function openAdd() { blank(); setOpen(true); }
  function openEdit(t: StoredTask) {
    setEditingId(t.id); setTitle(t.title); setDescription(t.description ?? "");
    setCadence((t.recurrence?.freq as Cadence) ?? "ONE_OFF");
    setByWeekday(t.recurrence?.byWeekday ?? [new Date().getDay() || 7]);
    setKind(t.kind); setPriority(t.priority); setTod(t.preferredTimeOfDay); setEnergy(t.energy); setNote("");
    setOpen(true);
  }
  function close() { setOpen(false); }

  function save() {
    if (!title.trim()) return;
    const data = { title: title.trim(), description: description.trim() || undefined, kind, priority, preferredTimeOfDay: tod, energy, recurrence: recurrenceFor(cadence, byWeekday) };
    if (editingId) updateTask(editingId, data); else createTask(data);
    close(); refresh();
  }

  async function withClaudio() {
    const text = [title.trim(), description.trim()].filter(Boolean).join(". ");
    if (!text) return;
    if (!hasApiKey()) { setNote("Add your Anthropic key in Settings first."); return; }
    setBusy(true); setNote("Claudio is configuring this…");
    try {
      const configured = await configureTasks(text);
      for (const c of configured) {
        createTask({
          title: c.title || text.slice(0, 40),
          description: description.trim() || undefined,
          kind: c.kind, priority: c.priority, preferredTimeOfDay: c.preferredTimeOfDay, energy: c.energy, estimatedMinutes: c.estimatedMinutes,
          segments: c.segments?.map((s) => ({ ...s, requiresUserPresence: s.type !== "PASSIVE" })),
          recurrence: c.recurrence ? { freq: c.recurrence.freq, interval: 1, byWeekday: c.recurrence.byWeekday } : undefined,
          dueDate: c.dueInDays != null ? isoInDays(c.dueInDays) : undefined,
        });
      }
      close(); refresh();
    } catch (e) { setNote(`Couldn't configure: ${e instanceof Error ? e.message : "error"}`); }
    finally { setBusy(false); }
  }

  function remove(id: string) { deleteTask(id); refresh(); }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Your duties</p>
        <h1 className="display">Tasks</h1>
      </header>

      {tasks.length === 0 ? (
        <div className="empty hero">
          <div className="hero-mark">✦</div>
          <h2>Nothing on the list</h2>
          <p>Add a chore or task — or describe it in plain words and let Claudio configure the timing for you.</p>
        </div>
      ) : (
        tasks.map((t) => (
          <div key={t.id} className="item-row">
            <button className="trow-main" onClick={() => openEdit(t)} style={{ padding: 0 }}>
              <span className="title">{t.title}</span>
              <span className="tag">
                {t.kind.toLowerCase()} · P{t.priority} · {t.estimatedMinutes}m
                {t.recurrence ? ` · ${cadenceLabel(t.recurrence)}` : " · one-off"}
                {t.segments.length ? ` · ${t.segments.length} steps` : ""}
              </span>
            </button>
            <button className="icon-btn" aria-label="Edit" onClick={() => openEdit(t)}>✎</button>
            <button className="icon-btn danger" aria-label="Delete" onClick={() => remove(t.id)}>✕</button>
          </div>
        ))
      )}

      <button className="fab" onClick={openAdd}><span className="plus">+</span> Task</button>

      <Sheet open={open} onClose={close} title={editingId ? "Edit task" : "New task"}>
        <label>What needs doing?</label>
        <input value={title} placeholder="e.g. Vacuum the flat" onChange={(e) => setTitle(e.target.value)} autoFocus />

        {!editingId && (
          <>
            <label>Describe it (optional) — Claudio sets it up, incl. follow-ups</label>
            <textarea value={description} placeholder="e.g. Laundry every Saturday: run a load, dry ~90 min, then a quick fold. Also create a separate 'Fold &amp; put away' task the next day." onChange={(e) => setDescription(e.target.value)} />
          </>
        )}

        <label>How often?</label>
        <div className="chip-row">
          {(["ONE_OFF", "DAILY", "WEEKLY", "MONTHLY"] as Cadence[]).map((c) => (
            <button key={c} type="button" className={`chip ${cadence === c ? "on" : ""}`} onClick={() => setCadence(c)}>
              {c === "ONE_OFF" ? "One-off" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {cadence === "WEEKLY" && (
          <div className="chip-row" style={{ marginTop: 10 }}>
            {WEEKDAYS.map((d) => (
              <button key={d.n} type="button" className={`chip day ${byWeekday.includes(d.n) ? "on" : ""}`}
                onClick={() => setByWeekday((w) => (w.includes(d.n) ? w.filter((x) => x !== d.n) : [...w, d.n]))}>
                {d.l}
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as StoredTask["kind"])}>
              <option value="CHORE">Chore</option><option value="GENERIC">Task</option><option value="STUDY">Study</option>
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

        {note && <p className="small" style={{ marginTop: 12 }}>{note} {note.includes("Settings") && <Link href="/settings" className="link">Open Settings →</Link>}</p>}

        <div style={{ marginTop: 18 }}>
          {!editingId && (
            <>
              <button className="btn primary block" onClick={withClaudio} disabled={busy} style={{ marginBottom: 8 }}>
                {busy ? "Configuring…" : "✦ Let Claudio set it up"}
              </button>
              <p className="small muted" style={{ margin: "0 0 10px", textAlign: "center" }}>Uses your description — and can add follow-ups (e.g. fold the next day).</p>
            </>
          )}
          <button className="btn secondary block" onClick={save} disabled={busy}>{editingId ? "Save changes" : "Add manually (ignores description)"}</button>
        </div>
      </Sheet>
    </>
  );
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cadenceLabel(r: NonNullable<StoredTask["recurrence"]>): string {
  if (r.freq === "WEEKLY" && r.byWeekday?.length) {
    const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return r.byWeekday.map((d) => names[d]).join("/");
  }
  return r.freq.toLowerCase();
}
