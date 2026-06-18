"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Sheet } from "@/components/Sheet";
import { addGoal, deleteGoal, getSettings, getStreaks, listGoals, updateGoal, DEFAULT_MODEL, Goal } from "@/lib/model";
import { generateGoalStep, hasApiKey } from "@/lib/ai";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streaks, setStreaks] = useState<Record<string, { current: number }>>({});
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () => { setGoals(listGoals()); setStreaks(getStreaks()); };
  useEffect(refresh, []);

  async function create() {
    if (!title.trim() || !targetDate) return;
    setBusy(true); setNote("");
    const g = addGoal({ title: title.trim(), description: description.trim(), targetDate, stepTitle: `Work on ${title.trim()}`, stepMinutes: 25, daysPerWeek: 4, timeOfDay: "ANY", energy: "MED" });
    refresh();
    if (hasApiKey()) {
      setNote("Claudio is designing your daily step…");
      try {
        const step = await generateGoalStep({ title: title.trim(), description: description.trim(), targetDate, hoursPerWeek: hours });
        updateGoal(g.id, { ...step, generatedByModel: getSettings().model || DEFAULT_MODEL });
        refresh();
      } catch (e) { setNote(`Couldn't tailor (${e instanceof Error ? e.message : "error"}). Kept a simple step.`); setBusy(false); return; }
    }
    setBusy(false); setOpen(false);
  }

  function remove(id: string) { deleteGoal(id); refresh(); }

  return (
    <>
      <header className="lt"><div><h1>Goals</h1><div className="sub">Small steps, every week, toward what matters.</div></div></header>

      {goals.length === 0 ? (
        <div className="empty"><div className="mark">◎</div><h2>Set a goal</h2><p>Any goal with a date — an exam, a race, a project. Claudio turns it into one small step you do most days, and weaves it into your week.</p></div>
      ) : goals.map((g) => {
        const total = Math.max(1, DateTime.fromISO(g.targetDate).diff(DateTime.fromISO(g.createdAt), "days").days);
        const elapsed = DateTime.now().diff(DateTime.fromISO(g.createdAt), "days").days;
        const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
        const daysLeft = Math.max(0, Math.ceil(DateTime.fromISO(g.targetDate).diff(DateTime.now(), "days").days));
        const streak = streaks[`goal:${g.id}`]?.current ?? 0;
        return (
          <div key={g.id} className="card">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{g.title}</div>
                <div className="small muted" style={{ marginTop: 2 }}>{daysLeft} days left · {streak > 0 ? `🔥 ${streak}` : "build a streak"}</div>
              </div>
              <button className="icon-btn danger" aria-label="Delete" onClick={() => remove(g.id)}>✕</button>
            </div>
            <div className="bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="card" style={{ background: "var(--surface-2)", boxShadow: "none", marginTop: 14, marginBottom: 0, padding: 14 }}>
              <div style={{ fontWeight: 600 }}>{g.generatedByModel && <span style={{ color: "var(--accent)", fontSize: 12, marginRight: 6 }}>✦</span>}Daily step: {g.stepTitle}</div>
              <div className="small muted" style={{ marginTop: 3 }}>{g.stepMinutes} min · {g.daysPerWeek}×/week · {g.timeOfDay.toLowerCase()}</div>
              {g.rationale && <div className="small muted" style={{ marginTop: 6 }}>{g.rationale}</div>}
            </div>
          </div>
        );
      })}

      <button className="fab" onClick={() => { setTitle(""); setDescription(""); setTargetDate(""); setHours(4); setNote(""); setOpen(true); }}>+ Goal</button>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="New goal">
        <label>What's the goal?</label>
        <input value={title} placeholder="e.g. Pass the Luxembourgish Sproochentest" onChange={(e) => setTitle(e.target.value)} autoFocus />
        <label>How should Claudio approach it? — drives the daily step</label>
        <textarea rows={3} value={description} placeholder="Specifics, constraints, where you're starting. e.g. 'Oral-only exam — comprehension + speaking, no writing. I freeze under pressure; focus on listening and mock interviews.'" onChange={(e) => setDescription(e.target.value)} />
        <div className="row">
          <div style={{ flex: 1 }}><label>Target date</label><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
          <div style={{ flex: 1 }}><label>Hours / week</label><input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></div>
        </div>
        {note && <p className="small" style={{ marginTop: 12 }}>{note}</p>}
        <button className="btn block" style={{ marginTop: 16 }} onClick={create} disabled={busy}>{busy ? "Building…" : "Create goal"}</button>
      </Sheet>
    </>
  );
}
