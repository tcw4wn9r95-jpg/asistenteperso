// Pure, DB-free types for the scheduling engine. Times within a day are
// expressed as integer minutes from local midnight (0..1440) so the core logic
// is trivially unit-testable. The DB layer maps Prisma rows to/from these.

export type TimeOfDay = "MORNING" | "MIDDAY" | "EVENING" | "ANY";
export type Energy = "LOW" | "MED" | "HIGH";
export type SegmentType = "ACTIVE" | "PASSIVE";
export type BlockKind = "ACTIVE_WORK" | "PASSIVE_WAIT" | "FIXED" | "INTEGRATION";

export interface FreeWindow {
  start: number; // minutes from midnight
  end: number;
  energy: Energy;
}

export interface CandidateSegment {
  type: SegmentType;
  label: string;
  minutes: number;
  // Passive segments still occupy clock time but free the user, so other work
  // can be scheduled during them.
  requiresUserPresence: boolean;
}

export interface CandidateTask {
  id: string;
  title: string;
  kind: string;
  priority: number; // 1 (highest) .. 4 (lowest)
  preferredTimeOfDay: TimeOfDay;
  energy: Energy;
  /** Whole-number days until the task is due; undefined if no deadline. */
  daysUntilDue?: number;
  segments: CandidateSegment[];
  /** Source ids carried through to the emitted blocks. */
  integrationItemId?: string;
}

export interface PlacedBlock {
  taskId: string;
  segmentIndex: number;
  segmentLabel: string;
  start: number; // minutes from midnight
  end: number;
  kind: BlockKind;
  integrationItemId?: string;
}

export interface ScheduleResult {
  blocks: PlacedBlock[];
  /** Tasks that could not be fully placed today. */
  unscheduled: CandidateTask[];
}

export const ENERGY_RANK: Record<Energy, number> = { LOW: 1, MED: 2, HIGH: 3 };

/** Inclusive-start, exclusive-end minute windows for each time-of-day preference. */
export const TIME_OF_DAY_WINDOW: Record<TimeOfDay, [number, number]> = {
  MORNING: [0, 12 * 60],
  MIDDAY: [11 * 60, 15 * 60],
  EVENING: [17 * 60, 24 * 60],
  ANY: [0, 24 * 60],
};

/** Parse "HH:mm" into minutes from midnight. */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes from midnight back into "HH:mm". */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
