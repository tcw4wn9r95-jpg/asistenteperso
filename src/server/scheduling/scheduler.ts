// The day scheduler: a deterministic, explainable greedy first-fit placer.
// No AI in this hot path — the chatbot and plan generator feed it candidates,
// but placement itself is pure and testable.

import { FreePool } from "./freePool";
import { placeTaskSegments } from "./segments";
import {
  CandidateTask,
  ENERGY_RANK,
  FreeWindow,
  ScheduleResult,
} from "./types";

export interface SchedulerConfig {
  /** Fraction of each active block added as trailing buffer (0.25 = under-pack 25%). */
  slackRatio: number;
  /** Latest minute work may end (default 22:00). */
  dayEnd: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  slackRatio: 0.25,
  dayEnd: 22 * 60,
};

// Scoring weights. Priority dominates; deadline urgency and a soft energy/
// time-of-day match break ties.
const W_PRIORITY = 10;
const W_URGENCY = 6;
const W_ENERGY = 2;

const URGENCY_HORIZON_DAYS = 14;

/** Higher score = scheduled earlier in the queue. */
export function scoreCandidate(task: CandidateTask, windows: FreeWindow[]): number {
  const priorityScore = (5 - clampPriority(task.priority)) * W_PRIORITY;

  const urgency =
    task.daysUntilDue === undefined
      ? 0
      : (Math.max(0, URGENCY_HORIZON_DAYS - task.daysUntilDue) / URGENCY_HORIZON_DAYS) *
        W_URGENCY;

  // Reward tasks whose energy need can be met by the best available window.
  const bestWindowEnergy = windows.reduce(
    (max, w) => Math.max(max, ENERGY_RANK[w.energy]),
    0,
  );
  const energyMatch =
    bestWindowEnergy >= ENERGY_RANK[task.energy] ? W_ENERGY : 0;

  return priorityScore + urgency + energyMatch;
}

function clampPriority(p: number): number {
  return Math.min(4, Math.max(1, p));
}

/**
 * Place candidate tasks into the day. Tasks that don't fully fit are returned
 * in `unscheduled` (surfaced to the user as a "didn't fit" tray) rather than
 * causing a hard failure.
 */
export function scheduleDay(
  candidates: CandidateTask[],
  windows: FreeWindow[],
  config: Partial<SchedulerConfig> = {},
): ScheduleResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const pool = new FreePool(windows);

  const ordered = [...candidates].sort(
    (a, b) => scoreCandidate(b, windows) - scoreCandidate(a, windows),
  );

  const blocks: ScheduleResult["blocks"] = [];
  const unscheduled: CandidateTask[] = [];

  for (const task of ordered) {
    const activeMinutes = task.segments
      .filter((s) => s.type === "ACTIVE")
      .reduce((sum, s) => sum + s.minutes, 0);
    const bufferMinutes = Math.ceil(activeMinutes * cfg.slackRatio);

    const placed = placeTaskSegments(task, pool, {
      bufferMinutes,
      dayEnd: cfg.dayEnd,
    });

    if (placed) {
      blocks.push(...placed);
    } else {
      unscheduled.push(task);
    }
  }

  blocks.sort((a, b) => a.start - b.start);
  return { blocks, unscheduled };
}
