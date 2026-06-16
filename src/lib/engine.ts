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

export function updateTask(
  taskId: string,
  patch: Partial<Omit<StoredTask, "id" | "createdAt">>,
): void {
  const s = loadState();
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return;
  Object.assign(t, patch);
  saveState(s);
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

/** Move a block so it begins at an absolute minute-of-day (used by drag-and-drop). */
export function moveBlockTo(date: string, blockId: string, newStartMin: number): void {
  const s = loadState();
  const plan = s.dayPlans[date];
  if (!plan) return;
  const block = plan.blocks.find((b) => b.id === blockId);
  if (!block) return;
  const dur = block.endMin - block.startMin;
  block.startMin = Math.max(0, Math.round(newStartMin));
  block.endMin = block.startMin + dur;
  block.locked = true;
  block.source = "USER";
  plan.status = "MODIFIED";
  plan.blocks.sort((a, b) => a.startMin - b.startMin);
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

  // Toggle off if tapping the same outcome again.
  const resolved = block.outcome === outcome ? undefined : outcome;
  block.outcome = resolved;

  // Only a fresh DONE advances a streak; a SKIP breaks it; toggling off leaves it.
  if (resolved) {
    const key = streakKey(s, block);
    let streak = s.streaks.find((x) => x.key === key);
    if (!streak) {
      streak = { key, current: 0, longest: 0, lastCompletedDate: null };
      s.streaks.push(streak);
    }
    if (resolved === "DONE") {
      const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();
      const continues = streak.lastCompletedDate === yesterday || streak.lastCompletedDate === date;
      if (streak.lastCompletedDate !== date) streak.current = continues ? streak.current + 1 : 1;
      streak.lastCompletedDate = date;
    } else {
      streak.current = 0;
    }
    streak.longest = Math.max(streak.longest, streak.current);
  }
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

// Fallback phase skeleton for any goal when no AI key is set. Generic on purpose
// — the real tailoring comes from Claude (generateTailoredPlan).
const GENERIC_SKELETON = [
  { name: "Foundation", proportion: 0.4, focusAreas: ["fundamentals", "routine"], objectives: ["Establish the basics and a steady weekly routine"], archetypeKeys: [] },
  { name: "Build", proportion: 0.35, focusAreas: ["progress"], objectives: ["Develop the core skills and build momentum"], archetypeKeys: [] },
  { name: "Final push", proportion: 0.25, focusAreas: ["readiness"], objectives: ["Consolidate and get ready for the target date"], archetypeKeys: [] },
];

export function listMilestones(): StoredMilestone[] {
  return loadState().milestones;
}

/** A full plan produced by Claude, tailored to the specific exam/goal. Dates are
 *  computed deterministically here from each phase's `fraction` of the timeline. */
export interface AIPlan {
  rationale: string;
  phases: { name: string; fraction: number; focus: string[]; objectives: string[] }[];
  activities: { title: string; minutes: number; perWeek: number; energy: "LOW" | "MED" | "HIGH"; timeOfDay: "MORNING" | "MIDDAY" | "EVENING" | "ANY"; phase: number }[];
}

/** Replace a milestone's plan + spawned tasks with a Claude-tailored plan. */
export function replaceWithAIPlan(milestoneId: string, plan: AIPlan, model: string): void {
  const s = loadState();
  const m = s.milestones.find((x) => x.id === milestoneId);
  if (!m || !plan.phases?.length) return;
  const today = DateTime.now().toISODate()!;

  const skeleton = plan.phases.map((p) => ({
    name: p.name,
    proportion: Math.max(0.01, p.fraction || 1),
    focusAreas: p.focus ?? [],
    objectives: p.objectives ?? [],
    archetypeKeys: [],
  }));
  const dated = computeDatedPhases(today, m.targetDate, skeleton, m.weeklyHoursBudget);

  m.plan = {
    rationale: plan.rationale,
    generatedByModel: model,
    phases: dated.map((d, i) => ({
      order: d.order,
      name: plan.phases[i].name,
      startDate: d.startDate,
      endDate: d.endDate,
      objectives: plan.phases[i].objectives ?? [],
      focusAreas: plan.phases[i].focus ?? [],
    })),
  };

  // Re-spawn study tasks from the AI activities for the phase that holds today.
  s.tasks = s.tasks.filter((t) => t.planMilestoneId !== milestoneId);
  const curIdx = dated.findIndex((d) => today >= d.startDate && today <= d.endDate);
  let phaseIdx = curIdx >= 0 ? curIdx : 0;
  if (!plan.activities?.some((a) => a.phase === phaseIdx)) phaseIdx = 0;

  for (const a of plan.activities ?? []) {
    if (a.phase !== phaseIdx) continue;
    const perWeek = Math.min(7, Math.max(1, Math.round(a.perWeek || 3)));
    s.tasks.unshift({
      id: id("task"),
      title: a.title,
      kind: "STUDY",
      priority: 2,
      estimatedMinutes: Math.max(10, Math.round(a.minutes || 25)),
      estimateSource: "APP_SUGGESTED",
      preferredTimeOfDay: a.timeOfDay || "ANY",
      energy: a.energy || "MED",
      status: "PENDING",
      segments: [],
      recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [1, 2, 3, 4, 5, 6, 7].slice(0, perWeek) },
      planMilestoneId: milestoneId,
      createdAt: new Date().toISOString(),
    });
  }
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
  const skeleton = playbook?.phaseSkeleton ?? GENERIC_SKELETON;
  const today = DateTime.now().toISODate()!;

  const milestone: StoredMilestone = {
    id: id("ms"),
    title: input.title,
    domain: input.domain,
    targetDate: input.targetDate,
    details: input.details,
    weeklyHoursBudget: input.weeklyHoursBudget,
  };

  const phases = computeDatedPhases(today, input.targetDate, skeleton, input.weeklyHoursBudget);
  milestone.plan = {
    rationale: "Generic outline. Add your Anthropic API key in Settings so Claudio tailors this plan to your goal and instructions.",
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

  // Only registered playbooks have task archetypes to spawn; generic goals get
  // their tasks from the AI plan instead.
  if (playbook) {
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
