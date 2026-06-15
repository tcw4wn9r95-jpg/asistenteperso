// Orchestrates a day generation end-to-end against the database:
//   tasks (+ recurrence) + synced integration items -> candidates
//   user availability (minus locked blocks) -> free windows
//   scheduleDay() -> persist a PENDING DayPlan (the approval gate)
//
// Locked blocks (user-pinned via drag/approve) are preserved across regeneration,
// which is what powers the "reflow the rest of my day" action.

import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { scheduleDay } from "./scheduler";
import { buildFreeWindows, FixedInterval, WeeklyAvailability } from "./availability";
import { occursOn, RecurrenceRule } from "./recurrence";
import {
  CandidateSegment,
  CandidateTask,
  PlacedBlock,
  TimeOfDay,
  Energy,
} from "./types";

export interface DayPlanResult {
  dayPlanId: string;
  date: string;
  status: string;
  blocks: PersistedBlock[];
  unscheduled: { id: string; title: string }[];
}

export interface PersistedBlock {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;
  kind: string;
  locked: boolean;
  source: string;
}

export async function generateDayPlan(userId: string, date: string): Promise<DayPlanResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const zone = user.timezone;
  const weekday = DateTime.fromISO(date, { zone }).weekday;

  // Preserve locked blocks from any existing plan.
  const existing = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId, date } },
    include: { blocks: { include: { task: true, integrationItem: true } } },
  });
  const lockedBlocks = existing?.blocks.filter((b) => b.locked) ?? [];
  const lockedTaskIds = new Set(
    lockedBlocks.map((b) => b.taskId).filter((x): x is string => Boolean(x)),
  );
  const fixed: FixedInterval[] = lockedBlocks.map((b) => ({
    start: minutesFromMidnight(b.start, zone),
    end: minutesFromMidnight(b.end, zone),
  }));

  const windows = buildFreeWindows(
    user.weeklyAvailability as unknown as WeeklyAvailability,
    weekday,
    fixed,
  );

  const candidates = await buildCandidates(userId, date, lockedTaskIds);
  const result = scheduleDay(candidates, windows);

  // Persist: upsert the DayPlan, clear non-locked blocks, write fresh AUTO blocks.
  const dayPlan = await prisma.dayPlan.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, status: "PENDING" },
    update: { status: "PENDING", generatedAt: new Date(), approvedAt: null },
  });

  await prisma.scheduleBlock.deleteMany({
    where: { dayPlanId: dayPlan.id, locked: false },
  });

  const dayStart = DateTime.fromISO(date, { zone }).startOf("day");
  for (const b of result.blocks) {
    await prisma.scheduleBlock.create({
      data: {
        dayPlanId: dayPlan.id,
        taskId: b.taskId.startsWith("int:") ? null : b.taskId,
        integrationItemId: b.integrationItemId ?? null,
        start: dayStart.plus({ minutes: b.start }).toJSDate(),
        end: dayStart.plus({ minutes: b.end }).toJSDate(),
        kind: b.kind,
        source: "AUTO",
      },
    });
  }

  return readDayPlan(userId, date);
}

export async function readDayPlan(userId: string, date: string): Promise<DayPlanResult> {
  const dayPlan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId, date } },
    include: {
      blocks: {
        include: { task: true, integrationItem: true, taskSegment: true },
        orderBy: { start: "asc" },
      },
    },
  });

  if (!dayPlan) {
    return { dayPlanId: "", date, status: "NONE", blocks: [], unscheduled: [] };
  }

  return {
    dayPlanId: dayPlan.id,
    date,
    status: dayPlan.status,
    blocks: dayPlan.blocks.map((b) => ({
      id: b.id,
      title:
        b.taskSegment?.label ??
        b.task?.title ??
        b.integrationItem?.title ??
        "Block",
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      kind: b.kind,
      locked: b.locked,
      source: b.source,
    })),
    unscheduled: [],
  };
}

async function buildCandidates(
  userId: string,
  date: string,
  excludeTaskIds: Set<string>,
): Promise<CandidateTask[]> {
  const dayEnd = DateTime.fromISO(date).endOf("day").toJSDate();

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "SCHEDULED"] },
      id: { notIn: [...excludeTaskIds] },
    },
    include: { segments: { orderBy: { order: "asc" } }, recurrence: true },
  });

  const candidates: CandidateTask[] = [];

  for (const t of tasks) {
    // Filter to tasks relevant for this date.
    if (t.recurrence) {
      const rule: RecurrenceRule = {
        freq: t.recurrence.freq as RecurrenceRule["freq"],
        interval: t.recurrence.interval,
        byWeekday: (t.recurrence.byWeekday as number[] | null) ?? undefined,
      };
      if (!occursOn(rule, date)) continue;
    } else if (t.dueDate && t.dueDate > dayEnd) {
      continue; // one-off not due yet
    }

    candidates.push({
      id: t.id,
      title: t.title,
      kind: t.kind,
      priority: t.priority,
      preferredTimeOfDay: t.preferredTimeOfDay as TimeOfDay,
      energy: t.energy as Energy,
      daysUntilDue: t.dueDate
        ? Math.max(0, Math.round(DateTime.fromJSDate(t.dueDate).diff(DateTime.fromISO(date), "days").days))
        : undefined,
      segments: toSegments(t.segments, t.title, t.estimatedMinutes),
    });
  }

  // Integration items synced for this date.
  const items = await prisma.integrationItem.findMany({
    where: { userId, date, status: "PENDING" },
  });
  for (const item of items) {
    const payload = (item.payload as Record<string, unknown>) ?? {};
    const segs = Array.isArray(payload.segments)
      ? (payload.segments as { type: string; label: string; minutes: number }[])
      : null;
    candidates.push({
      id: `int:${item.id}`,
      title: item.title,
      kind: "INTEGRATION_DERIVED",
      priority: 2,
      preferredTimeOfDay: item.preferredTimeOfDay as TimeOfDay,
      energy: item.energy as Energy,
      integrationItemId: item.id,
      segments: segs
        ? segs.map((s) => ({
            type: s.type === "PASSIVE" ? "PASSIVE" : "ACTIVE",
            label: s.label,
            minutes: s.minutes,
            requiresUserPresence: s.type !== "PASSIVE",
          }))
        : [
            {
              type: "ACTIVE",
              label: item.title,
              minutes: item.suggestedMinutes,
              requiresUserPresence: true,
            },
          ],
    });
  }

  return candidates;
}

function toSegments(
  segments: { type: string; label: string; minutes: number; requiresUserPresence: boolean }[],
  title: string,
  estimatedMinutes: number,
): CandidateSegment[] {
  if (segments.length > 0) {
    return segments.map((s) => ({
      type: s.type === "PASSIVE" ? "PASSIVE" : "ACTIVE",
      label: s.label,
      minutes: s.minutes,
      requiresUserPresence: s.requiresUserPresence,
    }));
  }
  return [
    { type: "ACTIVE", label: title, minutes: estimatedMinutes, requiresUserPresence: true },
  ];
}

function minutesFromMidnight(d: Date, zone: string): number {
  const dt = DateTime.fromJSDate(d, { zone });
  return dt.hour * 60 + dt.minute;
}
