import { describe, it, expect } from "vitest";
import { buildFreeWindows } from "./availability";
import { scheduleDay } from "./scheduler";
import { placeTaskSegments } from "./segments";
import { FreePool } from "./freePool";
import { CandidateTask, FreeWindow } from "./types";

const laundry: CandidateTask = {
  id: "laundry",
  title: "Laundry",
  kind: "CHORE",
  priority: 2,
  preferredTimeOfDay: "ANY",
  energy: "LOW",
  segments: [
    { type: "ACTIVE", label: "load washer", minutes: 10, requiresUserPresence: true },
    { type: "PASSIVE", label: "drying", minutes: 90, requiresUserPresence: false },
    { type: "ACTIVE", label: "fold & store", minutes: 15, requiresUserPresence: true },
  ],
};

describe("buildFreeWindows", () => {
  it("subtracts a fixed block, splitting the window", () => {
    const avail = { "1": [{ start: "09:00", end: "17:00", energy: "HIGH" as const }] };
    const windows = buildFreeWindows(avail, 1, [{ start: 12 * 60, end: 13 * 60 }]);
    expect(windows).toEqual([
      { start: 9 * 60, end: 12 * 60, energy: "HIGH" },
      { start: 13 * 60, end: 17 * 60, energy: "HIGH" },
    ]);
  });
});

describe("placeTaskSegments — passive interleaving", () => {
  const windows: FreeWindow[] = [{ start: 9 * 60, end: 17 * 60, energy: "MED" }];

  it("reserves the passive gap without consuming free time", () => {
    const pool = new FreePool(windows);
    const before = pool.remainingMinutes();

    const blocks = placeTaskSegments(laundry, pool, { bufferMinutes: 0, dayEnd: 22 * 60 });
    expect(blocks).not.toBeNull();

    const after = pool.remainingMinutes();
    // Only the two ACTIVE segments (10 + 15 = 25m) consume the pool; the 90m
    // passive dry time is NOT consumed.
    expect(before - after).toBe(25);

    const passive = blocks!.find((b) => b.kind === "PASSIVE_WAIT")!;
    const fold = blocks!.find((b) => b.segmentLabel === "fold & store")!;
    // Fold must start no earlier than load.end + drying time.
    expect(fold.start).toBeGreaterThanOrEqual(passive.end);
  });

  it("back-fills another active task into the drying gap", () => {
    // Laundry is higher priority so it is placed first, opening the drying gap;
    // the lower-priority study task should then fill that gap.
    const highPriorityLaundry = { ...laundry, priority: 1 };
    const study: CandidateTask = {
      id: "study",
      title: "Spanish Anki",
      kind: "STUDY",
      priority: 3,
      preferredTimeOfDay: "ANY",
      energy: "MED",
      segments: [{ type: "ACTIVE", label: "review", minutes: 30, requiresUserPresence: true }],
    };

    const result = scheduleDay([highPriorityLaundry, study], windows);
    expect(result.unscheduled).toHaveLength(0);

    const passive = result.blocks.find((b) => b.kind === "PASSIVE_WAIT")!;
    const review = result.blocks.find((b) => b.taskId === "study")!;
    // The 30m review lands during the 90m drying window — proving the gap was
    // handed back to the pool.
    expect(review.start).toBeGreaterThanOrEqual(passive.start);
    expect(review.end).toBeLessThanOrEqual(passive.end);
  });
});

describe("scheduleDay", () => {
  const windows: FreeWindow[] = [{ start: 9 * 60, end: 10 * 60, energy: "MED" }];

  it("orders by priority and overflows what doesn't fit", () => {
    const big: CandidateTask = {
      id: "big",
      title: "Deep work",
      kind: "GENERIC",
      priority: 4,
      preferredTimeOfDay: "ANY",
      energy: "MED",
      segments: [{ type: "ACTIVE", label: "work", minutes: 50, requiresUserPresence: true }],
    };
    const small: CandidateTask = {
      id: "small",
      title: "Pay bill",
      kind: "GENERIC",
      priority: 1,
      preferredTimeOfDay: "ANY",
      energy: "LOW",
      segments: [{ type: "ACTIVE", label: "pay", minutes: 40, requiresUserPresence: true }],
    };

    // Only 60 free minutes. High-priority `small` (40m) is placed first; with
    // 25% slack it consumes 50m, leaving 10m — `big` (50m) overflows.
    const result = scheduleDay([big, small], windows);
    expect(result.blocks.map((b) => b.taskId)).toEqual(["small"]);
    expect(result.unscheduled.map((t) => t.id)).toEqual(["big"]);
  });

  it("respects time-of-day preference for the anchor segment", () => {
    const morningWin: FreeWindow[] = [
      { start: 8 * 60, end: 20 * 60, energy: "MED" },
    ];
    const eveningTask: CandidateTask = {
      id: "dinner",
      title: "Cook dinner",
      kind: "CHORE",
      priority: 2,
      preferredTimeOfDay: "EVENING",
      energy: "MED",
      segments: [{ type: "ACTIVE", label: "cook", minutes: 30, requiresUserPresence: true }],
    };
    const result = scheduleDay([eveningTask], morningWin);
    const block = result.blocks[0];
    expect(block.start).toBeGreaterThanOrEqual(17 * 60); // EVENING window
  });
});
