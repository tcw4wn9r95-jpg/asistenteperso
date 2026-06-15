"use client";

import { useCallback, useEffect, useState } from "react";

interface Block {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: string;
  locked: boolean;
  source: string;
}
interface DayPlan {
  dayPlanId: string;
  date: string;
  status: string;
  blocks: Block[];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
      // Pull today's training + food directives, then build the day.
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
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "auto" }}
        />
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
          from your chores, goals, training and meals — then you approve or rearrange it.
        </div>
      ) : (
        <div>
          {blocks.map((b) => (
            <div key={b.id} className={`block ${blockClass(b.kind)}`}>
              <span className="time">
                {fmt(b.start)}–{fmt(b.end)}
              </span>
              <div style={{ flex: 1 }}>
                <div className="title">{b.title}</div>
                <div className="tag">{kindLabel(b.kind)}{b.locked ? " · pinned" : ""}</div>
              </div>
              {b.kind !== "PASSIVE_WAIT" && (
                <div className="row">
                  <button className="btn ghost" onClick={() => checkIn(b.id, "DONE")}>Done</button>
                  <button className="btn ghost" onClick={() => checkIn(b.id, "SKIPPED")}>Skip</button>
                </div>
              )}
            </div>
          ))}
        </div>
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
function blockClass(kind: string): string {
  if (kind === "PASSIVE_WAIT") return "passive";
  if (kind === "INTEGRATION") return "integration";
  return "";
}
function kindLabel(kind: string): string {
  switch (kind) {
    case "PASSIVE_WAIT": return "Hands-free wait";
    case "INTEGRATION": return "From your apps";
    case "ACTIVE_WORK": return "Focus";
    case "FIXED": return "Fixed";
    default: return kind;
  }
}
