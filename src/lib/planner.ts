// The week planner: turns chores, goal-steps, tasks and workouts into a
// self-healing 7-day plan. Fixed items (chores on their days, workouts) are
// placed first; flexible items (goal steps, ad-hoc tasks) are ASSIGNED to days
// and rebalanced. Undone flexible work whose day has passed rolls forward within
// its deadline — so missing a day never derails the plan.

import { DateTime } from "luxon";
import { load, save, State, Segment, TimeOfDay, Energy, DayWindow } from "./model";
import { occursOn, RecurrenceRule } from "@/server/scheduling/recurrence";
import { buildFreeWindows, WeeklyAvailability } from "@/server/scheduling/availability";
import { scheduleDay } from "@/server/scheduling/scheduler";
import { CandidateTask } from "@/server/scheduling/types";
import { fetchAllDirectives } from "@/server/integrations/registry";

export type Source = "chore" | "goal" | "task" | "workout";

export interface PlanItem {
  id: string;          // instance id (stable)
  title: string;
  source: Source;
  refId: string;       // chore/goal/task id (for streaks, edit)
  minutes: number;
  timeOfDay: TimeOfDay;
  energy: Energy;
  segments?: Segment[];
  startMin?: number;   // computed clock time within the day
  endMin?: number;
  outcome?: "DONE" | "SKIPPED";
  note?: string;
}

export interface DayPlan {
  date: string;        // yyyy-MM-dd
  weekday: number;     // 1..7
  capacityMin: number;
  usedMin: number;
  items: PlanItem[];
}

export interface Move { title: string; from: string; to: string }

export interface WeekPlan {
  days: DayPlan[];
  moves: Move[];       // self-heal summary (items rolled forward)
}

const HORIZON = 7;
const SLACK = 0.8; // try to keep days <=80% full

export function todayISO(): string { return DateTime.now().toISODate()!; }
function weekdayOf(d: string): number { return DateTime.fromISO(d).weekday; }
function windowsFor(av: State["availability"], weekday: number): DayWindow[] {
  return weekday >= 6 ? av.weekend : av.weekday;
}
function capacityMinutes(ws: DayWindow[]): number {
  return ws.reduce((sum, w) => {
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);
}
function availabilityToWeekly(av: State["availability"]): WeeklyAvailability {
  const wd = av.weekday.map((w) => ({ ...w, energy: "MED" as const }));
  const we = av.weekend.map((w) => ({ ...w, energy: "MED" as const }));
  return { "1": wd, "2": wd, "3": wd, "4": wd, "5": wd, "6": we, "7": we };
}

/** Build (or refresh) the self-healing week plan starting at `start` (today). */
export async function planWeek(start = todayISO()): Promise<WeekPlan> {
  const s = load();
  const dates = Array.from({ length: HORIZON }, (_, i) => DateTime.fromISO(start).plus({ days: i }).toISODate()!);
  const lastDate = dates[dates.length - 1];
  const cap: Record<string, number> = {};
  const perDay: Record<string, PlanItem[]> = {};
  for (const d of dates) {
    cap[d] = capacityMinutes(windowsFor(s.availability, weekdayOf(d)));
    perDay[d] = [];
  }

  const place = (d: string, item: PlanItem) => { perDay[d].push(item); cap[d] -= item.minutes; };

  // ---- Fixed: chores on their days ----
  for (const d of dates) {
    for (const c of s.chores) {
      const rule: RecurrenceRule = { freq: c.cadence.freq, interval: 1, byWeekday: c.cadence.byWeekday };
      if (!occursOn(rule, d)) continue;
      const id = `c:${c.id}:${d}`;
      place(d, { id, title: c.title, source: "chore", refId: c.id, minutes: c.minutes, timeOfDay: c.timeOfDay, energy: c.energy, segments: c.segments, outcome: s.outcomes[id], note: c.automationNote });
    }
  }

  // ---- Fixed: workouts from Coach Claudio ----
  for (const d of dates) {
    let directives: Awaited<ReturnType<typeof fetchAllDirectives>> = [];
    try { directives = await fetchAllDirectives(d, "local"); } catch { /* offline */ }
    for (const dir of directives.filter((x) => x.provider === "COACH_CLAUDIO")) {
      const id = `w:${dir.externalId}`;
      place(d, { id, title: dir.title, source: "workout", refId: dir.externalId, minutes: dir.suggestedMinutes, timeOfDay: dir.preferredTimeOfDay, energy: dir.energy, outcome: s.outcomes[id], note: String((dir.payload as { focus?: string })?.focus ?? "") });
    }
  }

  // ---- Flexible instances: goal steps + tasks ----
  const weekKey = DateTime.fromISO(start).startOf("week").toISODate();
  interface Flex { id: string; title: string; source: Source; refId: string; minutes: number; timeOfDay: TimeOfDay; energy: Energy; earliest: string; latest: string }
  const flex: Flex[] = [];

  for (const g of s.goals) {
    if (g.targetDate < start) continue; // past goals don't generate steps
    const count = Math.max(1, Math.min(7, g.daysPerWeek));
    for (let n = 0; n < count; n++) {
      flex.push({ id: `g:${g.id}:${weekKey}:${n}`, title: g.stepTitle || g.title, source: "goal", refId: g.id, minutes: g.stepMinutes, timeOfDay: g.timeOfDay, energy: g.energy, earliest: start, latest: lastDate });
    }
  }
  for (const t of s.tasks) {
    if (t.done) continue;
    flex.push({ id: `t:${t.id}`, title: t.title, source: "task", refId: t.id, minutes: t.minutes, timeOfDay: t.timeOfDay, energy: t.energy, earliest: start, latest: t.latest < start ? lastDate : t.latest });
  }

  const moves: Move[] = [];
  for (const f of flex) {
    const outcome = s.outcomes[f.id];
    const windowDates = dates.filter((d) => d >= f.earliest && d <= f.latest);
    if (windowDates.length === 0) continue;

    let assigned = s.assignments[f.id];
    if (outcome) {
      // Keep completed/skipped items where they were (if in view), don't reassign.
      const d = assigned && dates.includes(assigned) ? assigned : windowDates[0];
      place(d, flexItem(f, outcome));
      continue;
    }

    const valid = assigned && dates.includes(assigned) && assigned >= f.earliest && assigned <= f.latest && assigned >= start;
    if (valid) {
      place(assigned!, flexItem(f));
      continue;
    }
    // Needs (re)assignment — pick the emptiest day in the window (with slack).
    const target = bestDay(windowDates, cap, f.minutes);
    if (assigned && assigned < start) moves.push({ title: f.title, from: assigned, to: target });
    s.assignments[f.id] = target;
    place(target, flexItem(f));
  }

  // ---- Times within each day (reuse the intraday scheduler) ----
  const weekly = availabilityToWeekly(s.availability);
  for (const d of dates) {
    const candidates: CandidateTask[] = perDay[d]
      .filter((it) => !it.outcome)
      .map((it) => ({
        id: it.id, title: it.title, kind: it.source.toUpperCase(),
        priority: it.source === "workout" ? 2 : it.source === "task" ? 2 : 3,
        preferredTimeOfDay: it.timeOfDay, energy: it.energy,
        segments: it.segments?.length
          ? it.segments.map((g) => ({ type: g.type, label: g.label, minutes: g.minutes, requiresUserPresence: g.type !== "PASSIVE" }))
          : [{ type: "ACTIVE" as const, label: it.title, minutes: it.minutes, requiresUserPresence: true }],
      }));
    const windows = buildFreeWindows(weekly, weekdayOf(d));
    const dayEnd = windows.length ? Math.max(...windows.map((w) => w.end)) : 22 * 60;
    const res = scheduleDay(candidates, windows, { dayEnd });
    const startByTask: Record<string, number> = {};
    const endByTask: Record<string, number> = {};
    for (const b of res.blocks) {
      if (startByTask[b.taskId] === undefined || b.start < startByTask[b.taskId]) startByTask[b.taskId] = b.start;
      if (endByTask[b.taskId] === undefined || b.end > endByTask[b.taskId]) endByTask[b.taskId] = b.end;
    }
    for (const it of perDay[d]) {
      it.startMin = startByTask[it.id];
      it.endMin = endByTask[it.id];
    }
    perDay[d].sort((a, b) => (a.startMin ?? 9999) - (b.startMin ?? 9999));
  }

  s.lastPlanned = start;
  save(s);

  return {
    days: dates.map((d) => ({
      date: d, weekday: weekdayOf(d),
      capacityMin: capacityMinutes(windowsFor(s.availability, weekdayOf(d))),
      usedMin: perDay[d].reduce((sum, it) => sum + (it.outcome === "SKIPPED" ? 0 : it.minutes), 0),
      items: perDay[d],
    })),
    moves,
  };

  function flexItem(f: Flex, outcome?: "DONE" | "SKIPPED"): PlanItem {
    return { id: f.id, title: f.title, source: f.source, refId: f.refId, minutes: f.minutes, timeOfDay: f.timeOfDay, energy: f.energy, outcome: outcome ?? s.outcomes[f.id] };
  }
}

function bestDay(windowDates: string[], cap: Record<string, number>, minutes: number): string {
  // Prefer the emptiest day that still has comfortable room; else the emptiest.
  const roomy = windowDates.filter((d) => cap[d] >= minutes / SLACK);
  const pool = roomy.length ? roomy : windowDates;
  return pool.reduce((best, d) => (cap[d] > cap[best] ? d : best), pool[0]);
}

// ---- Completion + streaks ----

export function streakKeyFor(item: PlanItem): string {
  if (item.source === "goal") return `goal:${item.refId}`;
  if (item.source === "chore") return `chore:${item.refId}`;
  if (item.source === "workout") return "workouts";
  return `task:${item.refId}`;
}

export function setOutcome(item: PlanItem, date: string, outcome: "DONE" | "SKIPPED"): void {
  const s = load();
  const resolved = s.outcomes[item.id] === outcome ? undefined : outcome;
  if (resolved) s.outcomes[item.id] = resolved; else delete s.outcomes[item.id];

  if (item.source === "task") {
    const t = s.tasks.find((x) => x.id === item.refId);
    if (t) t.done = resolved === "DONE";
  }

  if (resolved) {
    const key = streakKeyFor(item);
    const st = s.streaks[key] ?? { current: 0, longest: 0, last: null };
    if (resolved === "DONE") {
      const yest = DateTime.fromISO(date).minus({ days: 1 }).toISODate();
      const cont = st.last === yest || st.last === date;
      if (st.last !== date) st.current = cont ? st.current + 1 : 1;
      st.last = date;
    } else {
      st.current = 0;
    }
    st.longest = Math.max(st.longest, st.current);
    s.streaks[key] = st;
  }
  save(s);
}

/** Move a flexible item to another day (drag/drop or "do it tomorrow"). */
export function reassign(itemId: string, date: string): void {
  const s = load();
  if (itemId.startsWith("g:") || itemId.startsWith("t:")) {
    s.assignments[itemId] = date;
    save(s);
  }
}
