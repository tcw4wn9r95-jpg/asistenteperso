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

  const load = useCallback((d: string) => setPlan(readDay(d)), []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function build() {
    setBusy(true);
    try {
      setPlan(await buildDay(date));
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
      <div className="topbar">
        <div>
          <h1>Your day</h1>
          <div className="sub">{plan ? statusLabel(plan.status) : "No plan yet"}</div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={build} disabled={busy}>
          {busy ? "Building…" : blocks.length ? "Reflow day" : "Build my day"}
        </button>
        <button className="btn secondary" onClick={approve} disabled={!blocks.length}>
          Approve
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="card empty">
          Nothing planned yet. Tap <b>Build my day</b> — Claudio pulls your training (Coach
          Claudio) and meals (NutriPrep) plus your chores and goals, then proposes a schedule
          you can drag to rearrange and approve.
        </div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Drag the ⠿ handle to move a block (snaps to 15 min). Moved blocks pin in place —
            tap <b>Reflow day</b> to rearrange everything else around them.
          </p>
          <Timeline blocks={blocks} onMove={onMove} onCheckIn={onCheckIn} />
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
