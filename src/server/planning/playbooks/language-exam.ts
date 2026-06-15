import { Playbook } from "./types";

// Methodology for going up one CEFR level for an exam (e.g. B1 -> B2).
// Front-loads comprehensible input + vocabulary, shifts to active production
// and grammar gaps, then drills exam format with timed mocks. Vocabulary uses
// spaced repetition throughout.
export const languageExamPlaybook: Playbook = {
  domain: "LANGUAGE_EXAM",
  key: "language-exam-cefr-up",
  version: 1,
  phaseSkeleton: [
    {
      name: "Foundation: input & vocabulary",
      proportion: 0.4,
      focusAreas: ["comprehensible input", "vocabulary (SRS)", "listening"],
      objectives: [
        "Build daily spaced-repetition vocabulary habit",
        "Reach comfortable comprehension of level-appropriate input",
      ],
      archetypeKeys: ["srs-vocab", "input-listening", "input-reading"],
    },
    {
      name: "Production & grammar gaps",
      proportion: 0.35,
      focusAreas: ["speaking", "writing", "targeted grammar"],
      objectives: [
        "Produce structured spoken/written output weekly",
        "Close the top grammar gaps for the target level",
      ],
      archetypeKeys: ["srs-vocab", "speaking-practice", "writing-task", "grammar-drill"],
    },
    {
      name: "Exam drilling & timed mocks",
      proportion: 0.25,
      focusAreas: ["exam format", "timing", "weak-section review"],
      objectives: [
        "Complete full timed mock exams under realistic conditions",
        "Review and shore up the weakest exam section",
      ],
      archetypeKeys: ["srs-vocab", "mock-exam", "weak-section-review"],
    },
  ],
  taskArchetypes: [
    { key: "srs-vocab", title: "Spaced-repetition vocabulary", kind: "STUDY", estimatedMinutes: 20, energy: "LOW", preferredTimeOfDay: "ANY", perWeek: 6 },
    { key: "input-listening", title: "Listening practice", kind: "STUDY", estimatedMinutes: 30, energy: "MED", preferredTimeOfDay: "ANY", perWeek: 3 },
    { key: "input-reading", title: "Reading practice", kind: "STUDY", estimatedMinutes: 30, energy: "MED", preferredTimeOfDay: "EVENING", perWeek: 2 },
    { key: "speaking-practice", title: "Speaking practice", kind: "STUDY", estimatedMinutes: 30, energy: "HIGH", preferredTimeOfDay: "MORNING", perWeek: 2 },
    { key: "writing-task", title: "Writing task", kind: "STUDY", estimatedMinutes: 45, energy: "HIGH", preferredTimeOfDay: "MORNING", perWeek: 1 },
    { key: "grammar-drill", title: "Targeted grammar drill", kind: "STUDY", estimatedMinutes: 25, energy: "MED", preferredTimeOfDay: "ANY", perWeek: 2 },
    { key: "mock-exam", title: "Timed mock exam section", kind: "STUDY", estimatedMinutes: 60, energy: "HIGH", preferredTimeOfDay: "MORNING", perWeek: 2 },
    { key: "weak-section-review", title: "Weak-section review", kind: "STUDY", estimatedMinutes: 30, energy: "MED", preferredTimeOfDay: "ANY", perWeek: 2 },
  ],
  groundingPrompt: [
    "You are an expert language-exam coach. Specialize the provided phase",
    "skeleton to the learner's current level, target level, and weak areas.",
    "Respect the phase ordering and proportions — input first, then production,",
    "then timed exam drilling. Keep spaced-repetition vocabulary running every",
    "phase. Do not invent new phases or change their order; only set concrete,",
    "personalized objectives and pick/parametrize the given task archetypes.",
  ].join(" "),
};
