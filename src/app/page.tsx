"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { Sheet } from "@/components/Sheet";
import { planWeek, setOutcome, reassign, todayISO, WeekPlan, PlanItem, DayPlan } from "@/lib/planner";
import { addTask } from "@/lib/model";
import { hasApiKey, parseCapture } from "@/lib/ai";

export default function WeekPage() {
  const [week, setWeek] = useState<WeekPlan | null>(null);
  const [text, setText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [healShown, setHealShown] = useState(true);
  const [sel, setSel] = useState<{ item: PlanItem; date: string } | null>(null);

  const replan = useCallback(async () => setWeek(await planWeek()), []);
  useEffect(() => { replan(); }, [replan]);

  async function capture() {
    const t = text.trim();
    if (!t || capturing) return;
    setCapturing(true);
    try {
      const p = await parseCapture(t);
      addTask({ title: p.title, minutes: p.minutes, timeOfDay: p.timeOfDay, energy: p.energy, latest: DateTime.now().plus({ days: p.latestInDays }).toISODate()! });
      setText("");
      await replan();
    } finally { setCapturing(false); }
  }

  function complete(item: PlanItem, date: string, outcome: "DONE" | "SKIPPED") {
    setOutcome(item, date, outcome);
    // optimistic local update
    setWeek((w) => {
      if (!w) return w;
      const next = w.days.map((d) => d.date !== date ? d : {
        ...d,
        items: d.items.map((it) => it.id === item.id ? { ...it, outcome: it.outcome === outcome ? undefined : outcome } : it),
      });
      return { ...w, days: next };
    });
    setSel(null);
  }

  async function move(item: PlanItem, toDate: string) {
    reassign(item.id, toDate);
    setSel(null);
    await replan();
  }

  if (!week) return <div className="empty"><div className="mark">◷</div><p>Planning your week…</p></div>;

  return (
    <>
      <header className="lt">
        <div>
          <h1>This week</h1>
          <div className="sub">{progressLine(week)}</div>
        </div>
      </header>

      <div className="capture">
        <input value={text} placeholder="Add anything — I'll find a day…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()} />
        <button className="go" onClick={capture} disabled={!text.trim() || capturing} aria-label="Add">{capturing ? "·" : "+"}</button>
      </div>
      {!hasApiKey() && <p className="small muted" style={{ margin: "0 6px 10px" }}>Tip: add an API key in Settings so captures, chores and goals get smarter.</p>}

      {healShown && week.moves.length > 0 && (
        <div className="heal">
          <span>↻ Moved {week.moves.length} thing{week.moves.length > 1 ? "s" : ""} forward so you stay on track.</span>
          <button onClick={() => setHealShown(false)}>OK</button>
        </div>
      )}

      {week.days.map((day) => <DayBlock key={day.date} day={day} onOpen={(item) => setSel({ item, date: day.date })} onComplete={complete} />)}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.item.title}>
        {sel && (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>{itemSub(sel.item)} · {DateTime.fromISO(sel.date).toFormat("cccc d LLL")}</p>
            {sel.item.note && <p className="small" style={{ color: "var(--accent)" }}>✦ {sel.item.note}</p>}
            {sel.item.source !== "workout" && (
              <>
                <button className="btn block" onClick={() => complete(sel.item, sel.date, "DONE")}>{sel.item.outcome === "DONE" ? "✓ Done — undo" : "Mark done"}</button>
                <button className="btn grey block" style={{ marginTop: 10 }} onClick={() => complete(sel.item, sel.date, "SKIPPED")}>{sel.item.outcome === "SKIPPED" ? "Skipped — undo" : "Skip"}</button>
              </>
            )}
            {(sel.item.source === "goal" || sel.item.source === "task") && (
              <>
                <label style={{ marginTop: 18 }}>Do it another day</label>
                <div className="pills">
                  {week.days.map((d) => (
                    <button key={d.date} className={`pill ${d.date === sel.date ? "on" : ""}`} onClick={() => move(sel.item, d.date)}>
                      {dayLabel(d.date, true)}
                    </button>
                  ))}
                </div>
              </>
            )}
            {sel.item.source === "workout" && <p className="muted">From Coach Claudio — tracked on this day.</p>}
          </>
        )}
      </Sheet>
    </>
  );
}

function DayBlock({ day, onOpen, onComplete }: { day: DayPlan; onOpen: (i: PlanItem) => void; onComplete: (i: PlanItem, date: string, o: "DONE" | "SKIPPED") => void }) {
  const isToday = day.date === todayISO();
  return (
    <section className="day">
      <div className={`day-head ${isToday ? "today" : ""}`}>
        <span className="dow">{dayLabel(day.date)}</span>
        <span className="date">{DateTime.fromISO(day.date).toFormat("d LLL")}</span>
        {day.items.length > 0 && <span className="load">{Math.round(day.usedMin / 60 * 10) / 10}h</span>}
      </div>
      {day.items.length === 0 ? (
        <div className="day-empty">Clear — a little breathing room.</div>
      ) : (
        <div className="list">
          {day.items.map((it) => {
            const passive = false;
            const done = it.outcome === "DONE";
            return (
              <div key={it.id} className={`item ${done ? "done" : ""} ${it.outcome === "SKIPPED" ? "done" : ""}`}>
                {it.source === "workout" ? (
                  <span className="check passive" aria-hidden>★</span>
                ) : (
                  <button className="check" aria-label="Done" onClick={() => onComplete(it, day.date, "DONE")}>{done ? "✓" : ""}</button>
                )}
                <button className="item-main" onClick={() => onOpen(it)}>
                  <div className="item-title">{it.title}</div>
                  <div className="item-sub"><span className={`dot-src src-${it.source}`} />{itemSub(it)}</div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function itemSub(it: PlanItem): string {
  const time = it.startMin != null ? `${String(Math.floor(it.startMin / 60)).padStart(2, "0")}:${String(it.startMin % 60).padStart(2, "0")}` : "flexible";
  const label = it.source === "workout" ? "workout" : it.source;
  return `${time} · ${label} · ${it.minutes}m`;
}

function dayLabel(date: string, short = false): string {
  const d = DateTime.fromISO(date);
  const t = DateTime.fromISO(todayISO());
  const diff = Math.round(d.diff(t, "days").days);
  if (diff === 0) return "Today";
  if (diff === 1) return short ? "Tmrw" : "Tomorrow";
  return d.toFormat(short ? "ccc" : "cccc");
}

function progressLine(w: WeekPlan): string {
  const all = w.days.flatMap((d) => d.items).filter((i) => i.source !== "workout");
  const done = all.filter((i) => i.outcome === "DONE").length;
  if (all.length === 0) return "Nothing scheduled yet";
  return `${done} of ${all.length} done this week`;
}
