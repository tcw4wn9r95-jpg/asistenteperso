// Adaptive accountability: records a check-in for a schedule block and updates
// the relevant streak. Grounded in behavior-change evidence — we capture an
// implementation intention ("I will do X at TIME in PLACE") at commit time and
// reinforce consistency via streaks rather than shallow points.

import { DateTime } from "luxon";
import { prisma } from "@/server/db";

export type Outcome = "DONE" | "SKIPPED" | "PARTIAL";

export interface CheckInInput {
  userId: string;
  scheduleBlockId: string;
  outcome: Outcome;
  date: string; // yyyy-MM-dd
  implementationIntention?: string;
  note?: string;
}

/** Derive a stable streak key from a block's underlying task/integration. */
async function streakKeyForBlock(scheduleBlockId: string): Promise<string> {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: scheduleBlockId },
    include: { task: { include: { planPhase: { include: { plan: true } } } } },
  });
  if (!block) return "general";
  if (block.task?.kind === "CHORE") return `chore:${block.task.title.toLowerCase()}`;
  if (block.task?.planPhase) return `plan:${block.task.planPhase.planId}`;
  if (block.integrationItemId) return "integration";
  return block.task ? `task:${block.task.title.toLowerCase()}` : "general";
}

export async function recordCheckIn(input: CheckInInput) {
  const checkIn = await prisma.checkIn.upsert({
    where: { scheduleBlockId: input.scheduleBlockId },
    create: {
      userId: input.userId,
      scheduleBlockId: input.scheduleBlockId,
      outcome: input.outcome,
      implementationIntention: input.implementationIntention,
      note: input.note,
    },
    update: {
      outcome: input.outcome,
      implementationIntention: input.implementationIntention,
      note: input.note,
    },
  });

  const key = await streakKeyForBlock(input.scheduleBlockId);
  const streak = await updateStreak(input.userId, key, input.outcome, input.date);

  return { checkIn, streak };
}

async function updateStreak(userId: string, key: string, outcome: Outcome, date: string) {
  const existing = await prisma.streak.findUnique({
    where: { userId_key: { userId, key } },
  });

  // Only DONE advances a streak; SKIPPED breaks it; PARTIAL holds it.
  let current = existing?.current ?? 0;
  if (outcome === "DONE") {
    const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();
    const continues = existing?.lastCompletedDate === yesterday || existing?.lastCompletedDate === date;
    current = continues ? current + (existing?.lastCompletedDate === date ? 0 : 1) : 1;
  } else if (outcome === "SKIPPED") {
    current = 0;
  }
  const longest = Math.max(existing?.longest ?? 0, current);

  return prisma.streak.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, current, longest, lastCompletedDate: outcome === "DONE" ? date : null },
    update: {
      current,
      longest,
      lastCompletedDate: outcome === "DONE" ? date : existing?.lastCompletedDate,
    },
  });
}
