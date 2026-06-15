// Produces an expert-grade, phased plan for a milestone.
//
// 1. Deterministic backward pass owns the timeline (dated phases) — zero AI
//    variance, always feasible.
// 2. Claude (grounded by the playbook) *specializes only*: personalizes phase
//    objectives to the learner's context and returns Zod-validated JSON.
// 3. When AI is unavailable we fall back to the playbook's default objectives,
//    so the feature still works offline.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, isAiConfigured, PLAN_MODEL } from "@/server/ai/client";
import { getPlaybookForDomain, Playbook } from "./playbooks";
import { computeDatedPhases, DatedPhase } from "./backwardPass";

export interface GeneratePlanInput {
  domain: string;
  startISO: string;
  targetISO: string;
  weeklyHoursBudget: number;
  /** Free-form milestone context, e.g. { currentLevel, target, weakAreas }. */
  details: Record<string, unknown>;
}

export interface GeneratedPhase extends DatedPhase {}

export interface GeneratedPlan {
  playbookKey: string;
  generatedByModel: string | null;
  rationale: string;
  phases: GeneratedPhase[];
}

// Claude may only refine objectives per phase (by order) and write a rationale.
// It cannot change dates, ordering, or phase count.
const specializationSchema = z.object({
  rationale: z.string(),
  phases: z.array(
    z.object({
      order: z.number().int(),
      objectives: z.array(z.string()).min(1),
    }),
  ),
});

export async function generatePlan(input: GeneratePlanInput): Promise<GeneratedPlan> {
  const playbook = getPlaybookForDomain(input.domain);
  if (!playbook) {
    throw new Error(`No expert playbook registered for domain ${input.domain}`);
  }

  const datedPhases = computeDatedPhases(
    input.startISO,
    input.targetISO,
    playbook.phaseSkeleton,
    input.weeklyHoursBudget,
  );

  if (!isAiConfigured()) {
    return {
      playbookKey: playbook.key,
      generatedByModel: null,
      rationale:
        "Plan generated from the expert playbook skeleton (AI specialization unavailable).",
      phases: datedPhases,
    };
  }

  try {
    const specialized = await specializeWithClaude(playbook, datedPhases, input);
    const byOrder = new Map(specialized.phases.map((p) => [p.order, p.objectives]));
    const phases = datedPhases.map((p) => ({
      ...p,
      objectives: byOrder.get(p.order) ?? p.objectives,
    }));
    return {
      playbookKey: playbook.key,
      generatedByModel: PLAN_MODEL,
      rationale: specialized.rationale,
      phases,
    };
  } catch {
    // Any AI/validation failure → deterministic fallback. Never block the user.
    return {
      playbookKey: playbook.key,
      generatedByModel: null,
      rationale:
        "Plan generated from the expert playbook skeleton (AI specialization failed; using defaults).",
      phases: datedPhases,
    };
  }
}

async function specializeWithClaude(
  playbook: Playbook,
  datedPhases: DatedPhase[],
  input: GeneratePlanInput,
): Promise<z.infer<typeof specializationSchema>> {
  const anthropic = getAnthropic();

  const userContent = JSON.stringify({
    learnerContext: input.details,
    weeklyHoursBudget: input.weeklyHoursBudget,
    phases: datedPhases.map((p) => ({
      order: p.order,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      focusAreas: p.focusAreas,
      defaultObjectives: p.objectives,
    })),
  });

  const response = await anthropic.messages.create({
    model: PLAN_MODEL,
    max_tokens: 1500,
    system: `${playbook.groundingPrompt}\n\nReturn ONLY a JSON object matching: {"rationale": string, "phases": [{"order": number, "objectives": string[]}]}. Keep the same phase orders. Do not add prose outside the JSON.`,
    messages: [
      {
        role: "user",
        content: `Specialize these phase objectives to the learner. Context and skeleton:\n${userContent}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const json = JSON.parse(extractJson(text));
  return specializationSchema.parse(json);
}

/** Pull the first {...} JSON object out of a model response. */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in response");
  return text.slice(start, end + 1);
}
