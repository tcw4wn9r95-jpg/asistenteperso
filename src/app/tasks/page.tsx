"use client";

import { useEffect, useState } from "react";

interface Task {
  id: string;
  title: string;
  kind: string;
  priority: number;
  estimatedMinutes: number;
  estimateSource: string;
  preferredTimeOfDay: string;
  energy: string;
  status: string;
  recurrence?: { freq: string } | null;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("CHORE");
  const [priority, setPriority] = useState(3);
  const [tod, setTod] = useState("ANY");
  const [energy, setEnergy] = useState("MED");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/tasks");
    setTasks(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind, priority, preferredTimeOfDay: tod, energy }),
      });
      setTitle("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Tasks & chores</h1>
      </div>

      <div className="card">
        <label>What do you need to do?</label>
        <input
          value={title}
          placeholder="e.g. Vacuum the flat"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="CHORE">Chore</option>
              <option value="GENERIC">Task</option>
              <option value="STUDY">Study</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Priority</label>
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              <option value={1}>1 — top</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4 — low</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Best time</label>
            <select value={tod} onChange={(e) => setTod(e.target.value)}>
              <option value="ANY">Any</option>
              <option value="MORNING">Morning</option>
              <option value="MIDDAY">Midday</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Energy</label>
            <select value={energy} onChange={(e) => setEnergy(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MED">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            The app will suggest a time estimate automatically.
          </span>
          <span className="spacer" />
          <button className="btn" onClick={add} disabled={busy}>Add</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty">No tasks yet.</div>
      ) : (
        tasks.map((t) => (
          <div key={t.id} className="block">
            <div style={{ flex: 1 }}>
              <div className="title">{t.title}</div>
              <div className="tag">
                {t.kind.toLowerCase()} · P{t.priority} · {t.estimatedMinutes}m
                {t.estimateSource === "APP_SUGGESTED" ? " (suggested)" : ""}
                {t.recurrence ? ` · ${t.recurrence.freq.toLowerCase()}` : ""}
              </div>
            </div>
            <span className={`pill ${t.status === "DONE" ? "done" : ""}`}>{t.status.toLowerCase()}</span>
          </div>
        ))
      )}
    </>
  );
}
