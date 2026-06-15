"use client";

import { useEffect, useState } from "react";
import { applyPlanSpecialization, createMilestoneWithPlan, deleteMilestone, getSettings, listMilestones } from "@/lib/engine";
import { hasApiKey, specializePlan } from "@/lib/ai";
import { DEFAULT_MODEL, type StoredMilestone } from "@/lib/store";

export default function MilestonesPage() {
  const [items, setItems] = useState<StoredMilestone[]>([]);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<StoredMilestone["domain"]>("LANGUAGE_EXAM");
  const [targetDate, setTargetDate] = useState("");
  const [hours, setHours] = useState(5);
  const [context, setContext] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setItems(listMilestones());
  }, []);

  async function create() {
    if (!title.trim() || !targetDate) return;
    const m = createMilestoneWithPlan({
      title, domain, targetDate, weeklyHoursBudget: hours,
      details: context.trim() ? { context: context.trim() } : {},
    });
    setItems(listMilestones());

    // Best-in-class, not generic: personalize the phase objectives with Claude.
    if (hasApiKey()) {
      setNote("Claudio is personalizing your plan…");
      try {
        const spec = await specializePlan({ ...m, details: context.trim() ? { context: context.trim() } : {} });
        applyPlanSpecialization(m.id, spec.rationale, spec.phases, getSettings().model || DEFAULT_MODEL);
        setNote("");
      } catch {
        setNote("Saved a solid expert plan (AI personalization unavailable just now).");
      }
      setItems(listMilestones());
    }
    setTitle(""); setTargetDate(""); setContext("");
  }

  function remove(id: string) {
    deleteMilestone(id);
    setItems(listMilestones());
  }

  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Working backwards from the date</p>
        <h1 className="display">Milestones</h1>
      </header>

      <div className="card">
        <label>Goal</label>
        <input value={title} placeholder="e.g. Pass B2 Spanish exam" onChange={(e) => setTitle(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value as StoredMilestone["domain"])}>
              <option value="LANGUAGE_EXAM">Language exam</option>
              <option value="FITNESS">Fitness event</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Target date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <label>Hours/week you can commit</label>
        <input type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />

        <label>Where you stand (optional) — Claudio tailors the plan to this</label>
        <textarea
          value={context}
          placeholder="e.g. Currently around B1, weakest at listening and speaking; comfortable with grammar."
          onChange={(e) => setContext(e.target.value)}
        />

        {note && <p className="small" style={{ marginTop: 10 }}>{note}</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <span className="muted small">{hasApiKey() ? "Claudio will personalize the phases." : "Add an API key in Settings for AI-personalized plans."}</span>
          <span className="spacer" />
          <button className="btn brass" onClick={create}>Create &amp; build plan</button>
        </div>
      </div>

      {items.map((m) => (
        <div key={m.id} className="card">
          <div className="row">
            <strong className="card-title" style={{ margin: 0 }}>{m.title}</strong>
            <span className="spacer" />
            <span className="pill">by {new Date(m.targetDate).toLocaleDateString()}</span>
            <button className="icon-btn" aria-label="Delete goal" onClick={() => remove(m.id)}>✕</button>
          </div>
          {m.plan ? (
            <>
              <div className="muted small" style={{ margin: "8px 0" }}>
                {m.plan.generatedByModel && <span className="pill" style={{ marginRight: 6 }}>✦ personalized</span>}
                {m.plan.rationale}
              </div>
              {m.plan.phases.map((p) => (
                <div key={p.order} className="block" style={{ display: "block" }}>
                  <div className="title">{p.order + 1}. {p.name}</div>
                  <div className="tag">
                    {new Date(p.startDate).toLocaleDateString()} → {new Date(p.endDate).toLocaleDateString()}
                  </div>
                  {p.objectives.length > 0 && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                      {p.objectives.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="muted">No plan generated.</div>
          )}
        </div>
      ))}
    </>
  );
}
