// In-browser application engine. Reuses the same pure modules the server used
// (scheduler, backward-pass planner, playbooks, recurrence, estimate) but reads
// and writes the on-device store instead of a database. This is what makes the
// app a zero-backend static PWA.

import { DateTime } from "luxon";
import {
  AppSettings,
  AppState,
  StoredBlock,
  StoredDayPlan,
  StoredMilestone,
  StoredStreak,
  StoredTask,
  id,
  loadState,
  saveState,
} from "./store";
import { suggestEstimateMinutes } from "./estimate";
import { scheduleDay } from "@/server/scheduling/scheduler";
import { buildFreeWindows, WeeklyAvailability, FixedInterval } from "@/server/scheduling/availability";
import { CandidateSegment, CandidateTask, Energy, TimeOfDay } from "@/server/scheduling/types";
import { occursOn, RecurrenceRule } from "@/server/scheduling/recurrence";
import { computeDatedPhases } from "@/server/planning/backwardPass";
import { getPlaybookForDomain } from "@/server/planning/playbooks";
import { fetchAllDirectives } from "@/server/integrations/registry";

// ---------- Tasks ----------

export function listTasks(): StoredTask[] {
  return loadState().tasks;
}

export function createTask(input: {
  title: string;
  description?: string;
  kind: StoredTask["kind"];
  priority: number;
  estimatedMinutes?: number;
  preferredTimeOfDay: TimeOfDay;
  energy: Energy;
  segments?: StoredTask["segments"];
  recurrence?: StoredTask["recurrence"];
  dueDate?: string;
}): StoredTask {
  const s = loadState();
  const task: StoredTask = {
    id: id("task"),
    title: input.title,
    description: input.description,
    kind: input.kind,
    priority: input.priority,
    estimatedMinutes: input.estimatedMinutes ?? suggestEstimateMinutes(input.title, input.kind),
    estimateSource: input.estimatedMinutes ? "USER" : "APP_SUGGESTED",
    preferredTimeOfDay: input.preferredTimeOfDay,
    energy: input.energy,
    dueDate: input.dueDate,
    status: "PENDING",
    segments: input.segments ?? [],
    recurrence: input.recurrence,
    createdAt: new Date().toISOString(),
  };
  s.tasks.unshift(task);
  saveState(s);
  return task;
}

export function deleteTask(taskId: string): void {
  const s = loadState();
  s.tasks = s.tasks.filter((t) => t.id !== taskId);
  // Drop any scheduled blocks that referenced the task.
  for (const date of Object.keys(s.dayPlans)) {
    s.dayPlans[date].blocks = s.dayPlans[date].blocks.filter((b) => b.taskId !== taskId);
  }
  saveState(s);
}

// ---------- Settings ----------

export function getSettings(): AppSettings {
  return loadState().settings ?? {};
}

export function saveSettings(settings: AppSettings): void {
  const s = loadState();
  s.settings = { ...s.settings, ...settings };
  saveState(s);
}

// ---------- Day planning ----------

export async function buildDay(date: string, opts: { survival?: boolean } = {}): Promise<StoredDayPlan> {
  const s = loadState();
  const weekday = DateTime.fromISO(date).weekday;

  const existing = s.dayPlans[date];
  const lockedBlocks = existing?.blocks.filter((b) => b.locked) ?? [];
  const lockedTaskIds = new Set(lockedBlocks.map((b) => b.taskId).filter(Boolean));
  const fixed: FixedInterval[] = lockedBlocks.map((b) => ({ start: b.startMin, end: b.endMin }));

  const windows = buildFreeWindows(s.weeklyAvailability as WeeklyAvailability, weekday, fixed);
  let candidates = await buildCandidates(s, date, lockedTaskIds as Set<string>);
  if (opts.survival) {
    // Rough-night mode: only the must-dos — high-priority tasks and meals (you
    // still need to eat). Training and lower-priority chores can slide.
    candidates = candidates.filter((c) => {
      const isMeal = /^(cook|batch)/i.test(c.title);
      const isMustDoTask = c.priority <= 2 && c.kind !== "INTEGRATION_DERIVED";
      return isMustDoTask || isMeal;
    });
  }
  const result = scheduleDay(candidates, windows);

  const autoBlocks: StoredBlock[] = result.blocks.map((b) => ({
    id: id("blk"),
    taskId: b.taskId.startsWith("int:") ? undefined : b.taskId,
    integrationId: b.integrationItemId,
    title: b.segmentLabel,
    startMin: b.start,
    endMin: b.end,
    kind: b.kind,
    locked: false,
    source: "AUTO",
  }));

  const dayPlan: StoredDayPlan = {
    date,
    status: "PENDING",
    blocks: [...lockedBlocks, ...autoBlocks].sort((a, b) => a.startMin - b.startMin),
    unscheduled: result.unscheduled.map((u) => ({ id: u.id, title: u.title })),
  };
  s.dayPlans[date] = dayPlan;
  saveState(s);
  return dayPlan;
}

export function readDay(date: string): StoredDayPlan | null {
  return loadState().dayPlans[date] ?? null;
}

export function approveDay(date: string): void {
  const s = loadState();
  if (s.dayPlans[date]) {
    s.dayPlans[date].status = "APPROVED";
    saveState(s);
  }
}

export function moveBlock(date: string, blockId: string, deltaMin: number): void {
  const s = loadState();
  const plan = s.dayPlans[date];
  if (!plan) return;
  const block = plan.blocks.find((b) => b.id === blockId);
  if (!block) return;
  block.startMin += deltaMin;
  block.endMin += deltaMin;
  block.locked = true;
  block.source = "USER";
  plan.status = "MODIFIED";
  saveState(s);
}

async function buildCandidates(
  s: AppState,
  date: string,
  excludeTaskIds: Set<string>,
): Promise<CandidateTask[]> {
  const candidates: CandidateTask[] = [];

  for (const t of s.tasks) {
    if (t.status !== "PENDING" || excludeTaskIds.has(t.id)) continue;
    if (t.recurrence) {
      const rule: RecurrenceRule = {
        freq: t.recurrence.freq,
        interval: t.recurrence.interval,
        byWeekday: t.recurrence.byWeekday,
      };
      if (!occursOn(rule, date)) continue;
    } else if (t.dueDate && t.dueDate < date) {
      // overdue still counts; future one-offs are skipped
    } else if (t.dueDate && t.dueDate > date) {
      continue;
    }
    candidates.push({
      id: t.id,
      title: t.title,
      kind: t.kind,
      priority: t.priority,
      preferredTimeOfDay: t.preferredTimeOfDay,
      energy: t.energy,
      daysUntilDue: t.dueDate
        ? Math.max(0, Math.round(DateTime.fromISO(t.dueDate).diff(DateTime.fromISO(date), "days").days))
        : undefined,
      segments: t.segments.length
        ? (t.segments as CandidateSegment[])
        : [{ type: "ACTIVE", label: t.title, minutes: t.estimatedMinutes, requiresUserPresence: true }],
    });
  }

  // Live integration directives from Coach Claudio + NutriPrep.
  try {
    const directives = await fetchAllDirectives(date, "local");
    for (const d of directives) {
      candidates.push({
        id: `int:${d.externalId}`,
        title: d.title,
        kind: "INTEGRATION_DERIVED",
        priority: 2,
        preferredTimeOfDay: d.preferredTimeOfDay,
        energy: d.energy,
        integrationItemId: d.externalId,
        segments: d.segments.map((g) => ({
          type: g.type,
          label: g.label,
          minutes: g.minutes,
          requiresUserPresence: g.type !== "PASSIVE",
        })),
      });
    }
  } catch {
    /* offline / unreachable: schedule without integrations */
  }

  return candidates;
}

// ---------- Accountability ----------

export function listStreaks(): StoredStreak[] {
  return loadState().streaks.slice().sort((a, b) => b.current - a.current);
}

export function checkIn(date: string, blockId: string, outcome: "DONE" | "SKIPPED"): void {
  const s = loadState();
  const plan = s.dayPlans[date];
  const block = plan?.blocks.find((b) => b.id === blockId);
  if (!block) return;

  const key = streakKey(s, block);
  let streak = s.streaks.find((x) => x.key === key);
  if (!streak) {
    streak = { key, current: 0, longest: 0, lastCompletedDate: null };
    s.streaks.push(streak);
  }
  if (outcome === "DONE") {
    const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();
    const continues = streak.lastCompletedDate === yesterday || streak.lastCompletedDate === date;
    if (streak.lastCompletedDate !== date) streak.current = continues ? streak.current + 1 : 1;
    streak.lastCompletedDate = date;
  } else {
    streak.current = 0;
  }
  streak.longest = Math.max(streak.longest, streak.current);
  saveState(s);
}

function streakKey(s: AppState, block: StoredBlock): string {
  if (block.integrationId) return "integration";
  const task = s.tasks.find((t) => t.id === block.taskId);
  if (!task) return "general";
  if (task.kind === "CHORE") return `chore:${task.title.toLowerCase()}`;
  if (task.planMilestoneId) return `plan:${task.planMilestoneId}`;
  return `task:${task.title.toLowerCase()}`;
}

// ---------- Milestones ----------

export function listMilestones(): StoredMilestone[] {
  return loadState().milestones;
}

/** Apply Claude-personalized objectives + rationale to a milestone's plan. */
export function applyPlanSpecialization(
  milestoneId: string,
  rationale: string,
  phases: { order: number; objectives: string[] }[],
  model: string,
): void {
  const s = loadState();
  const m = s.milestones.find((x) => x.id === milestoneId);
  if (!m?.plan) return;
  const byOrder = new Map(phases.map((p) => [p.order, p.objectives]));
  m.plan.rationale = rationale;
  m.plan.generatedByModel = model;
  m.plan.phases = m.plan.phases.map((p) => ({ ...p, objectives: byOrder.get(p.order) ?? p.objectives }));
  saveState(s);
}

export function deleteMilestone(milestoneId: string): void {
  const s = loadState();
  s.milestones = s.milestones.filter((m) => m.id !== milestoneId);
  s.tasks = s.tasks.filter((t) => t.planMilestoneId !== milestoneId);
  saveState(s);
}

/**
 * Create a milestone and generate its plan deterministically (backward pass +
 * expert playbook). AI specialization is layered on later via a GitHub Action,
 * matching the other apps' architecture.
 */
export function createMilestoneWithPlan(input: {
  title: string;
  domain: StoredMilestone["domain"];
  targetDate: string;
  weeklyHoursBudget: number;
  details: Record<string, unknown>;
}): StoredMilestone {
  const s = loadState();
  const playbook = getPlaybookForDomain(input.domain);
  const today = DateTime.now().toISODate()!;

  const milestone: StoredMilestone = {
    id: id("ms"),
    title: input.title,
    domain: input.domain,
    targetDate: input.targetDate,
    details: input.details,
    weeklyHoursBudget: input.weeklyHoursBudget,
  };

  if (playbook) {
    const phases = computeDatedPhases(today, input.targetDate, playbook.phaseSkeleton, input.weeklyHoursBudget);
    milestone.plan = {
      rationale: "Plan generated from the expert playbook skeleton. Enable the AI action for personalization.",
      generatedByModel: null,
      phases: phases.map((p) => ({
        order: p.order,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        objectives: p.objectives,
        focusAreas: p.focusAreas,
      })),
    };

    // Spawn recurring study tasks for the phase that contains today.
    const current = phases.find((p) => today >= p.startDate && today <= p.endDate) ?? phases[0];
    for (const key of current.archetypeKeys) {
      const arch = playbook.taskArchetypes.find((a) => a.key === key);
      if (!arch) continue;
      s.tasks.unshift({
        id: id("task"),
        title: arch.title,
        kind: arch.kind === "CHORE" ? "CHORE" : arch.kind === "STUDY" ? "STUDY" : "GENERIC",
        priority: 2,
        estimatedMinutes: arch.estimatedMinutes,
        estimateSource: "APP_SUGGESTED",
        preferredTimeOfDay: arch.preferredTimeOfDay,
        energy: arch.energy,
        status: "PENDING",
        segments: [],
        recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [1, 2, 3, 4, 5, 6, 7].slice(0, Math.min(7, arch.perWeek)) },
        planMilestoneId: milestone.id,
        createdAt: new Date().toISOString(),
      });
    }
  }

  s.milestones.push(milestone);
  saveState(s);
  return milestone;
}
