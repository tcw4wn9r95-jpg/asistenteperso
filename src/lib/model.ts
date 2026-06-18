// Data model for the rebuilt app — a "flexible momentum engine".
//
// Four sources of things-to-do: Chores (recurring upkeep), Goals (long-term,
// decomposed into small daily steps), Tasks (ad-hoc, auto-placed within a few
// days), and Workouts (pulled from Coach Claudio). Everything is stored on-device.
//
// The planner (planner.ts) turns these into a self-healing week: flexible items
// are ASSIGNED to days and rebalance when life happens. Completion is tracked per
// instance so a missed day never derails — undone flexible work simply rolls
// forward within its deadline.

export type TimeOfDay = "MORNING" | "MIDDAY" | "EVENING" | "ANY";
export type Energy = "LOW" | "MED" | "HIGH";

export interface DayWindow { start: string; end: string }
export interface Segment { type: "ACTIVE" | "PASSIVE"; label: string; minutes: number }

export interface Chore {
  id: string;
  title: string;
  minutes: number;
  timeOfDay: TimeOfDay;
  energy: Energy;
  cadence: { freq: "DAILY" | "WEEKLY" | "MONTHLY"; byWeekday?: number[] };
  segments?: Segment[];
  automationNote?: string; // human-readable note about any Claude automation
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  // The recurring "small step" toward the goal (Claude-generated).
  stepTitle: string;
  stepMinutes: number;
  daysPerWeek: number;
  timeOfDay: TimeOfDay;
  energy: Energy;
  rationale?: string;
  generatedByModel?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  minutes: number;
  timeOfDay: TimeOfDay;
  energy: Energy;
  latest: string; // deadline yyyy-MM-dd (auto-placed on/before this)
  createdAt: string;
  done?: boolean;
}

export type Outcome = "DONE" | "SKIPPED";

export interface Streak { current: number; longest: number; last: string | null }

export interface State {
  settings: { anthropicKey?: string; model?: string; remindersEnabled?: boolean };
  availability: { weekday: DayWindow[]; weekend: DayWindow[] };
  chores: Chore[];
  goals: Goal[];
  tasks: Task[];
  // Flexible instance id -> assigned date (yyyy-MM-dd). Persisted so days are stable.
  assignments: Record<string, string>;
  // Instance id -> outcome. Fixed-day instances embed the date in their id.
  outcomes: Record<string, Outcome>;
  // Streak key (goal:<id> / chore:<id>) -> streak.
  streaks: Record<string, Streak>;
  lastPlanned?: string;
}

export const DEFAULT_MODEL = "claude-sonnet-4-6";
const KEY = "claudio-v2";

function defaults(): State {
  return {
    settings: {},
    availability: {
      weekday: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "21:00" }],
      weekend: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "20:00" }],
    },
    chores: [],
    goals: [],
    tasks: [],
    assignments: {},
    outcomes: {},
    streaks: {},
  };
}

export function load(): State {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) { const s = seed(defaults()); save(s); return s; }
    return { ...defaults(), ...(JSON.parse(raw) as State) };
  } catch { return defaults(); }
}

export function save(s: State): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function uid(p = "id"): string {
  return `${p}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- CRUD + settings ----

export function getSettings() { return load().settings; }
export function saveSettings(p: Partial<State["settings"]>) { const s = load(); s.settings = { ...s.settings, ...p }; save(s); }
export function getAvailability() { return load().availability; }
export function saveAvailability(weekday: DayWindow[], weekend: DayWindow[]) {
  const s = load();
  const clean = (ws: DayWindow[]) => ws.filter((w) => w.start && w.end && w.end > w.start).sort((a, b) => a.start.localeCompare(b.start));
  s.availability = { weekday: clean(weekday), weekend: clean(weekend) };
  save(s);
}

export function listChores() { return load().chores; }
export function addChore(c: Omit<Chore, "id" | "createdAt">): Chore { const s = load(); const ch = { ...c, id: uid("chore"), createdAt: new Date().toISOString() }; s.chores.unshift(ch); save(s); return ch; }
export function updateChore(id: string, p: Partial<Chore>) { const s = load(); const c = s.chores.find((x) => x.id === id); if (c) Object.assign(c, p); save(s); }
export function deleteChore(id: string) { const s = load(); s.chores = s.chores.filter((x) => x.id !== id); save(s); }

export function listGoals() { return load().goals; }
export function addGoal(g: Omit<Goal, "id" | "createdAt">): Goal { const s = load(); const goal = { ...g, id: uid("goal"), createdAt: new Date().toISOString() }; s.goals.unshift(goal); save(s); return goal; }
export function updateGoal(id: string, p: Partial<Goal>) { const s = load(); const g = s.goals.find((x) => x.id === id); if (g) Object.assign(g, p); save(s); }
export function deleteGoal(id: string) { const s = load(); s.goals = s.goals.filter((x) => x.id !== id); save(s); }

export function listTasks() { return load().tasks; }
export function addTask(t: Omit<Task, "id" | "createdAt">): Task { const s = load(); const task = { ...t, id: uid("task"), createdAt: new Date().toISOString() }; s.tasks.unshift(task); save(s); return task; }
export function deleteTask(id: string) { const s = load(); s.tasks = s.tasks.filter((x) => x.id !== id); save(s); }

export function getStreaks() { return load().streaks; }

// A gentle first-run example so the week isn't empty.
function seed(s: State): State {
  s.chores.push({
    id: uid("chore"),
    title: "Laundry",
    minutes: 25,
    timeOfDay: "ANY",
    energy: "LOW",
    cadence: { freq: "WEEKLY", byWeekday: [6] },
    segments: [
      { type: "ACTIVE", label: "load washer", minutes: 10 },
      { type: "PASSIVE", label: "drying", minutes: 90 },
      { type: "ACTIVE", label: "fold & store", minutes: 15 },
    ],
    createdAt: new Date().toISOString(),
  });
  return s;
}
