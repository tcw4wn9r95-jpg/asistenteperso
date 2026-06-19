# Claudio reminder service (closed-app push)

A tiny [Cloudflare Worker](https://workers.cloudflare.com) — free tier — that makes
reminders fire **even when the app is closed**. It stores each device's push
subscription plus the next 7 days of reminder times in KV, and a **per-minute cron**
sends each notification when its time arrives.

It’s privacy-light by design: it only ever holds `{ title, body, at }` rows the app
uploads — never your goals, chores, notes, or API key.

```
app (GitHub Pages)  ──POST /sync {subscription, reminders}──▶  Worker + KV
        ▲                                                         │ cron every minute
        └────────────────  Web Push (closed app)  ◀──────────────┘
```

## One-time setup (~5 minutes)

You need a free Cloudflare account. From this folder:

```bash
npm install

# 1. Generate VAPID keys (the push identity). Copy both values.
npm run vapid          # prints { "publicKey": "...", "privateKey": "..." }

# 2. Create the KV store, then paste its id into wrangler.toml (kv_namespaces.id)
npx wrangler kv namespace create SUBS

# 3. In wrangler.toml set VAPID_PUBLIC_KEY to the publicKey from step 1
#    and VAPID_SUBJECT to your "mailto:you@example.com".

# 4. Store the private key as a secret (not committed):
npx wrangler secret put VAPID_PRIVATE_KEY      # paste the privateKey from step 1

# 5. Deploy. Note the printed URL, e.g. https://claudio-push.<you>.workers.dev
npx wrangler deploy
```

## Connect the app

1. Open Claudio → **Settings → Reminders → “…even when the app is closed.”**
2. Paste the Worker URL and flip **Closed-app reminders** on (grant the notification
   prompt). Tap **Send test notification** to confirm.
3. On iPhone you must **Add to Home Screen first** (iOS only allows Web Push for
   installed PWAs, 16.4+). Android/desktop Chrome, Edge and Firefox work directly.

That’s it — the app keeps the schedule in sync automatically every time your plan
changes. The in-app “Up next” nudges keep working with or without this service.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/vapidPublicKey` | public key for the browser subscription |
| POST | `/sync` | `{ subscription, reminders }` — replace this device’s schedule |
| POST | `/test` | `{ subscription }` — send a test push now |
| POST | `/unsubscribe` | `{ endpoint }` — forget this device |

Local run: `npm run dev` (uses Wrangler’s local cron + KV).
