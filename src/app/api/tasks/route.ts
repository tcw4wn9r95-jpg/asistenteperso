import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";
import { suggestEstimateMinutes } from "@/lib/estimate";

const segmentSchema = z.object({
  type: z.enum(["ACTIVE", "PASSIVE"]),
  label: z.string(),
  minutes: z.number().int().positive(),
  requiresUserPresence: z.boolean().default(true),
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  kind: z.enum(["GENERIC", "CHORE", "STUDY"]).default("GENERIC"),
  priority: z.number().int().min(1).max(4).default(3),
  estimatedMinutes: z.number().int().positive().optional(),
  preferredTimeOfDay: z.enum(["MORNING", "MIDDAY", "EVENING", "ANY"]).default("ANY"),
  energy: z.enum(["LOW", "MED", "HIGH"]).default("MED"),
  dueDate: z.string().datetime().optional(),
  segments: z.array(segmentSchema).optional(),
  // Optional cadence
  recurrence: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      interval: z.number().int().positive().default(1),
      byWeekday: z.array(z.number().int().min(1).max(7)).optional(),
    })
    .optional(),
});

// GET /api/tasks -> list the user's tasks
export async function GET() {
  const userId = await getCurrentUserId();
  const tasks = await prisma.task.findMany({
    where: { userId },
    include: { segments: { orderBy: { order: "asc" } }, recurrence: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

// POST /api/tasks -> create a task (with optional segments + recurrence).
// If no estimate is given, the app suggests one.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = createTaskSchema.parse(await req.json());

  const estimatedMinutes =
    body.estimatedMinutes ?? suggestEstimateMinutes(body.title, body.kind);

  const recurrenceId = body.recurrence
    ? (
        await prisma.recurrence.create({
          data: {
            userId,
            freq: body.recurrence.freq,
            interval: body.recurrence.interval,
            byWeekday: body.recurrence.byWeekday ?? undefined,
          },
        })
      ).id
    : undefined;

  const task = await prisma.task.create({
    data: {
      userId,
      title: body.title,
      notes: body.notes,
      kind: body.kind,
      priority: body.priority,
      estimatedMinutes,
      estimateSource: body.estimatedMinutes ? "USER" : "APP_SUGGESTED",
      preferredTimeOfDay: body.preferredTimeOfDay,
      energy: body.energy,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      recurrenceId,
      segments: body.segments
        ? {
            create: body.segments.map((s, i) => ({
              order: i,
              type: s.type,
              label: s.label,
              minutes: s.minutes,
              requiresUserPresence: s.requiresUserPresence,
            })),
          }
        : undefined,
    },
    include: { segments: true, recurrence: true },
  });

  return NextResponse.json(task, { status: 201 });
}
