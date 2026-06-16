// Direct in-browser calls to the Anthropic API. The static app has no server, so
// the user's key (stored on-device via Settings) is sent straight to Anthropic
// with the documented browser-access opt-in header. This powers both the Claudio
// chatbot (tool-calling) and the "describe a task → configure it" feature.

import { DateTime } from "luxon";
import { DEFAULT_MODEL, StoredMilestone } from "./store";
import {
  AIPlan,
  buildDay,
  createTask,
  deleteTask,
  getSettings,
  listMilestones,
  listStreaks,
  listTasks,
  readDay,
} from "./engine";
import { getPlaybookForDomain } from "@/server/planning/playbooks";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}
interface AnthropicResponse {
  content: AnthropicBlock[];
  stop_reason: string;
}
type Message = { role: "user" | "assistant"; content: unknown };

export function hasApiKey(): boolean {
  return Boolean(getSettings().anthropicKey);
}

async function callAnthropic(body: Record<string, unknown>): Promise<AnthropicResponse> {
  const { anthropicKey, model } = getSettings();
  if (!anthropicKey) throw new Error("No API key set");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: model || DEFAULT_MODEL, ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function textOf(content: AnthropicBlock[]): string {
  return content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
}

// ---------- Chatbot (tool-calling) ----------

const TOOLS = [
  { name: "list_tasks", description: "List the user's tasks.", input_schema: { type: "object", properties: {} } },
  {
    name: "create_task",
    description: "Create a task. Times in minutes. Use segments for multi-stage chores with passive waits (e.g. laundry).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["GENERIC", "CHORE", "STUDY"] },
        priority: { type: "integer" },
        preferredTimeOfDay: { type: "string", enum: ["MORNING", "MIDDAY", "EVENING", "ANY"] },
        energy: { type: "string", enum: ["LOW", "MED", "HIGH"] },
        estimatedMinutes: { type: "integer" },
        recurrence: { type: "object", properties: { freq: { type: "string", enum: ["DAILY", "WEEKLY", "MONTHLY"] } } },
      },
      required: ["title"],
    },
  },
  { name: "delete_task", description: "Delete a task by id.", input_schema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  { name: "build_day", description: "Generate/reflow the schedule for a date (yyyy-MM-dd).", input_schema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } },
  { name: "get_day", description: "Read the schedule for a date.", input_schema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] } },
  { name: "get_streaks", description: "Get accountability streaks.", input_schema: { type: "object", properties: {} } },
  { name: "list_milestones", description: "List goals/milestones and their plans.", input_schema: { type: "object", properties: {} } },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_tasks":
      return listTasks().map((t) => ({ id: t.id, title: t.title, kind: t.kind, priority: t.priority, minutes: t.estimatedMinutes, recurrence: t.recurrence?.freq }));
    case "create_task":
      return createTask({
        title: String(input.title),
        kind: (input.kind as "GENERIC" | "CHORE" | "STUDY") ?? "GENERIC",
        priority: (input.priority as number) ?? 3,
        preferredTimeOfDay: (input.preferredTimeOfDay as never) ?? "ANY",
        energy: (input.energy as never) ?? "MED",
        estimatedMinutes: input.estimatedMinutes as number | undefined,
        recurrence: input.recurrence
          ? { freq: (input.recurrence as { freq: "DAILY" | "WEEKLY" | "MONTHLY" }).freq, interval: 1 }
          : undefined,
      });
    case "delete_task":
      deleteTask(String(input.taskId));
      return { ok: true };
    case "build_day":
      return buildDay(String(input.date));
    case "get_day":
      return readDay(String(input.date)) ?? { status: "NONE", blocks: [] };
    case "get_streaks":
      return listStreaks();
    case "list_milestones":
      return listMilestones();
    default:
      return { error: `unknown tool ${name}` };
  }
}

function systemPrompt(): string {
  const today = DateTime.now().toISODate();
  return [
    "You are Claudio, a warm, impeccably composed personal butler and time assistant for a sleep-deprived new parent.",
    `Today is ${today}.`,
    "You manage their day around milestones, chores, training (Coach Claudio) and food (NutriPrep).",
    "Be concise, encouraging, and protective of their time — never over-pack the day.",
    "Use tools to read or change the plan, then confirm briefly what you did.",
  ].join(" ");
}

export async function chat(history: Message[], userText: string): Promise<{ reply: string; history: Message[] }> {
  const messages: Message[] = [...history, { role: "user", content: userText }];
  for (let i = 0; i < 6; i++) {
    const res = await callAnthropic({ max_tokens: 1024, system: systemPrompt(), tools: TOOLS, messages });
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "tool_use") {
      return { reply: textOf(res.content) || "Done.", history: messages };
    }
    const results = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      let out: unknown;
      try {
        out = await runTool(block.name!, (block.input as Record<string, unknown>) ?? {});
      } catch (e) {
        out = { error: e instanceof Error ? e.message : String(e) };
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I did several steps but paused to avoid looping. Anything else?", history: messages };
}

// ---------- Smart task configuration from a free-text description ----------

export interface ConfiguredTask {
  title: string;
  kind: "GENERIC" | "CHORE" | "STUDY";
  priority: number;
  preferredTimeOfDay: "MORNING" | "MIDDAY" | "EVENING" | "ANY";
  energy: "LOW" | "MED" | "HIGH";
  estimatedMinutes: number;
  recurrence?: { freq: "DAILY" | "WEEKLY" | "MONTHLY"; byWeekday?: number[] };
  segments?: { type: "ACTIVE" | "PASSIVE"; label: string; minutes: number }[];
  /** For a one-off follow-up, how many days after today it is due (1 = tomorrow). */
  dueInDays?: number;
}

/**
 * Generate a full plan tailored to ANY specific goal — phases and concrete
 * recurring activities — driven by the user's own description, constraints and
 * starting point. Works for exams, fitness, projects, habits, learning anything.
 * The deterministic backward pass computes the phase dates from each fraction.
 */
export async function generateTailoredPlan(input: {
  title: string;
  domain: StoredMilestone["domain"];
  targetDate: string;
  weeklyHours: number;
  context: string;
}): Promise<AIPlan> {
  const playbook = getPlaybookForDomain(input.domain);
  const today = DateTime.now().toISODate();
  const system = [
    "You are an elite coach and planner. Build a concrete, personalized plan to achieve ONE specific goal by a deadline.",
    "Base the plan primarily on the person's own description, instructions, constraints and starting point — follow them faithfully.",
    "Tailor everything to THIS goal. Do not include components that don't apply to it. If it is an exam, respect that exam's real format and skip sections it doesn't test; if it is a fitness, project, creative or habit goal, structure it appropriately for that.",
    playbook ? `Optional domain methodology you may draw on if relevant: ${playbook.groundingPrompt}` : "",
    `Today is ${today}. The target date is ${input.targetDate}. The person has about ${input.weeklyHours} hours per week.`,
    'Return ONLY a JSON object: {"rationale":string,"phases":[{"name":string,"fraction":number,"focus":string[],"objectives":string[]}],"activities":[{"title":string,"minutes":number,"perWeek":number,"energy":"LOW"|"MED"|"HIGH","timeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","phase":number}]}.',
    "Use 2-4 ordered phases whose `fraction` values are positive and sum to ~1.0 (front-load foundations, finish close to the target). `phase` in each activity is a 0-based index into phases. Make activities concrete, specific to this goal, and fit within the weekly hours. The rationale (1-2 sentences) must reference the specific goal and the person's stated context. No prose outside the JSON.",
  ].filter(Boolean).join(" ");

  const res = await callAnthropic({
    max_tokens: 1800,
    system,
    messages: [{ role: "user", content: `Goal: ${input.title}\nDeadline: ${input.targetDate}\nMy instructions, constraints & starting point:\n${input.context || "(none provided — use sensible best practice for this goal)"}` }],
  });
  const text = textOf(res.content);
  const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as AIPlan;
  if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) throw new Error("Invalid plan from model");
  parsed.activities = Array.isArray(parsed.activities) ? parsed.activities : [];
  return parsed;
}

/**
 * Configure ONE OR MORE tasks from a free-text description. Same-day multi-stage
 * work with waiting time becomes segments of a single task; a follow-up step on a
 * LATER day becomes a separate task. Driven entirely by what the user wrote.
 */
export async function configureTasks(description: string): Promise<ConfiguredTask[]> {
  const now = DateTime.now();
  const res = await callAnthropic({
    max_tokens: 1100,
    system:
      "You configure one or more scheduling tasks from the user's description. " +
      `Today is ${now.toISODate()} (${now.toFormat("cccc")}). Weekdays are 1=Mon..7=Sun. ` +
      'Return ONLY JSON: {"tasks":[{"title":string,"kind":"GENERIC"|"CHORE"|"STUDY","priority":1-4,"preferredTimeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","energy":"LOW"|"MED"|"HIGH","estimatedMinutes":number,"recurrence":{"freq":"DAILY"|"WEEKLY"|"MONTHLY","byWeekday":[1-7]}|null,"segments":[{"type":"ACTIVE"|"PASSIVE","label":string,"minutes":number}]|null,"dueInDays":number|null}]}. ' +
      "Rules: (1) Multi-stage work with waiting on the SAME day (e.g. laundry: load → drying wait → fold shortly after) is ONE task with segments. " +
      "(2) If the user wants a follow-up step on a LATER day (e.g. 'fold the next day'), make it a SEPARATE task: if the main task recurs weekly on a weekday, the follow-up recurs weekly on the following weekday; if the main task is one-off, set the follow-up's dueInDays to the offset (1 = tomorrow). " +
      "Only create the tasks the description implies. No prose outside the JSON.",
    messages: [{ role: "user", content: description }],
  });
  const text = textOf(res.content);
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { tasks?: ConfiguredTask[] };
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];
  if (tasks.length === 0) throw new Error("No tasks returned");
  return tasks.map((t) => ({
    ...t,
    priority: Math.min(4, Math.max(1, Number(t.priority) || 3)),
    estimatedMinutes: Math.max(5, Number(t.estimatedMinutes) || 30),
  }));
}
