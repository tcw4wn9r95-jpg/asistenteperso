import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";
import { asJson } from "@/server/json";

const createSchema = z.object({
  title: z.string().min(1),
  domain: z.enum(["LANGUAGE_EXAM", "FITNESS", "GENERIC"]),
  targetDate: z.string(), // yyyy-MM-dd
  weeklyHoursBudget: z.number().positive().default(5),
  details: z.record(z.unknown()).default({}),
});

// GET /api/milestones -> list with their plans/phases
export async function GET() {
  const userId = await getCurrentUserId();
  const milestones = await prisma.milestone.findMany({
    where: { userId },
    include: { plan: { include: { phases: { orderBy: { order: "asc" } } } } },
    orderBy: { targetDate: "asc" },
  });
  return NextResponse.json(milestones);
}

// POST /api/milestones -> create a milestone (plan generated separately)
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = createSchema.parse(await req.json());

  const milestone = await prisma.milestone.create({
    data: {
      userId,
      title: body.title,
      domain: body.domain,
      targetDate: new Date(body.targetDate),
      details: asJson(body.details),
    },
  });

  // Stash the budget on the (yet-to-be-created) plan via details for the
  // generation step to read.
  return NextResponse.json({ ...milestone, weeklyHoursBudget: body.weeklyHoursBudget }, { status: 201 });
}
