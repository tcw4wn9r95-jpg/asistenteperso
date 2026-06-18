"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { Sheet } from "@/components/Sheet";
import { planWeek, setOutcome, reassign, todayISO, WeekPlan, PlanItem } from "@/lib/planner";
import { addTask } from "@/lib/model";
import { hasApiKey, parseCapture } from "@/lib/ai";
import { fireDueNudges, nextUp, NextUp } from "@/lib/nudges";

export default function WeekPage() {
  const [week, setWeek] = useState<WeekPlan | null>(null);
  const [text, setText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [healShown, setHealShown] = useState(true);
  const [sel, setSel] = useState<{ item: PlanItem; date: string } | null>(null);
  const [up, setUp] = useState<NextUp | null>(null);

  const dayEls = useRef(new Map<string, HTMLElement>());
  const rects = useRef<{ date: string; top: number; bottom: number }[]>([]);
  const [drag, setDrag] = useState<{ item: PlanItem; from: string; y: number; over: string | null } | null>(null);

  const replan = useCallback(async () => {
    const w = await planWeek();
    setWeek(w);
    setUp(nextUp(w));
  }, []);
  useEffect(() => { replan(); }, [replan]);

  // Nudge timer: fire due notifications + refresh "up next" every 30s.
  useEffect(() => {
    if (!week) return;
    const tick = () => { fireDueNudges(week); setUp(nextUp(week)); };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [week]);

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
    setWeek((w) => w && { ...w, days: w.days.map((d) => d.date !== date ? d : { ...d, items: d.items.map((it) => it.id === item.id ? { ...it, outcome: it.outcome === outcome ? undefined : outcome } : it) }) });
    setSel(null);
  }
  async function move(item: PlanItem, toDate: string) { reassign(item.id, toDate); setSel(null); await replan(); }

  // ---- cross-day drag ----
  function dragStart(e: React.PointerEvent, item: PlanItem, from: string) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    rects.current = [...dayEls.current.entries()].map(([date, el]) => { const r = el.getBoundingClientRect(); return { date, top: r.top, bottom: r.bottom }; });
    setDrag({ item, from, y: e.clientY, over: from });
  }
  function dragMove(e: React.PointerEvent) {
    if (!drag) return;
    const hit = rects.current.find((r) => e.clientY >= r.top && e.clientY <= r.bottom);
    setDrag({ ...drag, y: e.clientY, over: hit?.date ?? drag.over });
  }
  async function dragEnd() {
    if (!drag) return;
    const { item, from, over } = drag;
    setDrag(null);
    if (over && over !== from) { reassign(item.id, over); await replan(); }
  }

  if (!week) return <div className="empty"><div className="mark">◷</div><p>Planning your week…</p></div>;

  return (
    <>
      <header className="lt"><div><h1>This week</h1><div className="sub">{progressLine(week)}</div></div></header>

      <div className="capture">
        <input value={text} placeholder="Add anything — I'll find a day…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()} />
        <button className="go" onClick={capture} disabled={!text.trim() || capturing} aria-label="Add">{capturing ? "·" : "+"}</button>
      </div>
      {!hasApiKey() && <p className="small muted" style={{ margin: "0 6px 10px" }}>Tip: add an API key in Settings so captures, chores and goals get smarter.</p>}

      {up && (
        <button className="upnext" onClick={() => setSel({ item: up.item, date: todayISO() })}>
          <span className="upnext-dot" />
          <span><b>{up.when === "now" ? "Now" : "Up next"}</b> · {up.item.title}</span>
          <span className="upnext-time">{up.item.startMin != null ? fmt(up.item.startMin) : ""}</span>
        </button>
      )}

      {healShown && week.moves.length > 0 && (
        <div className="heal"><span>↻ Moved {week.moves.length} thing{week.moves.length > 1 ? "s" : ""} forward so you stay on track.</span><button onClick={() => setHealShown(false)}>OK</button></div>
      )}

      {week.days.map((day) => {
        const isToday = day.date === todayISO();
        const over = drag?.over === day.date && drag.from !== day.date;
        return (
          <section key={day.date} className={`day ${over ? "drop-over" : ""}`} ref={(el) => { if (el) dayEls.current.set(day.date, el); else dayEls.current.delete(day.date); }}>
            <div className={`day-head ${isToday ? "today" : ""}`}>
              <span className="dow">{dayLabel(day.date)}</span>
              <span className="date">{DateTime.fromISO(day.date).toFormat("d LLL")}</span>
              {day.items.length > 0 && <span className="load">{Math.round(day.usedMin / 60 * 10) / 10}h</span>}
            </div>
            {day.items.length === 0 ? (
              <div className="day-empty">{over ? "Drop here" : "Clear — a little breathing room."}</div>
            ) : (
              <div className="list">
                {day.items.map((it) => {
                  const done = it.outcome === "DONE", skipped = it.outcome === "SKIPPED";
                  const draggable = it.source === "goal" || it.source === "task";
                  return (
                    <div key={it.id} className={`item ${done || skipped ? "done" : ""} ${drag?.item.id === it.id ? "dragging" : ""}`}>
                      {it.source === "workout" ? <span className="check passive" aria-hidden>★</span> : <button className="check" aria-label="Done" onClick={() => complete(it, day.date, "DONE")}>{done ? "✓" : ""}</button>}
                      <button className="item-main" onClick={() => setSel({ item: it, date: day.date })}>
                        <div className="item-title">{it.title}</div>
                        <div className="item-sub"><span className={`dot-src src-${it.source}`} />{itemSub(it)}</div>
                      </button>
                      {draggable && <span className="handle" onPointerDown={(e) => dragStart(e, it, day.date)} onPointerMove={dragMove} onPointerUp={dragEnd} aria-label="Drag to another day">⠿</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {drag && <div className="drag-ghost" style={{ top: drag.y - 22 }}>{drag.item.title}</div>}

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
                <div className="pills">{week.days.map((d) => <button key={d.date} className={`pill ${d.date === sel.date ? "on" : ""}`} onClick={() => move(sel.item, d.date)}>{dayLabel(d.date, true)}</button>)}</div>
              </>
            )}
            {sel.item.source === "workout" && <p className="muted">From Coach Claudio — tracked on this day.</p>}
          </>
        )}
      </Sheet>
    </>
  );
}

function itemSub(it: PlanItem): string {
  const time = it.startMin != null ? fmt(it.startMin) : "flexible";
  return `${time} · ${it.source === "workout" ? "workout" : it.source} · ${it.minutes}m`;
}
function fmt(min: number): string { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }
function dayLabel(date: string, short = false): string {
  const diff = Math.round(DateTime.fromISO(date).diff(DateTime.fromISO(todayISO()), "days").days);
  if (diff === 0) return "Today";
  if (diff === 1) return short ? "Tmrw" : "Tomorrow";
  return DateTime.fromISO(date).toFormat(short ? "ccc" : "cccc");
}
function progressLine(w: WeekPlan): string {
  const all = w.days.flatMap((d) => d.items).filter((i) => i.source !== "workout");
  const done = all.filter((i) => i.outcome === "DONE").length;
  return all.length === 0 ? "Nothing scheduled yet" : `${done} of ${all.length} done this week`;
}
