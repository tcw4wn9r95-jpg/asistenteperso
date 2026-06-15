import { Playbook } from "./types";

// Generic progressive fitness goal (e.g. "run a 10k"). Base building, then
// build phase with progressive overload, then a taper before the event.
export const fitnessPlaybook: Playbook = {
  domain: "FITNESS",
  key: "fitness-event-prep",
  version: 1,
  phaseSkeleton: [
    {
      name: "Base building",
      proportion: 0.45,
      focusAreas: ["aerobic base", "consistency", "mobility"],
      objectives: [
        "Establish a consistent weekly training rhythm",
        "Build an aerobic base without injury",
      ],
      archetypeKeys: ["easy-session", "mobility", "strength"],
    },
    {
      name: "Build & overload",
      proportion: 0.4,
      focusAreas: ["progressive overload", "intensity", "event specificity"],
      objectives: [
        "Add controlled intensity and event-specific work",
        "Progressively overload week over week",
      ],
      archetypeKeys: ["key-session", "easy-session", "strength"],
    },
    {
      name: "Taper",
      proportion: 0.15,
      focusAreas: ["recovery", "sharpening", "freshness"],
      objectives: ["Reduce volume while keeping sharpness", "Arrive fresh on event day"],
      archetypeKeys: ["easy-session", "mobility"],
    },
  ],
  taskArchetypes: [
    { key: "easy-session", title: "Easy aerobic session", kind: "GENERIC", estimatedMinutes: 40, energy: "MED", preferredTimeOfDay: "MORNING", perWeek: 3 },
    { key: "key-session", title: "Key intensity session", kind: "GENERIC", estimatedMinutes: 60, energy: "HIGH", preferredTimeOfDay: "MORNING", perWeek: 2 },
    { key: "strength", title: "Strength & conditioning", kind: "GENERIC", estimatedMinutes: 40, energy: "HIGH", preferredTimeOfDay: "ANY", perWeek: 2 },
    { key: "mobility", title: "Mobility & recovery", kind: "GENERIC", estimatedMinutes: 20, energy: "LOW", preferredTimeOfDay: "EVENING", perWeek: 3 },
  ],
  groundingPrompt: [
    "You are an expert endurance/fitness coach. Specialize the phase skeleton to",
    "the athlete's current fitness and event. Respect base -> build -> taper",
    "ordering and proportions. Emphasize progressive overload in the build phase",
    "and genuine volume reduction in the taper. Do not add or reorder phases;",
    "only personalize objectives and parametrize the given archetypes.",
  ].join(" "),
};
