// In-app nudges, no backend. A live "Up next" indicator plus real local
// notifications fired when an item's time arrives *while the app is open*
// (the honest limit of the no-backend choice — background push would need a
// server). We avoid double-firing by remembering what we've notified today.

import { DateTime } from "luxon";
import { getSettings } from "./model";
import { PlanItem, WeekPlan, todayISO } from "./planner";

const NOTIFIED_KEY = "claudio-notified";

export function nowMinutes(): number {
  const n = DateTime.now();
  return n.hour * 60 + n.minute;
}

export interface NextUp { item: PlanItem; when: "now" | "next" }

/** The thing happening now, else the next not-done item with a time today. */
export function nextUp(week: WeekPlan): NextUp | null {
  const day = week.days.find((d) => d.date === todayISO());
  if (!day) return null;
  const now = nowMinutes();
  const undone = day.items.filter((i) => !i.outcome && i.startMin != null);
  const current = undone.find((i) => i.startMin! <= now && (i.endMin ?? i.startMin! + i.minutes) > now);
  if (current) return { item: current, when: "now" };
  const upcoming = undone.filter((i) => i.startMin! > now).sort((a, b) => a.startMin! - b.startMin!)[0];
  return upcoming ? { item: upcoming, when: "next" } : null;
}

export function remindersOn(): boolean {
  return Boolean(getSettings().remindersEnabled) &&
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

function notifiedToday(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}") as { date?: string; ids?: string[] };
    if (raw.date === todayISO()) return new Set(raw.ids ?? []);
  } catch { /* ignore */ }
  return new Set();
}
function rememberNotified(ids: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ date: todayISO(), ids: [...ids] }));
}

async function show(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) reg.showNotification(title, { body, icon: "/icon-192.png", tag: title });
    else new Notification(title, { body });
  } catch {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}

/** Fire notifications for today's items whose time just arrived. Call on a timer. */
export function fireDueNudges(week: WeekPlan): void {
  if (!remindersOn()) return;
  const day = week.days.find((d) => d.date === todayISO());
  if (!day) return;
  const now = nowMinutes();
  const done = notifiedToday();
  let changed = false;
  for (const it of day.items) {
    if (it.outcome || it.startMin == null || done.has(it.id)) continue;
    // Within the last ~2 minutes of its start time → it's time.
    if (now >= it.startMin && now - it.startMin <= 2) {
      void show(it.title, `${fmt(it.startMin)} · ${it.minutes} min`);
      done.add(it.id);
      changed = true;
    }
  }
  if (changed) rememberNotified(done);
}

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Ask the OS for notification permission (called from the Settings toggle). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
}
