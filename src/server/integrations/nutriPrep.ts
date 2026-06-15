// NutriPrep adapter — reads the real food plan from the nutriprep repo:
//   weekly_menu.json -> day-of cooking tasks (meals needing cooking that day)
//   prep_plan.json   -> the weekly batch-cook session on its prep day
// Both commit JSON to git, so we just fetch them.

import { DateTime } from "luxon";
import { DailyDirective, IntegrationAdapter } from "./adapter";
import { fetchRepoJson, timeToTimeOfDay } from "./source";

const REPO = "nutriprep";

interface Meal {
  slot?: string;
  name: string;
  time?: string;
  cook_minutes_day_of?: number;
}
interface MenuDay {
  day?: string;
  date: string;
  meals?: Meal[];
}
interface PrepPlan {
  week_of?: string;
  prep_day?: string; // e.g. "Sunday"
  prep_start_time?: string;
  total_active_minutes?: number;
  batches?: { id?: string; title?: string }[];
}

function shorten(name: string, max = 40): string {
  const head = name.split(",")[0].trim();
  return head.length > max ? `${head.slice(0, max - 1)}…` : head;
}

export const nutriPrepAdapter: IntegrationAdapter = {
  provider: "NUTRIPREP",
  isConfigured: () => true,
  async fetchDailyDirectives(date: string): Promise<DailyDirective[]> {
    const [menu, prep] = await Promise.all([
      fetchRepoJson<MenuDay[]>(REPO, "weekly_menu.json"),
      fetchRepoJson<PrepPlan>(REPO, "prep_plan.json"),
    ]);

    const directives: DailyDirective[] = [];

    // Day-of cooking from the weekly menu.
    const day = menu?.find((d) => d.date === date);
    for (const meal of day?.meals ?? []) {
      const minutes = meal.cook_minutes_day_of ?? 0;
      if (minutes <= 0) continue; // no cooking needed (e.g. pre-prepped)
      directives.push({
        externalId: `nutri-meal-${date}-${meal.slot ?? meal.name}`,
        provider: "NUTRIPREP",
        title: `Cook ${meal.slot ?? "meal"}: ${shorten(meal.name)}`,
        suggestedMinutes: minutes,
        preferredTimeOfDay: timeToTimeOfDay(meal.time),
        energy: "MED",
        segments: [{ type: "ACTIVE", label: shorten(meal.name), minutes }],
        payload: { slot: meal.slot, time: meal.time },
      });
    }

    // Weekly batch-cook on its prep day. roast/cool time isn't separated in the
    // source, so we model the hands-on block plus a short passive cool/store wait.
    const weekday = DateTime.fromISO(date).toFormat("cccc");
    if (prep?.prep_day && prep.prep_day.toLowerCase() === weekday.toLowerCase()) {
      const active = prep.total_active_minutes ?? 30;
      directives.push({
        externalId: `nutri-batch-${date}`,
        provider: "NUTRIPREP",
        title: `Batch cook (${prep.batches?.length ?? 0} dishes)`,
        suggestedMinutes: active,
        preferredTimeOfDay: timeToTimeOfDay(prep.prep_start_time),
        energy: "MED",
        segments: [
          { type: "ACTIVE", label: "hands-on prep & cook", minutes: active },
          { type: "PASSIVE", label: "cool before storing", minutes: 20 },
          { type: "ACTIVE", label: "portion & store", minutes: 10 },
        ],
        payload: { week_of: prep.week_of, batches: prep.batches?.length },
      });
    }

    return directives;
  },
};
