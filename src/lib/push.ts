// Closed-app reminders via Web Push. The browser subscribes (VAPID), then uploads
// its subscription plus the next 7 days of reminder times to the backend (a tiny
// Cloudflare Worker). A per-minute cron there sends the notification on time —
// even when the app is closed. The schedule is re-uploaded whenever the plan
// changes, so the backend never needs to know anything about the user's data.

import { getSettings, saveSettings } from "./model";
import { WeekPlan, todayISO } from "./planner";
import { inQuietHours, leadMinutes } from "./notify";

export interface Reminder { id: string; at: number; title: string; body: string }

export function pushConfigured(): boolean {
  return Boolean(getSettings().pushUrl) && typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}
export function pushEnabled(): boolean { return Boolean(getSettings().pushEnabled) && pushConfigured(); }

function base(): string { return (getSettings().pushUrl || "").replace(/\/$/, ""); }

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Build future reminders for the visible week (skips done/skipped and past times).
    Honors the configured lead time (fire N minutes early) and quiet hours. */
export function buildReminders(week: WeekPlan): Reminder[] {
  const out: Reminder[] = [];
  const now = Date.now();
  const lead = leadMinutes();
  for (const day of week.days) {
    for (const it of day.items) {
      if (it.outcome || it.startMin == null) continue;
      const fireMin = it.startMin - lead;
      if (inQuietHours(((fireMin % 1440) + 1440) % 1440)) continue;
      const at = new Date(`${day.date}T00:00:00`).getTime() + fireMin * 60000;
      if (at <= now) continue;
      const time = `${String(Math.floor(it.startMin / 60)).padStart(2, "0")}:${String(it.startMin % 60).padStart(2, "0")}`;
      const body = lead > 0 ? `in ${lead < 60 ? `${lead} min` : `${lead / 60} hr`} · ${time}` : `${time} · ${it.minutes} min`;
      out.push({ id: `${day.date}:${it.id}`, at, title: it.title, body });
    }
  }
  return out;
}

async function getSubscription(): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const key = await fetch(`${base()}/vapidPublicKey`).then((r) => r.text());
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.trim()) as BufferSource });
}

/** Turn on closed-app reminders: permission → subscribe → upload schedule. */
export async function enablePush(week: WeekPlan): Promise<void> {
  if (!base()) throw new Error("Set the reminder service URL first.");
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site.");
  const sub = await getSubscription();
  await sync(week, sub);
  saveSettings({ pushEnabled: true });
}

export async function disablePush(): Promise<void> {
  saveSettings({ pushEnabled: false });
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${base()}/unsubscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* best effort */ }
}

async function sync(week: WeekPlan, sub: PushSubscription): Promise<void> {
  await fetch(`${base()}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), reminders: buildReminders(week), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, today: todayISO() }),
  });
}

/** Re-upload the latest schedule (called after the plan changes). Silent on failure. */
export async function syncSchedule(week: WeekPlan): Promise<void> {
  if (!pushEnabled()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sync(week, sub);
  } catch { /* offline — will resync next change */ }
}

/** Ask the backend to send a test push to this device now. */
export async function testPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) throw new Error("Not subscribed yet — enable reminders first.");
  const res = await fetch(`${base()}/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (!res.ok) throw new Error(`Service responded ${res.status}`);
}
