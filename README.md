# Claudio — Personal Time Assistant

A personal assistant that brings structure to chaotic (newborn-era) days. It plans
your day around big milestones, recurring chores, and what your other apps say you
should do — then lets you review, drag things around, approve, and stay accountable.

It's a **zero-backend static PWA**, the same architecture as your other apps
(**Coach Claudio** / `training-ai` and **NutriPrep**): a static site on GitHub Pages,
data on-device, and integrations read from public JSON in those repos.

## What it does

- **Milestone backward-planning** — enter a goal + date (e.g. "Pass B2 Spanish exam");
  an expert *playbook* + a deterministic backward pass produce dated, sequenced phases
  and spawn the study tasks for the current phase.
- **Smart chores with passive time** — tasks have ACTIVE and PASSIVE segments. Laundry
  (load → *dry* → fold) reserves the drying gap but hands it back so other work fills it.
- **Flexible tasks** — one-off or recurring, priority, preferred time, energy, and an
  app-suggested time estimate.
- **Daily review** — `Build my day` proposes a schedule (auto-schedule + approval gate).
  Drag the ⠿ handle to move a block (15-min snap); moved blocks pin, then `Reflow day`
  rearranges everything else around them. `Approve` to lock it in.
- **Real integrations** — pulls your training from `training-ai/weekly_plan.json` and your
  meals/prep from `nutriprep/weekly_menu.json` + `prep_plan.json`, and fits them into the day.
- **Accountability** — implementation-intention-style check-ins (✓/✗) build streaks.
- **Claudio chatbot** — optional; needs an external Claude endpoint (see below).

## Architecture

| Concern | How |
|---|---|
| Hosting | Static export (`next build` → `out/`) on **GitHub Pages** (`.github/workflows/deploy.yml`) |
| Engine | Pure TypeScript scheduler + planner running **in the browser** (`src/server/scheduling`, `src/server/planning`) |
| Data | **On-device** `localStorage` (`src/lib/store.ts`); no database, no login |
| Integrations | Browser `fetch` of public repo JSON via raw.githubusercontent (CORS-friendly) — `src/server/integrations` |
| AI (optional) | A Claude-backed endpoint (serverless / Action), like AthleteIQ — not required for the core app |

The deterministic engine (`src/lib/engine.ts`) reuses the same pure modules that are unit-tested.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000  (redirects to /today)
```

No env vars or database needed. First run seeds a sample laundry chore so the day isn't empty.

```bash
npm test           # scheduler + backward-pass unit tests
npm run build      # static export into ./out
```

## Deploy (GitHub Pages)

Pushing to the default branch runs `.github/workflows/deploy.yml`, which builds the static
export with `NEXT_PUBLIC_BASE_PATH=/asistenteperso` (the project-page path) and publishes it.
Enable Pages once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Your app will be at `https://<your-user>.github.io/asistenteperso/`.

## Add to your Home Screen (PWA)

Once deployed (HTTPS), open the URL on your phone:
- **iOS (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** menu → **Install app**

It launches full-screen with its own icon. Manifest: `src/app/manifest.ts`; service worker:
`public/sw.js`; icons via `npm run gen:icons` (`scripts/gen-icons.mjs`).

## Enabling the Claudio chatbot

The static app has no server, so the chatbot calls an external Claude-backed endpoint that
holds the API key (a small serverless function or an Action proxy — mirroring AthleteIQ's
"Claude runs in the Action" model). Set `NEXT_PUBLIC_CHAT_ENDPOINT` to that endpoint's URL.
Everything else works without it.
