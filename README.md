# Claudio

> A calm weekly companion that always knows the next right thing — and quietly reshuffles when life happens.

A **flexible momentum engine**, not a rigid scheduler. It's a zero-backend static
PWA (GitHub Pages), on-device data, with Claude working *behind* the UI.

## What it does

- **Week at a glance** — your whole week in one screen; today first.
- **Quick capture** — type anything ("call the dentist") and it's auto-placed on the
  best day within the next few days.
- **Goals → daily steps** — set a goal + date; Claude designs one small recurring step
  and weaves it through your week; progress + streak per goal.
- **Chores** — recurring upkeep with multi-stage waits (laundry: load → dry → fold) and
  Claude-shaped follow-ups ("fold the next day").
- **Self-healing** — items have flex windows; miss a day and undone work **rolls forward**
  and rebalances, then shows a short "moved N forward" summary. One off day never derails.
- **Momentum** — streaks grounded in the science of consistency over perfection.
- **Reminders** — a live "Up next" + a notification at an item's time. Optionally
  fire **even when the app is closed** via the free push service in `server-push/`.
- **Coach Claudio** — your workouts appear on the right day (reads `training-ai`'s JSON).

## Architecture

| Concern | How |
|---|---|
| Hosting | Static export → **GitHub Pages** (`.github/workflows/deploy.yml`) |
| Data | On-device `localStorage` (`src/lib/model.ts`) — no backend, no login |
| Planner | `src/lib/planner.ts` — week-level self-healing assignment + the pure intraday scheduler (`src/server/scheduling`) |
| AI | Claude direct from the browser with your key (`src/lib/ai.ts`) — capture, chores, goal steps |
| Integrations | `src/server/integrations` reads Coach Claudio's committed JSON |
| Closed-app push | Optional Cloudflare Worker (`server-push/`) — KV + per-minute cron sends Web Push; see its README |

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # scheduler/backward-pass unit tests
npm run build    # static export → ./out
```

No env/database needed. Add an Anthropic API key in **Settings** to enable the smart
capture, chore setup and goal plans (stored on-device, sent straight to Anthropic).
Set your real **available hours** in Settings so the day/time placement makes sense.

Deploys on push via GitHub Actions (Settings → Pages → Source: GitHub Actions).
