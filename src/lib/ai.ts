// Claude working behind the UI: parse quick captures, shape chores (incl.
// follow-ups/automations), and decompose goals into a small daily step. All
// calls go straight from the browser to Anthropic with the on-device key.
// Everything degrades gracefully without a key.

import { DateTime } from "luxon";
import { DEFAULT_MODEL, getSettings, Segment, TimeOfDay, Energy } from "./model";
import { suggestEstimateMinutes } from "./estimate";

const URL = "https://api.anthropic.com/v1/messages";

export function hasApiKey(): boolean { return Boolean(getSettings().anthropicKey); }

interface Block { type: string; text?: string }
async function call(body: Record<string, unknown>): Promise<string> {
  const { anthropicKey, model } = getSettings();
  if (!anthropicKey) throw new Error("No API key set");
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: model || DEFAULT_MODEL, ...body }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 180)}`);
  const data = (await res.json()) as { content: Block[] };
  return data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}
function parseJson<T>(text: string): T {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T;
}

export async function ping(): Promise<string> {
  return (await call({ max_tokens: 16, messages: [{ role: "user", content: "Reply with the single word: ready" }] })).trim();
}

// ---- Quick capture → a task ----
export interface ParsedCapture { title: string; minutes: number; timeOfDay: TimeOfDay; energy: Energy; latestInDays: number }

export async function parseCapture(text: string): Promise<ParsedCapture> {
  if (!hasApiKey()) {
    return { title: text.trim(), minutes: suggestEstimateMinutes(text), timeOfDay: "ANY", energy: "MED", latestInDays: 5 };
  }
  const out = parseJson<ParsedCapture>(await call({
    max_tokens: 300,
    system:
      `Today is ${DateTime.now().toFormat("cccc, dd LLL")}. Turn the user's quick note into one task. ` +
      'Return ONLY JSON {"title":string,"minutes":number,"timeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","energy":"LOW"|"MED"|"HIGH","latestInDays":number}. ' +
      "latestInDays = how many days from today it should be done by (default 5; 0 if it says today, 1 if tomorrow). Keep the title short. No prose.",
    messages: [{ role: "user", content: text }],
  }));
  return {
    title: out.title || text.trim(),
    minutes: Math.max(5, Number(out.minutes) || 20),
    timeOfDay: out.timeOfDay || "ANY",
    energy: out.energy || "MED",
    latestInDays: Math.max(0, Math.min(5, Number(out.latestInDays ?? 5))),
  };
}

// ---- Describe a chore → one or more chores (incl. next-day follow-ups) ----
export interface ConfiguredChore {
  title: string; minutes: number; timeOfDay: TimeOfDay; energy: Energy;
  cadence: { freq: "DAILY" | "WEEKLY" | "MONTHLY"; byWeekday?: number[] };
  segments?: Segment[]; automationNote?: string;
}

export async function configureChores(text: string): Promise<ConfiguredChore[]> {
  const now = DateTime.now();
  const out = parseJson<{ chores: ConfiguredChore[] }>(await call({
    max_tokens: 1100,
    system:
      `Today is ${now.toISODate()} (${now.toFormat("cccc")}); weekdays 1=Mon..7=Sun. ` +
      "Configure one or more recurring chores from the description. " +
      'Return ONLY JSON {"chores":[{"title":string,"minutes":number,"timeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","energy":"LOW"|"MED"|"HIGH","cadence":{"freq":"DAILY"|"WEEKLY"|"MONTHLY","byWeekday":[1-7]},"segments":[{"type":"ACTIVE"|"PASSIVE","label":string,"minutes":number}]|null,"automationNote":string|null}]}. ' +
      "Same-day multi-stage work with waiting (e.g. laundry: load → dry → fold shortly after) is ONE chore with segments. A follow-up on a LATER day (e.g. 'fold the next day') is a SEPARATE chore recurring on the following weekday. Put any reminder/automation intent in automationNote. No prose.",
    messages: [{ role: "user", content: text }],
  }));
  const chores = Array.isArray(out.chores) ? out.chores : [];
  if (!chores.length) throw new Error("No chores parsed");
  return chores.map((c) => ({ ...c, minutes: Math.max(5, Number(c.minutes) || 20) }));
}

// ---- Goal → recurring daily step ----
export interface GoalStep { stepTitle: string; stepMinutes: number; daysPerWeek: number; timeOfDay: TimeOfDay; energy: Energy; rationale: string }

export async function generateGoalStep(input: { title: string; description: string; targetDate: string; hoursPerWeek: number }): Promise<GoalStep> {
  if (!hasApiKey()) {
    const perWeek = 4;
    return { stepTitle: `Work on ${input.title}`, stepMinutes: Math.max(15, Math.round((input.hoursPerWeek * 60) / perWeek)), daysPerWeek: perWeek, timeOfDay: "ANY", energy: "MED", rationale: "Generic step — add an API key in Settings for a tailored plan." };
  }
  const out = parseJson<GoalStep>(await call({
    max_tokens: 500,
    system:
      `Today is ${DateTime.now().toISODate()}; the target date is ${input.targetDate}; about ${input.hoursPerWeek} hours/week available. ` +
      "Design the single most effective SMALL recurring step toward this specific goal — something doable most days. Use the person's own description; include only what the goal actually requires. " +
      'Return ONLY JSON {"stepTitle":string,"stepMinutes":number,"daysPerWeek":1-7,"timeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","energy":"LOW"|"MED"|"HIGH","rationale":string}. rationale is one sentence referencing the goal. No prose.',
    messages: [{ role: "user", content: `Goal: ${input.title}\nMy context: ${input.description || "(none)"}` }],
  }));
  return {
    stepTitle: out.stepTitle || `Work on ${input.title}`,
    stepMinutes: Math.max(10, Number(out.stepMinutes) || 25),
    daysPerWeek: Math.max(1, Math.min(7, Number(out.daysPerWeek) || 4)),
    timeOfDay: out.timeOfDay || "ANY",
    energy: out.energy || "MED",
    rationale: out.rationale || "",
  };
}
