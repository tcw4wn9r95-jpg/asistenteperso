import { describe, it, expect } from "vitest";
import { computeDatedPhases } from "./backwardPass";
import { languageExamPlaybook } from "./playbooks/language-exam";

describe("computeDatedPhases", () => {
  it("distributes days by proportion and ends exactly on target", () => {
    const phases = computeDatedPhases(
      "2026-06-15",
      "2026-12-15", // ~183 days
      languageExamPlaybook.phaseSkeleton,
      5,
    );

    expect(phases).toHaveLength(3);
    expect(phases[0].startDate).toBe("2026-06-15");
    // Final phase ends on (or one day inside) the target.
    expect(phases[2].endDate).toBe("2026-12-14");
    // Phases are contiguous and ordered.
    expect(phases[0].order).toBe(0);
    expect(phases[1].startDate > phases[0].endDate).toBe(true);
    // Foundation phase (0.4) should be the longest.
    const len = (p: { startDate: string; endDate: string }) =>
      new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
    expect(len(phases[0])).toBeGreaterThan(len(phases[2]));
  });

  it("handles a tight timeline without crashing", () => {
    const phases = computeDatedPhases(
      "2026-06-15",
      "2026-06-20",
      languageExamPlaybook.phaseSkeleton,
      3,
    );
    expect(phases).toHaveLength(3);
    expect(phases[2].endDate <= "2026-06-20").toBe(true);
  });
});
