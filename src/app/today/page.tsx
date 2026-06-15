"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Agenda, TimelineBlock } from "@/components/Timeline";
import { Sheet } from "@/components/Sheet";
import { approveDay, buildDay, checkIn, moveBlock, moveBlockTo, readDay } from "@/lib/engine";
import type { StoredDayPlan } from "@/lib/store";

const todayISO = () => DateTime.now().toISODate()!;

export default function TodayPage() {
  const [date, setDate] = useState(todayISO());
  const [plan, setPlan] = useState<StoredDayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [survival, setSurvival] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState<TimelineBlock | null>(null);

  const load = useCallback((d: string) => setPlan(readDay(d)), []);
  useEffect(() => load(date), [date, load]);

  const isToday = date === todayISO();
  const nowMin = isToday ? DateTime.now().hour * 60 + DateTime.now().minute : undefined;
  const blocks = (plan?.blocks ?? []) as TimelineBlock[];
  const status = plan?.status;
  const doneCount = blocks.filter((b) => b.outcome === "DONE").length;
  const actionable = blocks.filter((b) => b.kind !== "PASSIVE_WAIT").length;

  async function build(survivalMode = survival) {
    setBusy(true);
    try { setPlan(await buildDay(date, { survival: survivalMode })); }
    finally { setBusy(false); }
  }
  function shiftDay(delta: number) { setDate(DateTime.fromISO(date).plus({ days: delta }).toISODate()!); }
  function approve() { approveDay(date); load(date); }
  function complete(id: string) { checkIn(date, id, "DONE"); load(date); refreshSel(id); }
  function skip(id: string) { checkIn(date, id, "SKIPPED"); load(date); refreshSel(id); }
  function reorder(id: string, s: number) { moveBlockTo(date, id, s); load(date); }
  function nudge(id: string, d: number) { moveBlock(date, id, d); load(date); refreshSel(id); }
  function refreshSel(id: string) {
    const b = readDay(date)?.blocks.find((x) => x.id === id) as TimelineBlock | undefined;
    setSel(b ?? null);
  }

  const heading = DateTime.fromISO(date);

  return (
    <>
      <header className="today-head">
        <button className="chev" onClick={() => shiftDay(-1)} aria-label="Previous day">‹</button>
        <div className="today-date">
          <div className="eyebrow">{isToday ? "Today" : heading.toFormat("cccc")}</div>
          <div className="display sm">{heading.toFormat("d LLLL")}</div>
        </div>
        <button className="chev" onClick={() => shiftDay(1)} aria-label="Next day">›</button>
      </header>

      {blocks.length > 0 && (
        <div className="day-status">
          <span>{statusLabel(status)}</span>
          {actionable > 0 && <span className="muted">· {doneCount}/{actionable} done</span>}
          {!isToday && <button className="link" onClick={() => setDate(todayISO())}>Jump to today</button>}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="empty hero">
          <div className="hero-mark">☼</div>
          <h2>Let's shape your day</h2>
          <p>Claudio gathers your training, meals, chores and goals, then proposes a gentle, realistic schedule you can rearrange.</p>
        </div>
      ) : (
        <Agenda blocks={blocks} nowMin={nowMin} onComplete={complete} onReorder={reorder} onOpen={setSel} />
      )}

      {plan?.unscheduled?.length ? (
        <div className="didnt-fit">
          <strong>Didn't fit ({plan.unscheduled.length})</strong>
          <span className="muted small"> — {plan.unscheduled.map((u) => u.title).join(", ")}. Shorten something or bump to tomorrow.</span>
        </div>
      ) : null}

      {/* Primary action lives in the thumb zone */}
      <div className="dock">
        {blocks.length === 0 ? (
          <button className="btn primary block" onClick={() => build()} disabled={busy}>
            {busy ? "Planning…" : "Plan my day"}
          </button>
        ) : status === "APPROVED" ? (
          <>
            <span className="dock-note">Approved · enjoy your day</span>
            <button className="btn ghost icon-lg" onClick={() => setMenu(true)} aria-label="More options">⋯</button>
          </>
        ) : (
          <>
            <button className="btn primary grow" onClick={approve} disabled={busy}>Approve day</button>
            <button className="btn ghost icon-lg" onClick={() => setMenu(true)} aria-label="More options">⋯</button>
          </>
        )}
      </div>

      {/* Block actions */}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.title}>
        {sel && sel.kind !== "PASSIVE_WAIT" && (
          <>
            <div className="sub muted" style={{ marginBottom: 14 }}>{fmtRange(sel)}</div>
            <button className="btn primary block" onClick={() => complete(sel.id)}>
              {sel.outcome === "DONE" ? "✓ Done — tap to undo" : "Mark done"}
            </button>
            <button className="btn secondary block" onClick={() => skip(sel.id)} style={{ marginTop: 10 }}>
              {sel.outcome === "SKIPPED" ? "Skipped — tap to undo" : "Skip for today"}
            </button>
            <div className="reschedule">
              <span className="muted small">Reschedule</span>
              <div className="row">
                <button className="btn ghost grow" onClick={() => nudge(sel.id, -15)}>− 15 min</button>
                <button className="btn ghost grow" onClick={() => nudge(sel.id, 15)}>+ 15 min</button>
              </div>
            </div>
          </>
        )}
        {sel && sel.kind === "PASSIVE_WAIT" && (
          <p className="muted">Hands-free time — nothing to do here. It moves with its task.</p>
        )}
      </Sheet>

      {/* Overflow menu */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Day options">
        <button className="btn secondary block" onClick={() => { setMenu(false); build(); }}>↻ Reflow the day</button>
        <label className="toggle-row" style={{ marginTop: 12 }}>
          <span>
            <strong>Survival mode</strong>
            <span className="muted small block">Rough night? Show only the must-dos (meals + top priorities).</span>
          </span>
          <input type="checkbox" checked={survival} onChange={(e) => { setSurvival(e.target.checked); setMenu(false); build(e.target.checked); }} />
        </label>
      </Sheet>
    </>
  );
}

function statusLabel(s?: string): string {
  if (s === "APPROVED") return "Approved";
  if (s === "MODIFIED") return "Edited — re-approve when ready";
  return "Proposed — review & approve";
}
function fmtRange(b: TimelineBlock): string {
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${f(b.startMin)}–${f(b.endMin)}`;
}
