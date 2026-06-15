// Coach Claudio adapter — reads the real training plan from the training-ai repo
// (weekly_plan.json), which lists one planned session per day.

import { DailyDirective, IntegrationAdapter } from "./adapter";
import { fetchRepoJson } from "./source";

const REPO = "training-ai";

// Shape of weekly_plan.json entries (subset we use).
interface PlannedSession {
  day?: string;
  date: string; // ISO yyyy-MM-dd
  sport?: string;
  name: string;
  total_duration_secs?: number;
  planned_tss?: number;
  focus?: string;
  notes?: string;
}

function tssToEnergy(tss?: number): "LOW" | "MED" | "HIGH" {
  if (tss === undefined) return "MED";
  if (tss >= 50) return "HIGH";
  if (tss >= 25) return "MED";
  return "LOW";
}

export const coachClaudioAdapter: IntegrationAdapter = {
  provider: "COACH_CLAUDIO",
  isConfigured: () => true,
  async fetchDailyDirectives(date: string): Promise<DailyDirective[]> {
    const plan = await fetchRepoJson<PlannedSession[]>(REPO, "weekly_plan.json");
    if (!plan) return [];

    return plan
      .filter((s) => s.date === date)
      .map((s) => {
        const minutes = s.total_duration_secs ? Math.round(s.total_duration_secs / 60) : 45;
        return {
          externalId: `coach-${s.date}`,
          provider: "COACH_CLAUDIO" as const,
          title: s.name,
          suggestedMinutes: minutes,
          preferredTimeOfDay: "MORNING" as const,
          energy: tssToEnergy(s.planned_tss),
          segments: [{ type: "ACTIVE" as const, label: s.name, minutes }],
          payload: {
            sport: s.sport,
            focus: s.focus,
            planned_tss: s.planned_tss,
            notes: s.notes,
          },
        };
      });
  },
};
