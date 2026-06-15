"use client";

import { useCallback, useEffect, useState } from "react";
import { Timeline, TimelineBlock } from "@/components/Timeline";

interface DayPlan {
  dayPlanId: string;
  date: string;
  status: string;
  blocks: TimelineBlock[];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TodayPage() {
  const [date, setDate] = useState(todayISO());
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: string) => {
    const res = await fetch(`/api/schedule/${d}`);
    setPlan(await res.json());
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function syncAndGenerate() {
    setBusy(true);
    try {
      await Promise.all([
        fetch(`/api/integrations/coach_claudio/sync?date=${date}`, { method: "POST" }),
        fetch(`/api/integrations/nutriprep/sync?date=${date}`, { method: "POST" }),
      ]);
      const res = await fetch(`/api/schedule/${date}`, { method: "POST" });
      setPlan(await res.json());
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      await fetch(`/api/schedule/${date}/approve`, { method: "POST" });
      await load(date);
    } finally {
      setBusy(false);
    }
  }

  async function move(blockId: string, start: string, end: string) {
    await fetch(`/api/schedule/${date}/blocks/${blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, locked: true }),
    });
    await load(date);
  }

  async function checkIn(blockId: string, outcome: "DONE" | "SKIPPED") {
    await fetch(`/api/accountability/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleBlockId: blockId, outcome, date }),
    });
    await load(date);
  }

  const blocks = plan?.blocks ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Your day</h1>
          <div className="sub">{plan ? statusLabel(plan.status) : "Loading…"}</div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={syncAndGenerate} disabled={busy}>
          {blocks.length ? "Reflow day" : "Build my day"}
        </button>
        <button className="btn secondary" onClick={approve} disabled={busy || !blocks.length}>
          Approve
        </button>
      </div>

      {blocks.length === 0 ? (
        <div className="card empty">
          Nothing planned yet. Tap <b>Build my day</b> and Claudio will propose a schedule
          from your chores, goals, training and meals — then drag blocks to rearrange and approve.
        </div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Drag the ⠿ handle to move a block (snaps to 15 min). Moved blocks pin in place —
            tap <b>Reflow day</b> to rearrange everything else around them.
          </p>
          <Timeline blocks={blocks} onMove={move} onCheckIn={checkIn} />
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
