# Claudio — Personal Time Assistant

A personal assistant that brings structure to chaotic, newborn-disrupted days. It
plans **backwards from your milestones**, schedules **recurring chores** intelligently
(including multi-stage tasks with hands-free waits like laundry drying), pulls each
day's items from your **training** and **food** apps, and proposes a day you review
and approve every morning. A chatbot, **Claudio**, edits the plan and derives insights.

> Status: **groundwork / working MVP**. The deterministic core (scheduling, backward
> planning, integrations, accountability) runs fully offline; AI features (plan
> personalization + chatbot) activate when an Anthropic API key is present.

## What it does

- **Milestone backward-planning** — enter a goal (e.g. "pass B2 Spanish exam by DATE").
  A deterministic backward pass lays out dated phases from a codified **expert playbook**;
  Claude then *specializes* (never invents) the objectives. See `src/server/planning/`.
- **Smart chores with passive gaps** — a chore like laundry is modeled as
  `ACTIVE(load) → PASSIVE(dry) → ACTIVE(fold)`. The drying time is reserved on the clock
  but handed back to the scheduler, so other work back-fills the gap.
  See `src/server/scheduling/segments.ts`.
- **Flexible task entry** — any task with priority, cadence/recurrence, preferred time,
  energy, and an **app-suggested time estimate** (`src/lib/estimate.ts`).
- **Daily review with an approval gate** — the scheduler proposes a `PENDING` day; you
  approve or rearrange it. Nothing is committed until you say so. UI: `src/app/today`.
- **Integrations (stubbed)** — Coach Claudio (training) and NutriPrep (food) implement a
  single adapter contract returning mock data today; real APIs drop in later without
  rework. See `src/server/integrations/`.
- **Accountability** — implementation intentions + check-ins + adaptive streaks
  (`src/server/accountability/streaks.ts`).
- **Claudio chatbot** — Claude with tool-calling to read/modify the plan
  (`src/server/ai/`).

## Tech stack

Next.js 15 (App Router) · TypeScript · Prisma · SQLite (dev) / Postgres (prod) ·
Anthropic Claude · Luxon · Zod · Vitest.

## Getting started

```bash
npm install
cp .env.example .env        # set AUTH_SECRET (openssl rand -base64 32); add ANTHROPIC_API_KEY for AI
npm run db:push             # create the dev database
npm run db:seed             # seed your user, expert playbooks, and sample chores
npm run dev                 # http://localhost:3000
```

Then:

1. Open `http://localhost:3000` → you're redirected to **/login**.
2. Sign in with the seeded dev account: **dcasares.silva@gmail.com** / **claudio**.
3. On **Today**, tap **Build my day** to generate a proposal.
4. **Drag the ⠿ handle** on any block to move it (snaps to 15 min) — moved blocks pin in
   place. Tap **Reflow day** to rearrange everything else around your pinned blocks, then
   **Approve**. Use ✓ / ✗ on a block to log a check-in (builds streaks).

> Auth is Auth.js (credentials). Every API route is gated by middleware; change the dev
> password by editing `DEV_PASSWORD` in `prisma/seed.ts` and reseeding.

### Enabling the Claudio chatbot (Claude)

The app runs fully without AI. To switch it on:

1. Put your key in `.env`: `ANTHROPIC_API_KEY="sk-ant-..."` (optionally set `CHAT_MODEL` /
   `PLAN_MODEL`).
2. Restart `npm run dev`.
3. Open **Claudio** — the offline banner disappears (status comes from `GET /api/health`).
   Try: *"build my day"*, *"add a 20-minute call this afternoon"*, *"how are my streaks?"*.

Without a key, milestone plans fall back to the deterministic playbook skeleton and the
chat replies with an "AI offline" notice.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (scheduler + backward pass) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` / `db:seed` / `db:reset` | Prisma schema / seed / reset |

## Project layout

```
prisma/schema.prisma            data model (SQLite dev, Postgres-ready)
prisma/seed.ts                  user + playbooks + sample chores
src/app/                        UI screens + API route handlers
src/server/scheduling/          free windows, free-time pool, passive interleaving, scheduler
src/server/planning/            expert playbooks + backward pass + plan generation
src/server/integrations/        adapter contract + Coach Claudio / NutriPrep stubs
src/server/ai/                  Claude client, Claudio tools, chat loop
src/server/accountability/      check-ins + streaks
```

## Going to production

- Switch `datasource.provider` in `prisma/schema.prisma` to `postgresql` and point
  `DATABASE_URL` at Postgres; the schema migrates cleanly.
- Add real authentication (every table already carries `userId`, so a second account —
  e.g. a co-parent — is additive).
- Replace the integration stubs' `fetchDailyDirectives` bodies with real API calls and
  flip `isConfigured()`.

## Tests

```bash
npm test
```

Covers the laundry passive-interleaving + gap back-fill, overflow handling, time-of-day
placement, and the backward-pass date math.
