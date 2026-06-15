// Direct in-browser calls to the Anthropic API. The static app has no server, so
// the user's key (stored on-device via Settings) is sent straight to Anthropic
// with the documented browser-access opt-in header. This powers both the Claudio
// chatbot (tool-calling) and the "describe a task → configure it" feature.

import { DateTime } from "luxon";
import { DEFAULT_MODEL, StoredMilestone } from "./store";
import {
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
}

/**
 * Personalize a milestone's plan with Claude — grounded by the expert playbook so
 * the result is specialized, not a generic AI study plan. Returns a new rationale
 * and per-phase objectives; the deterministic dates/order are never touched.
 */
export async function specializePlan(
  milestone: StoredMilestone,
): Promise<{ rationale: string; phases: { order: number; objectives: string[] }[] }> {
  const playbook = getPlaybookForDomain(milestone.domain);
  const phases = milestone.plan?.phases ?? [];
  const ctx = JSON.stringify({
    goal: milestone.title,
    targetDate: milestone.targetDate,
    weeklyHours: milestone.weeklyHoursBudget,
    context: milestone.details,
    phases: phases.map((p) => ({ order: p.order, name: p.name, focusAreas: p.focusAreas, start: p.startDate, end: p.endDate })),
  });
  const res = await callAnthropic({
    max_tokens: 1200,
    system:
      (playbook?.groundingPrompt ?? "You are an expert coach.") +
      ' Return ONLY JSON: {"rationale":string,"phases":[{"order":number,"objectives":string[]}]}. ' +
      "Keep the same phase orders and dates; only write concrete, personalized objectives for the learner. No prose outside JSON.",
    messages: [{ role: "user", content: `Specialize these phase objectives to the learner:\n${ctx}` }],
  });
  const text = textOf(res.content);
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export async function configureTask(description: string): Promise<ConfiguredTask> {
  const res = await callAnthropic({
    max_tokens: 700,
    system:
      "You configure a single scheduling task from the user's description. Return ONLY a JSON object: " +
      '{"title":string,"kind":"GENERIC"|"CHORE"|"STUDY","priority":1-4,"preferredTimeOfDay":"MORNING"|"MIDDAY"|"EVENING"|"ANY","energy":"LOW"|"MED"|"HIGH","estimatedMinutes":number,"recurrence":{"freq":"DAILY"|"WEEKLY"|"MONTHLY","byWeekday":[1-7]}|null,"segments":[{"type":"ACTIVE"|"PASSIVE","label":string,"minutes":number}]|null}. ' +
      "Model multi-stage tasks with passive waits as segments (e.g. laundry: ACTIVE load, PASSIVE drying, ACTIVE fold). Keep it realistic. No prose.",
    messages: [{ role: "user", content: description }],
  });
  const text = textOf(res.content);
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as ConfiguredTask;
  // Coerce/guard the essentials.
  parsed.priority = Math.min(4, Math.max(1, Number(parsed.priority) || 3));
  parsed.estimatedMinutes = Math.max(5, Number(parsed.estimatedMinutes) || 30);
  return parsed;
}
