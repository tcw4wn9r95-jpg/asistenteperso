"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { createMilestoneWithPlan, deleteMilestone, getSettings, listMilestones, replaceWithAIPlan } from "@/lib/engine";
import { generateTailoredPlan, hasApiKey } from "@/lib/ai";
import { DEFAULT_MODEL, type StoredMilestone } from "@/lib/store";

export default function MilestonesPage() {
  const [items, setItems] = useState<StoredMilestone[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [hours, setHours] = useState(5);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [regenId, setRegenId] = useState<string | null>(null);

  const refresh = () => setItems(listMilestones());
  useEffect(refresh, []);

  function openAdd() { setTitle(""); setTargetDate(""); setContext(""); setHours(5); setNote(""); setOpen(true); }

  async function create() {
    if (!title.trim() || !targetDate) return;
    setBusy(true);
    const details = context.trim() ? { context: context.trim() } : {};
    const m = createMilestoneWithPlan({ title: title.trim(), domain: "GENERIC", targetDate, weeklyHoursBudget: hours, details });
    refresh();

    if (!hasApiKey()) {
      setBusy(false); setOpen(false);
      return; // generic outline; the card prompts to add a key
    }

    setNote("Claudio is tailoring your plan…");
    try {
      const plan = await generateTailoredPlan({ title: title.trim(), domain: "GENERIC", targetDate, weeklyHours: hours, context: context.trim() });
      replaceWithAIPlan(m.id, plan, getSettings().model || DEFAULT_MODEL);
      refresh();
      setBusy(false); setOpen(false);
    } catch (e) {
      // Keep the generic outline but tell the user exactly what went wrong.
      setBusy(false);
      setNote(`Couldn't tailor: ${e instanceof Error ? e.message : "error"}. Saved a generic outline — check your key/model in Settings, then tap "Re-tailor" on the goal.`);
      refresh();
    }
  }

  function remove(id: string) { deleteMilestone(id); refresh(); }

  async function retailor(m: StoredMilestone) {
    if (!hasApiKey()) return;
    setRegenId(m.id);
    try {
      const plan = await generateTailoredPlan({
        title: m.title, domain: m.domain, targetDate: m.targetDate,
        weeklyHours: m.weeklyHoursBudget, context: String((m.details as { context?: string })?.context ?? ""),
      });
      replaceWithAIPlan(m.id, plan, getSettings().model || DEFAULT_MODEL);
      refresh();
    } catch { /* keep existing plan */ }
    finally { setRegenId(null); }
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Working back from the date</p>
        <h1 className="display">Goals</h1>
      </header>

      {items.length === 0 ? (
        <div className="empty hero">
          <div className="hero-mark">◎</div>
          <h2>Set a goal</h2>
          <p>Any goal with a deadline — an exam, a race, a side-project, a new habit. Describe how you want to approach it and Claudio plans backwards from the date and schedules the work.</p>
        </div>
      ) : (
        items.map((m) => (
          <div key={m.id} className="card">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h2 className="card-title" style={{ margin: 0 }}>{m.title}</h2>
                <div className="small muted" style={{ marginTop: 2 }}>by {new Date(m.targetDate).toLocaleDateString()}</div>
              </div>
              <button className="icon-btn danger" aria-label="Delete goal" onClick={() => remove(m.id)}>✕</button>
            </div>
            {m.plan && (
              <>
                <div className="small muted" style={{ margin: "10px 0" }}>
                  {m.plan.generatedByModel && <span className="pill done" style={{ marginRight: 6 }}>✦ personalized</span>}
                  {m.plan.rationale}
                </div>
                {hasApiKey() && (
                  <button className="btn ghost block" style={{ marginBottom: 12 }} onClick={() => retailor(m)} disabled={regenId === m.id}>
                    {regenId === m.id ? "Tailoring…" : m.plan.generatedByModel ? "↻ Re-tailor with Claudio" : "✦ Tailor to my goal with Claudio"}
                  </button>
                )}
                {m.plan.phases.map((p) => (
                  <div key={p.order} className="phase">
                    <div className="title">{p.order + 1}. {p.name}</div>
                    <div className="tag">{new Date(p.startDate).toLocaleDateString()} → {new Date(p.endDate).toLocaleDateString()}</div>
                    {p.objectives.length > 0 && <ul>{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>}
                  </div>
                ))}
              </>
            )}
          </div>
        ))
      )}

      <button className="fab" onClick={openAdd}><span className="plus">+</span> Goal</button>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="New goal">
        <label>What's the goal?</label>
        <input value={title} placeholder="e.g. Pass the Luxembourgish Sproochentest" onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label>How should Claudio approach it? — this drives the whole plan</label>
        <textarea
          rows={4}
          value={context}
          placeholder="Describe the goal, any specifics or constraints, where you're starting from, and how you'd like to prepare. e.g. 'The Sproochentest is oral only — comprehension + speaking, no writing or reading. I'm conversational but freeze under pressure. Focus on listening and mock oral interviews.'"
          onChange={(e) => setContext(e.target.value)}
        />

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Target date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Hours / week</label>
            <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
        </div>

        {note && <p className="small" style={{ marginTop: 12 }}>{note}</p>}
        <p className="small muted" style={{ marginTop: 12 }}>{hasApiKey() ? "Claudio will build a plan tailored to exactly what you wrote." : "Add an API key in Settings so Claudio can tailor the plan — otherwise you'll get a generic outline."}</p>
        <button className="btn primary block" style={{ marginTop: 8 }} onClick={create} disabled={busy}>{busy ? "Building…" : "Create & build plan"}</button>
      </Sheet>
    </>
  );
}
