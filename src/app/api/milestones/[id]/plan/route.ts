import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";
import { generatePlan } from "@/server/planning/generatePlan";
import { getPlaybookForDomain } from "@/server/planning/playbooks";

const bodySchema = z.object({ weeklyHoursBudget: z.number().positive().default(5) });

// POST /api/milestones/:id/plan
// Run the backward pass + Claude specialization, persist Plan/PlanPhases, and
// spawn recurring study tasks for the phase that contains today.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const { weeklyHoursBudget } = bodySchema.parse(await req.json().catch(() => ({})));

  const milestone = await prisma.milestone.findFirstOrThrow({ where: { id, userId } });
  const today = DateTime.now().toISODate()!;
  const target = DateTime.fromJSDate(milestone.targetDate).toISODate()!;

  const generated = await generatePlan({
    domain: milestone.domain,
    startISO: today,
    targetISO: target,
    weeklyHoursBudget,
    details: milestone.details as unknown as Record<string, unknown>,
  });

  // Replace any prior plan for this milestone.
  await prisma.plan.deleteMany({ where: { milestoneId: milestone.id } });
  const plan = await prisma.plan.create({
    data: {
      userId,
      milestoneId: milestone.id,
      playbookKey: generated.playbookKey,
      weeklyHoursBudget,
      generatedByModel: generated.generatedByModel,
      rationale: generated.rationale,
      status: "ACTIVE",
      phases: {
        create: generated.phases.map((p) => ({
          order: p.order,
          name: p.name,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          objectives: { objectives: p.objectives, focusAreas: p.focusAreas },
          weeklyTaskTemplates: { archetypeKeys: p.archetypeKeys },
        })),
      },
    },
    include: { phases: { orderBy: { order: "asc" } } },
  });

  await spawnTasksForCurrentPhase(userId, milestone.domain, plan.id, generated.phases, today);

  return NextResponse.json(plan, { status: 201 });
}

async function spawnTasksForCurrentPhase(
  userId: string,
  domain: string,
  planId: string,
  phases: { order: number; startDate: string; endDate: string; archetypeKeys: string[] }[],
  today: string,
) {
  const playbook = getPlaybookForDomain(domain);
  if (!playbook) return;

  const current =
    phases.find((p) => today >= p.startDate && today <= p.endDate) ?? phases[0];
  const dbPhase = await prisma.planPhase.findFirst({ where: { planId, order: current.order } });
  if (!dbPhase) return;

  for (const key of current.archetypeKeys) {
    const arch = playbook.taskArchetypes.find((a) => a.key === key);
    if (!arch) continue;

    // Spread the weekly sessions across the first `perWeek` weekdays.
    const byWeekday = [1, 2, 3, 4, 5, 6, 7].slice(0, Math.min(7, arch.perWeek));
    const recurrence = await prisma.recurrence.create({
      data: { userId, freq: "WEEKLY", interval: 1, byWeekday },
    });

    await prisma.task.create({
      data: {
        userId,
        title: arch.title,
        kind: arch.kind,
        priority: 2,
        estimatedMinutes: arch.estimatedMinutes,
        estimateSource: "APP_SUGGESTED",
        preferredTimeOfDay: arch.preferredTimeOfDay,
        energy: arch.energy,
        planPhaseId: dbPhase.id,
        recurrenceId: recurrence.id,
      },
    });
  }
}
