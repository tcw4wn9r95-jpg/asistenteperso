// Lightweight heuristic that suggests a time estimate for a task from its title
// and kind. Deliberately simple and deterministic; the user can always override,
// and Claudio can refine it. This is the "app suggests time needed" feature.

const KEYWORD_MINUTES: { pattern: RegExp; minutes: number }[] = [
  { pattern: /laundry|dishes|tidy|vacuum|clean/i, minutes: 20 },
  { pattern: /cook|meal|dinner|lunch|prep/i, minutes: 30 },
  { pattern: /email|call|reply|message/i, minutes: 15 },
  { pattern: /study|review|practice|anki|vocab/i, minutes: 25 },
  { pattern: /workout|run|gym|train|exercise/i, minutes: 45 },
  { pattern: /shop|groceries|errand/i, minutes: 40 },
];

const KIND_DEFAULT: Record<string, number> = {
  CHORE: 20,
  STUDY: 25,
  GENERIC: 30,
  INTEGRATION_DERIVED: 30,
};

export function suggestEstimateMinutes(title: string, kind = "GENERIC"): number {
  for (const { pattern, minutes } of KEYWORD_MINUTES) {
    if (pattern.test(title)) return minutes;
  }
  return KIND_DEFAULT[kind] ?? 30;
}
