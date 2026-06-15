"use client";

import { useEffect, useState } from "react";
import { createTask, listTasks } from "@/lib/engine";
import type { StoredTask } from "@/lib/store";

export default function TasksPage() {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<StoredTask["kind"]>("CHORE");
  const [priority, setPriority] = useState(3);
  const [tod, setTod] = useState<StoredTask["preferredTimeOfDay"]>("ANY");
  const [energy, setEnergy] = useState<StoredTask["energy"]>("MED");

  useEffect(() => {
    setTasks(listTasks());
  }, []);

  function add() {
    if (!title.trim()) return;
    createTask({ title, kind, priority, preferredTimeOfDay: tod, energy });
    setTitle("");
    setTasks(listTasks());
  }

  return (
    <>
      <div className="topbar">
        <h1>Tasks & chores</h1>
      </div>

      <div className="card">
        <label>What do you need to do?</label>
        <input value={title} placeholder="e.g. Vacuum the flat" onChange={(e) => setTitle(e.target.value)} />
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
            <select value={tod} onChange={(e) => setTod(e.target.value as StoredTask["preferredTimeOfDay"])}>
              <option value="ANY">Any</option>
              <option value="MORNING">Morning</option>
              <option value="MIDDAY">Midday</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Energy</label>
            <select value={energy} onChange={(e) => setEnergy(e.target.value as StoredTask["energy"])}>
              <option value="LOW">Low</option>
              <option value="MED">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>The app suggests a time estimate automatically.</span>
          <span className="spacer" />
          <button className="btn" onClick={add}>Add</button>
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
