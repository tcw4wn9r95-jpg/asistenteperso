// Seeds a single user, the codified expert playbooks, and a few sample tasks
// (including the canonical laundry chore with active/passive segments).

import { PrismaClient, Prisma } from "@prisma/client";
import { allPlaybooks } from "../src/server/planning/playbooks";

// Prisma's InputJsonValue rejects typed-interface arrays (no string index
// signature). Our playbook structures are plain JSON, so cast through unknown.
const asJson = (v: unknown) => v as unknown as Prisma.InputJsonValue;

const prisma = new PrismaClient();

async function main() {
  // Realistic newborn-household availability: short, fragmented windows with
  // energy tags. 1 = Monday .. 7 = Sunday.
  const weeklyAvailability = {
    "1": [
      { start: "06:30", end: "08:30", energy: "HIGH" },
      { start: "13:00", end: "15:00", energy: "MED" },
      { start: "20:30", end: "22:00", energy: "LOW" },
    ],
    "2": [
      { start: "06:30", end: "08:30", energy: "HIGH" },
      { start: "13:00", end: "15:00", energy: "MED" },
      { start: "20:30", end: "22:00", energy: "LOW" },
    ],
    "3": [
      { start: "06:30", end: "08:30", energy: "HIGH" },
      { start: "13:00", end: "15:00", energy: "MED" },
      { start: "20:30", end: "22:00", energy: "LOW" },
    ],
    "4": [
      { start: "06:30", end: "08:30", energy: "HIGH" },
      { start: "13:00", end: "15:00", energy: "MED" },
      { start: "20:30", end: "22:00", energy: "LOW" },
    ],
    "5": [
      { start: "06:30", end: "08:30", energy: "HIGH" },
      { start: "13:00", end: "15:00", energy: "MED" },
      { start: "20:30", end: "22:00", energy: "LOW" },
    ],
    "6": [
      { start: "08:00", end: "12:00", energy: "MED" },
      { start: "14:00", end: "18:00", energy: "MED" },
    ],
    "7": [
      { start: "08:00", end: "12:00", energy: "MED" },
      { start: "14:00", end: "18:00", energy: "MED" },
    ],
  };

  const user = await prisma.user.upsert({
    where: { email: "dcasares.silva@gmail.com" },
    update: { weeklyAvailability, dayBounds: { wake: "06:30", sleep: "23:00" } },
    create: {
      email: "dcasares.silva@gmail.com",
      name: "You",
      timezone: "Europe/Madrid",
      dayBounds: { wake: "06:30", sleep: "23:00" },
      weeklyAvailability,
    },
  });

  // Seed playbooks from the code registry (single source of truth).
  for (const pb of allPlaybooks()) {
    await prisma.expertPlaybook.upsert({
      where: { domain: pb.domain },
      update: {
        key: pb.key,
        version: pb.version,
        phaseSkeleton: asJson(pb.phaseSkeleton),
        taskArchetypes: asJson(pb.taskArchetypes),
        groundingPrompt: pb.groundingPrompt,
      },
      create: {
        domain: pb.domain,
        key: pb.key,
        version: pb.version,
        phaseSkeleton: asJson(pb.phaseSkeleton),
        taskArchetypes: asJson(pb.taskArchetypes),
        groundingPrompt: pb.groundingPrompt,
      },
    });
  }

  // Sample weekly laundry chore (active -> passive -> active).
  const existingLaundry = await prisma.task.findFirst({
    where: { userId: user.id, title: "Laundry" },
  });
  if (!existingLaundry) {
    const weekly = await prisma.recurrence.create({
      data: { userId: user.id, freq: "WEEKLY", interval: 1, byWeekday: [6] },
    });
    await prisma.task.create({
      data: {
        userId: user.id,
        title: "Laundry",
        kind: "CHORE",
        priority: 2,
        estimatedMinutes: 25,
        estimateSource: "APP_SUGGESTED",
        preferredTimeOfDay: "ANY",
        energy: "LOW",
        recurrenceId: weekly.id,
        segments: {
          create: [
            { order: 0, type: "ACTIVE", label: "load washer", minutes: 10, requiresUserPresence: true },
            { order: 1, type: "PASSIVE", label: "drying", minutes: 90, requiresUserPresence: false },
            { order: 2, type: "ACTIVE", label: "fold & store", minutes: 15, requiresUserPresence: true },
          ],
        },
      },
    });

    // A simple daily one-off backlog task.
    await prisma.task.create({
      data: {
        userId: user.id,
        title: "Tidy living room",
        kind: "CHORE",
        priority: 3,
        estimatedMinutes: 20,
        estimateSource: "APP_SUGGESTED",
        preferredTimeOfDay: "EVENING",
        energy: "LOW",
      },
    });
  }

  console.log(`Seeded user ${user.email} with ${allPlaybooks().length} playbooks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
