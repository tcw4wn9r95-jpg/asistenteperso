// Tool definitions for the Claudio chatbot and their server-side dispatch.
// Every tool is scoped to the resolved user. Schedule mutations keep the day
// reviewable (status reflects edits) rather than silently committing.

import type Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { suggestEstimateMinutes } from "@/lib/estimate";
import { generateDayPlan, readDayPlan } from "@/server/scheduling/dayPlanService";

export const claudioTools: Anthropic.Tool[] = [
  {
    name: "get_day_schedule",
    description: "Read the user's schedule for a date (yyyy-MM-dd). Use to answer questions about the day.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "yyyy-MM-dd" } },
      required: ["date"],
    },
  },
  {
    name: "generate_day",
    description: "Regenerate (reflow) the schedule proposal for a date, respecting locked blocks.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "yyyy-MM-dd" } },
      required: ["date"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task. If estimatedMinutes is omitted the app suggests one.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["GENERIC", "CHORE", "STUDY"] },
        priority: { type: "integer", minimum: 1, maximum: 4 },
        estimatedMinutes: { type: "integer" },
        preferredTimeOfDay: { type: "string", enum: ["MORNING", "MIDDAY", "EVENING", "ANY"] },
        energy: { type: "string", enum: ["LOW", "MED", "HIGH"] },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done by its id.",
    input_schema: {
      type: "object",
      properties: { taskId: { type: "string" } },
      required: ["taskId"],
    },
  },
  {
    name: "get_unscheduled_tasks",
    description: "List the user's pending tasks (for insight on backlog).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_streaks",
    description: "Get the user's accountability streaks for deriving insights.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "get_day_schedule":
      return readDayPlan(userId, String(input.date));
    case "generate_day":
      return generateDayPlan(userId, String(input.date));
    case "create_task": {
      const title = String(input.title);
      const kind = (input.kind as string) ?? "GENERIC";
      return prisma.task.create({
        data: {
          userId,
          title,
          kind,
          priority: (input.priority as number) ?? 3,
          estimatedMinutes:
            (input.estimatedMinutes as number) ?? suggestEstimateMinutes(title, kind),
          estimateSource: input.estimatedMinutes ? "USER" : "APP_SUGGESTED",
          preferredTimeOfDay: (input.preferredTimeOfDay as string) ?? "ANY",
          energy: (input.energy as string) ?? "MED",
        },
      });
    }
    case "complete_task":
      return prisma.task.update({
        where: { id: String(input.taskId) },
        data: { status: "DONE" },
      });
    case "get_unscheduled_tasks":
      return prisma.task.findMany({
        where: { userId, status: "PENDING" },
        select: { id: true, title: true, kind: true, priority: true, estimatedMinutes: true },
      });
    case "query_streaks":
      return prisma.streak.findMany({ where: { userId }, orderBy: { current: "desc" } });
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export function systemPrompt(): string {
  const today = DateTime.now().toISODate();
  return [
    "You are Claudio, a warm, concise personal time-management assistant for a sleep-deprived new parent.",
    `Today is ${today}.`,
    "You help organize the day around milestones, chores, training (Coach Claudio) and food (NutriPrep).",
    "Be encouraging and realistic — the user has a newborn, so protect slack and never over-pack.",
    "Use tools to read or change the plan. After changes, briefly confirm what you did.",
    "When asked for insights, query the schedule/streaks and reason over them.",
  ].join(" ");
}
