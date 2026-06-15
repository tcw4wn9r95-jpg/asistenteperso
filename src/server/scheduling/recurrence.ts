// Decides whether a recurring task is active on a given date. Kept tiny and
// pure; covers the cadences the UI exposes (daily / weekly-by-weekday / monthly).

import { DateTime } from "luxon";

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  byWeekday?: number[] | null; // ISO weekdays 1..7
}

export function occursOn(rule: RecurrenceRule, dateISO: string): boolean {
  const dt = DateTime.fromISO(dateISO);
  switch (rule.freq) {
    case "DAILY":
      return true;
    case "WEEKLY":
      return rule.byWeekday ? rule.byWeekday.includes(dt.weekday) : true;
    case "MONTHLY":
      return dt.day === 1; // simple: first of the month
    default:
      return false;
  }
}
