// An ExpertPlaybook is codified domain methodology. It constrains the LLM so
// generated plans are expert-grade and consistent, not generic. The deterministic
// backward pass owns the timeline math; Claude only specializes the skeleton.

export interface TaskArchetype {
  key: string;
  title: string;
  kind: "STUDY" | "GENERIC" | "CHORE";
  estimatedMinutes: number;
  energy: "LOW" | "MED" | "HIGH";
  preferredTimeOfDay: "MORNING" | "MIDDAY" | "EVENING" | "ANY";
  /** Suggested sessions per week when this archetype is active in a phase. */
  perWeek: number;
}

export interface PhaseSkeleton {
  name: string;
  /** Share of the total timeline this phase occupies (all phases sum to ~1). */
  proportion: number;
  focusAreas: string[];
  /** Default objectives; Claude may refine these to the user's context. */
  objectives: string[];
  /** Archetype keys active during this phase. */
  archetypeKeys: string[];
}

export interface Playbook {
  domain: "LANGUAGE_EXAM" | "FITNESS" | "GENERIC";
  key: string;
  version: number;
  phaseSkeleton: PhaseSkeleton[];
  taskArchetypes: TaskArchetype[];
  /** Injected into Claude to ground specialization in this methodology. */
  groundingPrompt: string;
}
