// Deterministic timeline math. Given a start date, the milestone target date,
// and a playbook's phase proportions, compute concrete dated phase ranges by
// distributing the available days across phases in order. The LLM never does
// this arithmetic — it only specializes the result.

import { DateTime } from "luxon";
import { PhaseSkeleton } from "./playbooks/types";

export interface DatedPhase {
  order: number;
  name: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;
  focusAreas: string[];
  objectives: string[];
  archetypeKeys: string[];
  /** Estimated weekly hours this phase implies, given the budget. */
  weeklyHours: number;
}

/**
 * @param startISO  yyyy-MM-dd (typically today)
 * @param targetISO yyyy-MM-dd (the exam/event date)
 * @param weeklyHoursBudget hours/week the user can commit
 */
export function computeDatedPhases(
  startISO: string,
  targetISO: string,
  phases: PhaseSkeleton[],
  weeklyHoursBudget: number,
): DatedPhase[] {
  const start = DateTime.fromISO(startISO);
  const target = DateTime.fromISO(targetISO);
  const totalDays = Math.max(1, Math.round(target.diff(start, "days").days));

  const totalProportion = phases.reduce((s, p) => s + p.proportion, 0) || 1;

  const dated: DatedPhase[] = [];
  let cursorDays = 0;

  phases.forEach((phase, i) => {
    const share = phase.proportion / totalProportion;
    // Last phase absorbs rounding so the final phase ends exactly on target.
    const phaseDays =
      i === phases.length - 1
        ? totalDays - cursorDays
        : Math.max(1, Math.round(totalDays * share));

    const phaseStart = start.plus({ days: cursorDays });
    const phaseEnd = start.plus({ days: cursorDays + phaseDays - 1 });

    dated.push({
      order: i,
      name: phase.name,
      startDate: phaseStart.toISODate()!,
      endDate: phaseEnd.toISODate()!,
      focusAreas: phase.focusAreas,
      objectives: phase.objectives,
      archetypeKeys: phase.archetypeKeys,
      weeklyHours: weeklyHoursBudget,
    });

    cursorDays += phaseDays;
  });

  return dated;
}
