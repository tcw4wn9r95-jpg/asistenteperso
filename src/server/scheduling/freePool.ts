// A mutable pool of free time intervals that ACTIVE work consumes. PASSIVE
// segments never touch the pool — that is the laundry insight: while clothes
// dry, the user is free, so the pool stays open for other active work.

import { Energy, FreeWindow } from "./types";

interface Interval {
  start: number;
  end: number;
  energy: Energy;
}

export class FreePool {
  private intervals: Interval[];

  constructor(windows: FreeWindow[]) {
    this.intervals = windows
      .map((w) => ({ ...w }))
      .sort((a, b) => a.start - b.start);
  }

  clone(): FreePool {
    const copy = new FreePool([]);
    copy.intervals = this.intervals.map((i) => ({ ...i }));
    return copy;
  }

  /** Restore this pool's state from a clone (used to roll back a failed task). */
  restoreFrom(other: FreePool): void {
    this.intervals = other.intervals.map((i) => ({ ...i }));
  }

  /**
   * Find the earliest start at which `minutes` of contiguous free time fits,
   * constrained to [earliest, +inf) and the [windowStart, windowEnd] bound.
   * Returns the placement (and the energy of the hosting interval) or null.
   */
  findFit(
    minutes: number,
    earliest: number,
    windowStart: number,
    windowEnd: number,
  ): { start: number; energy: Energy } | null {
    for (const iv of this.intervals) {
      const lo = Math.max(iv.start, earliest, windowStart);
      const hi = Math.min(iv.end, windowEnd);
      if (hi - lo >= minutes) {
        return { start: lo, energy: iv.energy };
      }
    }
    return null;
  }

  /** Remove [start, end) from the pool (splitting/trimming intervals as needed). */
  consume(start: number, end: number): void {
    const next: Interval[] = [];
    for (const iv of this.intervals) {
      if (end <= iv.start || start >= iv.end) {
        next.push(iv);
        continue;
      }
      if (start > iv.start) next.push({ start: iv.start, end: start, energy: iv.energy });
      if (end < iv.end) next.push({ start: end, end: iv.end, energy: iv.energy });
    }
    this.intervals = next.sort((a, b) => a.start - b.start);
  }

  /** Total remaining free minutes — handy for tests and "how full is the day". */
  remainingMinutes(): number {
    return this.intervals.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  }
}
