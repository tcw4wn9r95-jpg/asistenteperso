// STUB adapter for "Coach Claudio" (training). Returns mock training directives
// keyed off the weekday so the day looks realistic. Replace the body of
// fetchDailyDirectives with a real API call (and flip isConfigured) later.

import { DateTime } from "luxon";
import { DailyDirective, IntegrationAdapter } from "./adapter";

const WEEKLY_PLAN: Record<number, Omit<DailyDirective, "externalId" | "provider"> | null> = {
  1: { title: "Lower-body strength", suggestedMinutes: 45, preferredTimeOfDay: "MORNING", energy: "HIGH", segments: [{ type: "ACTIVE", label: "lower-body session", minutes: 45 }], payload: { focus: "legs", sets: 5 } },
  2: { title: "Easy mobility & core", suggestedMinutes: 25, preferredTimeOfDay: "EVENING", energy: "LOW", segments: [{ type: "ACTIVE", label: "mobility + core", minutes: 25 }], payload: { focus: "recovery" } },
  3: { title: "Upper-body strength", suggestedMinutes: 45, preferredTimeOfDay: "MORNING", energy: "HIGH", segments: [{ type: "ACTIVE", label: "upper-body session", minutes: 45 }], payload: { focus: "push/pull", sets: 5 } },
  4: null, // rest day
  5: { title: "Conditioning intervals", suggestedMinutes: 35, preferredTimeOfDay: "MORNING", energy: "HIGH", segments: [{ type: "ACTIVE", label: "intervals", minutes: 35 }], payload: { focus: "conditioning" } },
  6: { title: "Long easy walk/jog", suggestedMinutes: 50, preferredTimeOfDay: "ANY", energy: "MED", segments: [{ type: "ACTIVE", label: "easy aerobic", minutes: 50 }], payload: { focus: "aerobic" } },
  7: null, // rest day
};

export const coachClaudioAdapter: IntegrationAdapter = {
  provider: "COACH_CLAUDIO",
  isConfigured: () => false,
  async fetchDailyDirectives(date: string): Promise<DailyDirective[]> {
    const weekday = DateTime.fromISO(date).weekday; // 1..7
    const plan = WEEKLY_PLAN[weekday];
    if (!plan) return [];
    return [
      {
        externalId: `coach-${date}`,
        provider: "COACH_CLAUDIO",
        ...plan,
      },
    ];
  },
};
