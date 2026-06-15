// STUB adapter for "NutriPrep" (food). Cooking naturally produces active +
// passive segments (prep -> oven -> plate), reusing the same segment model as
// chores. Replace the body of fetchDailyDirectives with a real API call later.

import { DateTime } from "luxon";
import { DailyDirective, IntegrationAdapter } from "./adapter";

export const nutriPrepAdapter: IntegrationAdapter = {
  provider: "NUTRIPREP",
  isConfigured: () => false,
  async fetchDailyDirectives(date: string): Promise<DailyDirective[]> {
    const weekday = DateTime.fromISO(date).weekday;

    // Sunday: batch-cook the week. Active prep + long passive oven time.
    if (weekday === 7) {
      return [
        {
          externalId: `nutri-batch-${date}`,
          provider: "NUTRIPREP",
          title: "Batch-cook weekday lunches",
          suggestedMinutes: 30,
          preferredTimeOfDay: "MIDDAY",
          energy: "MED",
          segments: [
            { type: "ACTIVE", label: "prep ingredients", minutes: 30 },
            { type: "PASSIVE", label: "oven roasting", minutes: 40 },
            { type: "ACTIVE", label: "portion & store", minutes: 15 },
          ],
          payload: { recipe: "sheet-pan chicken + veg", portions: 5 },
        },
      ];
    }

    // Weekdays: a quick dinner cook in the evening.
    return [
      {
        externalId: `nutri-dinner-${date}`,
        provider: "NUTRIPREP",
        title: "Cook dinner",
        suggestedMinutes: 25,
        preferredTimeOfDay: "EVENING",
        energy: "MED",
        segments: [
          { type: "ACTIVE", label: "cook dinner", minutes: 25 },
        ],
        payload: { recipe: "varies" },
      },
    ];
  },
};
