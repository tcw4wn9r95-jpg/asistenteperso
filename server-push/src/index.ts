// Claudio reminder service — a tiny Cloudflare Worker so reminders fire even when
// the app is closed. It holds each device's push subscription + the next 7 days of
// reminder times (uploaded by the app whenever the plan changes) in KV, and a
// per-minute cron sends due notifications via Web Push. It never sees the user's
// data — only "send this title at this timestamp".

import { buildPushPayload } from "@block65/webcrypto-web-push";

interface Sub { endpoint: string; expirationTime: number | null; keys: { auth: string; p256dh: string } }
interface Reminder { id: string; at: number; title: string; body: string }
interface Record { subscription: Sub; reminders: Reminder[]; sent?: string[] }
interface Env { SUBS: KVNamespace; VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string }

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "sub:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function send(env: Env, subscription: Sub, payload: object): Promise<"ok" | "gone" | "error"> {
  try {
    const built = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl: 120 } },
      subscription,
      { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    );
    const res = await fetch(subscription.endpoint!, { method: "POST", headers: built.headers, body: built.body });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/vapidPublicKey")
      return new Response(env.VAPID_PUBLIC_KEY, { headers: { ...CORS, "content-type": "text/plain" } });

    if (req.method === "POST" && url.pathname === "/sync") {
      const { subscription, reminders } = (await req.json()) as { subscription: Sub; reminders: Reminder[] };
      if (!subscription?.endpoint) return json({ error: "no subscription" }, 400);
      const k = await keyFor(subscription.endpoint);
      const prev = await env.SUBS.get<Record>(k, "json");
      // Preserve "already sent" flags for reminders that still exist.
      const sent = (prev?.sent ?? []).filter((id) => reminders.some((r) => r.id === id));
      await env.SUBS.put(k, JSON.stringify({ subscription, reminders, sent }), { expirationTtl: 60 * 60 * 24 * 30 });
      return json({ ok: true, count: reminders.length });
    }

    if (req.method === "POST" && url.pathname === "/unsubscribe") {
      const { endpoint } = (await req.json()) as { endpoint: string };
      if (endpoint) await env.SUBS.delete(await keyFor(endpoint));
      return json({ ok: true });
    }

    if (req.method === "POST" && url.pathname === "/test") {
      const { subscription } = (await req.json()) as { subscription: Sub };
      const r = await send(env, subscription, { title: "Claudio", body: "Test reminder — you're all set ✓", url: "/" });
      return json({ ok: r === "ok" }, r === "ok" ? 200 : 502);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = Date.now();
    let cursor: string | undefined;
    do {
      const list = await env.SUBS.list({ prefix: "sub:", cursor });
      cursor = list.list_complete ? undefined : list.cursor;
      for (const { name } of list.keys) {
        const rec = await env.SUBS.get<Record>(name, "json");
        if (!rec) continue;
        const sent = new Set(rec.sent ?? []);
        let dead = false, changed = false;
        for (const r of rec.reminders ?? []) {
          // Fire reminders whose time arrived in the last 5 minutes, once each.
          if (r.at <= now && now - r.at <= 5 * 60 * 1000 && !sent.has(r.id)) {
            const result = await send(env, rec.subscription, { title: r.title, body: r.body, tag: r.id, url: "/" });
            if (result === "gone") { dead = true; break; }
            if (result === "ok") { sent.add(r.id); changed = true; }
          }
        }
        if (dead) { await env.SUBS.delete(name); continue; }
        // Keep 6h of history so dedupe holds, then prune.
        const reminders = (rec.reminders ?? []).filter((r) => r.at > now - 6 * 60 * 60 * 1000);
        if (changed || reminders.length !== (rec.reminders ?? []).length) {
          const sentArr = [...sent].filter((id) => reminders.some((r) => r.id === id));
          await env.SUBS.put(name, JSON.stringify({ subscription: rec.subscription, reminders, sent: sentArr }), { expirationTtl: 60 * 60 * 24 * 30 });
        }
      }
    } while (cursor);
  },
};
