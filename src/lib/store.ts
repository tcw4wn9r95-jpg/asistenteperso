// On-device data store (localStorage), matching the "no backend" architecture of
// your other apps. Single user, single device. All deterministic features read
// and write here; nothing needs a server. (Multi-device sync could later commit
// this state as JSON to a repo, like training-ai/nutriprep do.)

export type TimeOfDay = "MORNING" | "MIDDAY" | "EVENING" | "ANY";
export type Energy = "LOW" | "MED" | "HIGH";

export interface StoredSegment {
  type: "ACTIVE" | "PASSIVE";
  label: string;
  minutes: number;
  requiresUserPresence: boolean;
}

export interface StoredTask {
  id: string;
  title: string;
  kind: "GENERIC" | "CHORE" | "STUDY";
  priority: number;
  estimatedMinutes: number;
  estimateSource: "USER" | "APP_SUGGESTED";
  preferredTimeOfDay: TimeOfDay;
  energy: Energy;
  dueDate?: string; // yyyy-MM-dd
  status: "PENDING" | "DONE" | "SKIPPED";
  segments: StoredSegment[];
  recurrence?: { freq: "DAILY" | "WEEKLY" | "MONTHLY"; interval: number; byWeekday?: number[] };
  planMilestoneId?: string;
  createdAt: string;
}

export interface StoredBlock {
  id: string;
  taskId?: string;
  integrationId?: string;
  title: string;
  startMin: number; // minutes from midnight (local)
  endMin: number;
  kind: "ACTIVE_WORK" | "PASSIVE_WAIT" | "INTEGRATION" | "FIXED";
  locked: boolean;
  source: "AUTO" | "USER";
}

export interface StoredDayPlan {
  date: string;
  status: "PENDING" | "APPROVED" | "MODIFIED";
  blocks: StoredBlock[];
  unscheduled: { id: string; title: string }[];
}

export interface StoredPhase {
  order: number;
  name: string;
  startDate: string;
  endDate: string;
  objectives: string[];
  focusAreas: string[];
}
export interface StoredMilestone {
  id: string;
  title: string;
  domain: "LANGUAGE_EXAM" | "FITNESS" | "GENERIC";
  targetDate: string;
  details: Record<string, unknown>;
  weeklyHoursBudget: number;
  plan?: { rationale: string; generatedByModel: string | null; phases: StoredPhase[] };
}

export interface StoredStreak {
  key: string;
  current: number;
  longest: number;
  lastCompletedDate: string | null;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
  energy?: Energy;
}

export interface AppState {
  timezone: string;
  weeklyAvailability: Record<string, AvailabilityWindow[]>;
  tasks: StoredTask[];
  milestones: StoredMilestone[];
  dayPlans: Record<string, StoredDayPlan>;
  streaks: StoredStreak[];
}

const KEY = "claudio-state-v1";

function defaultState(): AppState {
  const weekday: AvailabilityWindow[] = [
    { start: "06:30", end: "08:30", energy: "HIGH" },
    { start: "13:00", end: "15:00", energy: "MED" },
    { start: "20:30", end: "22:00", energy: "LOW" },
  ];
  const weekend: AvailabilityWindow[] = [
    { start: "08:00", end: "12:00", energy: "MED" },
    { start: "14:00", end: "18:00", energy: "MED" },
  ];
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    weeklyAvailability: { "1": weekday, "2": weekday, "3": weekday, "4": weekday, "5": weekday, "6": weekend, "7": weekend },
    tasks: [],
    milestones: [],
    dayPlans: {},
    streaks: [],
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const seeded = seedState(defaultState());
      saveState(seeded);
      return seeded;
    }
    return JSON.parse(raw) as AppState;
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function id(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// First-run sample data (a laundry chore with passive drying) so the app isn't empty.
function seedState(s: AppState): AppState {
  s.tasks.push({
    id: id("task"),
    title: "Laundry",
    kind: "CHORE",
    priority: 2,
    estimatedMinutes: 25,
    estimateSource: "APP_SUGGESTED",
    preferredTimeOfDay: "ANY",
    energy: "LOW",
    status: "PENDING",
    recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [6] },
    createdAt: new Date().toISOString(),
    segments: [
      { type: "ACTIVE", label: "load washer", minutes: 10, requiresUserPresence: true },
      { type: "PASSIVE", label: "drying", minutes: 90, requiresUserPresence: false },
      { type: "ACTIVE", label: "fold & store", minutes: 15, requiresUserPresence: true },
    ],
  });
  return s;
}
