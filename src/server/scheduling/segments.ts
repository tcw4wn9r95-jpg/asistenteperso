// Places one task's segments onto a running clock, interleaving ACTIVE work
// (which consumes free time) with PASSIVE waits (which only advance the clock).
//
// Example — laundry: ACTIVE "load" (10m) -> PASSIVE "drying" (90m) -> ACTIVE
// "fold & store" (15m). We consume 10m now, reserve a 90m passive window that
// the user is free during, then require the fold to start no earlier than
// load.end + 90m. The 90m gap is handed back to the scheduler so a different
// active task can fill it.

import { FreePool } from "./freePool";
import {
  CandidateTask,
  PlacedBlock,
  TIME_OF_DAY_WINDOW,
} from "./types";

export interface PlaceOptions {
  /** Buffer added after each active segment to under-pack the day (newborn slack). */
  bufferMinutes: number;
  /** Latest minute of the day work may end (e.g. sleep window start). */
  dayEnd: number;
}

/**
 * Attempt to place every segment of `task`. On success returns the blocks and
 * mutates the pool (consuming active time + buffers). On failure returns null
 * and leaves the pool untouched (caller rolls back via the clone).
 */
export function placeTaskSegments(
  task: CandidateTask,
  pool: FreePool,
  options: PlaceOptions,
): PlacedBlock[] | null {
  const snapshot = pool.clone();
  const blocks: PlacedBlock[] = [];
  const [todStart, todEnd] = TIME_OF_DAY_WINDOW[task.preferredTimeOfDay];

  let clock = 0; // earliest minute the next segment may start
  let firstActivePlaced = false;

  for (let i = 0; i < task.segments.length; i++) {
    const seg = task.segments[i];

    if (seg.type === "PASSIVE") {
      // Reserve the wait without consuming the pool; just advance the clock.
      const start = clock;
      const end = start + seg.minutes;
      if (end > options.dayEnd) {
        pool.restoreFrom(snapshot);
        return null;
      }
      blocks.push({
        taskId: task.id,
        segmentIndex: i,
        segmentLabel: seg.label,
        start,
        end,
        kind: "PASSIVE_WAIT",
        integrationItemId: task.integrationItemId,
      });
      clock = end;
      continue;
    }

    // ACTIVE: anchor the first active segment within the time-of-day window;
    // later active segments only need to respect the running clock.
    const windowStart = firstActivePlaced ? 0 : todStart;
    const windowEnd = Math.min(firstActivePlaced ? 24 * 60 : todEnd, options.dayEnd);

    const fit = pool.findFit(seg.minutes, clock, windowStart, windowEnd);
    if (!fit) {
      pool.restoreFrom(snapshot);
      return null;
    }

    const start = fit.start;
    const end = start + seg.minutes;
    pool.consume(start, end);
    // Absorb a buffer after the active work so blocks don't butt together.
    if (options.bufferMinutes > 0) {
      pool.consume(end, Math.min(end + options.bufferMinutes, windowEnd));
    }

    blocks.push({
      taskId: task.id,
      segmentIndex: i,
      segmentLabel: seg.label,
      start,
      end,
      kind: task.integrationItemId ? "INTEGRATION" : "ACTIVE_WORK",
      integrationItemId: task.integrationItemId,
    });
    clock = end;
    firstActivePlaced = true;
  }

  return blocks;
}
