"use client";

import { useEffect, useState } from "react";

interface Phase {
  id: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  objectives: { objectives?: string[]; focusAreas?: string[] };
}
interface Milestone {
  id: string;
  title: string;
  domain: string;
  targetDate: string;
  plan?: { rationale?: string; generatedByModel?: string | null; phases: Phase[] } | null;
}

export default function MilestonesPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("LANGUAGE_EXAM");
  const [targetDate, setTargetDate] = useState("");
  const [hours, setHours] = useState(5);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/milestones");
    setItems(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function createAndPlan() {
    if (!title.trim() || !targetDate) return;
    setBusy(true);
    try {
      const created = await (
        await fetch("/api/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, domain, targetDate, weeklyHoursBudget: hours }),
        })
      ).json();
      await fetch(`/api/milestones/${created.id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyHoursBudget: hours }),
      });
      setTitle("");
      setTargetDate("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Milestones</h1>
      </div>

      <div className="card">
        <label>Goal</label>
        <input value={title} placeholder="e.g. Pass B2 Spanish exam" onChange={(e) => setTitle(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
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
        <div className="row" style={{ marginTop: 10 }}>
          <span className="spacer" />
          <button className="btn" onClick={createAndPlan} disabled={busy}>
            {busy ? "Planning…" : "Create & build plan"}
          </button>
        </div>
      </div>

      {items.map((m) => (
        <div key={m.id} className="card">
          <div className="row">
            <strong>{m.title}</strong>
            <span className="spacer" />
            <span className="pill">by {new Date(m.targetDate).toLocaleDateString()}</span>
          </div>
          {m.plan ? (
            <>
              <div className="muted" style={{ fontSize: 13, margin: "8px 0" }}>
                {m.plan.rationale}
                {m.plan.generatedByModel ? "" : " (deterministic playbook — add an API key for AI personalization)"}
              </div>
              {m.plan.phases.map((p) => (
                <div key={p.id} className="block" style={{ display: "block" }}>
                  <div className="title">
                    {p.order + 1}. {p.name}
                  </div>
                  <div className="tag">
                    {new Date(p.startDate).toLocaleDateString()} → {new Date(p.endDate).toLocaleDateString()}
                  </div>
                  {p.objectives?.objectives && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                      {p.objectives.objectives.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
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
