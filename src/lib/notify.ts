// Shared notification-timing rules, used by both the in-app nudges (nudges.ts)
// and the closed-app push schedule (push.ts) so they always agree on *when* a
// reminder should fire: a configurable lead time before the item's start, and
// optional quiet hours during which nothing fires.

import { getSettings } from "./model";

/** Minutes before an item's start time to notify (0 = exactly at the time). */
export function leadMinutes(): number {
  const v = getSettings().notifyLeadMin;
  return typeof v === "number" && v >= 0 ? v : 0;
}

function toMin(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** True if the given minute-of-day falls inside the user's quiet hours. */
export function inQuietHours(minOfDay: number): boolean {
  const s = getSettings();
  const start = toMin(s.quietStart);
  const end = toMin(s.quietEnd);
  if (start == null || end == null || start === end) return false;
  // Same-day window (e.g. 13:00–14:00) vs overnight window (e.g. 22:00–07:00).
  return start < end ? minOfDay >= start && minOfDay < end : minOfDay >= start || minOfDay < end;
}

/** A short human label for the lead time, e.g. "at the time" / "10 min before". */
export function leadLabel(lead = leadMinutes()): string {
  if (lead <= 0) return "at the time";
  if (lead % 60 === 0) return `${lead / 60} hr before`;
  return `${lead} min before`;
}
