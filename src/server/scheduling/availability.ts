// Turns the user's weekly availability (and any fixed/locked blocks) into the
// list of free windows the scheduler can place work into.

import { FreeWindow, parseClock } from "./types";

export interface WeeklyAvailabilityWindow {
  start: string; // "HH:mm"
  end: string;
  energy?: "LOW" | "MED" | "HIGH";
}

// Keyed by ISO weekday as a string: "1" = Monday .. "7" = Sunday.
export type WeeklyAvailability = Record<string, WeeklyAvailabilityWindow[]>;

export interface FixedInterval {
  start: number; // minutes from midnight
  end: number;
}

/**
 * Build the free windows for a given weekday, then subtract any fixed/locked
 * intervals (meetings, user-pinned blocks). Result is sorted and non-overlapping.
 *
 * @param weekday ISO weekday 1..7 (Mon..Sun)
 */
export function buildFreeWindows(
  availability: WeeklyAvailability,
  weekday: number,
  fixed: FixedInterval[] = [],
): FreeWindow[] {
  const raw = availability[String(weekday)] ?? [];
  let windows: FreeWindow[] = raw
    .map((w) => ({
      start: parseClock(w.start),
      end: parseClock(w.end),
      energy: w.energy ?? "MED",
    }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);

  for (const block of [...fixed].sort((a, b) => a.start - b.start)) {
    windows = windows.flatMap((w) => subtract(w, block));
  }

  return windows;
}

/** Remove a fixed interval from a free window, yielding 0..2 remaining windows. */
function subtract(window: FreeWindow, block: FixedInterval): FreeWindow[] {
  if (block.end <= window.start || block.start >= window.end) return [window];
  const out: FreeWindow[] = [];
  if (block.start > window.start) {
    out.push({ start: window.start, end: block.start, energy: window.energy });
  }
  if (block.end < window.end) {
    out.push({ start: block.end, end: window.end, energy: window.energy });
  }
  return out;
}
