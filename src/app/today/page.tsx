"use client";

import { useCallback, useEffect, useState } from "react";
import { Timeline } from "@/components/Timeline";
import { approveDay, buildDay, checkIn, moveBlock, readDay } from "@/lib/engine";
import type { StoredDayPlan } from "@/lib/store";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TodayPage() {
  const [date, setDate] = useState(todayISO());
  const [plan, setPlan] = useState<StoredDayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [survival, setSurvival] = useState(false);

  const load = useCallback((d: string) => setPlan(readDay(d)), []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function build(survivalMode = survival) {
    setBusy(true);
    try {
      setPlan(await buildDay(date, { survival: survivalMode }));
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    approveDay(date);
    load(date);
  }
  function onMove(blockId: string, deltaMin: number) {
    moveBlock(date, blockId, deltaMin);
    load(date);
  }
  function onCheckIn(blockId: string, outcome: "DONE" | "SKIPPED") {
    checkIn(date, blockId, outcome);
    load(date);
  }

  const blocks = plan?.blocks ?? [];

  return (
    <>
      <header className="page-head">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p className="eyebrow">Your schedule</p>
            <h1 className="display">Today</h1>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
        </div>
        <div className="sub">{plan ? statusLabel(plan.status) : "No plan yet"}</div>
      </header>

      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn brass" onClick={() => build()} disabled={busy}>
          {busy ? "Building…" : blocks.length ? "Reflow day" : "Build my day"}
        </button>
        <button className="btn secondary" onClick={approve} disabled={!blocks.length || plan?.status === "APPROVED"}>
          {plan?.status === "APPROVED" ? "Approved ✓" : "Approve"}
        </button>
      </div>

      <label className="survival">
        <input
          type="checkbox"
          checked={survival}
          onChange={(e) => { setSurvival(e.target.checked); if (blocks.length) build(e.target.checked); }}
        />
        <span>Survival mode — rough night? Show only the must-dos (meals + top priorities).</span>
      </label>

      {blocks.length === 0 ? (
        <div className="card empty">
          Nothing planned yet. Tap <b>Build my day</b> — Claudio pulls your training (Coach
          Claudio) and meals (NutriPrep) plus your chores and goals, then proposes a schedule
          you can rearrange and approve.
        </div>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            Use <b>−/+</b> or drag the ⠿ handle to move a block (15-min steps). Moved blocks pin —
            tap <b>Reflow day</b> to rearrange everything else around them.
          </p>
          <Timeline
            blocks={blocks}
            approved={plan?.status === "APPROVED"}
            onMove={onMove}
            onNudge={onMove}
            onCheckIn={onCheckIn}
          />
          {plan?.unscheduled.length ? (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Didn’t fit ({plan.unscheduled.length})</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {plan.unscheduled.map((u) => u.title).join(", ")} — shorten something or bump to tomorrow.
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "PENDING": return "Proposed — review and approve";
    case "APPROVED": return "Approved ✓";
    case "MODIFIED": return "Modified — re-approve when ready";
    default: return "No plan yet";
  }
}
