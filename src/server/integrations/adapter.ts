// One contract that Coach Claudio (training) and NutriPrep (food) both satisfy.
// Today they return mock data; when real APIs exist, only the body of
// fetchDailyDirectives changes behind isConfigured(). Consumers (the scheduler)
// depend only on the normalized DailyDirective shape.

export type Provider = "COACH_CLAUDIO" | "NUTRIPREP";

export interface DirectiveSegment {
  type: "ACTIVE" | "PASSIVE";
  label: string;
  minutes: number;
}

export interface DailyDirective {
  externalId: string;
  provider: Provider;
  title: string;
  suggestedMinutes: number;
  preferredTimeOfDay: "MORNING" | "MIDDAY" | "EVENING" | "ANY";
  energy: "LOW" | "MED" | "HIGH";
  /** Multi-stage directives (e.g. cooking) expose active/passive segments. */
  segments: DirectiveSegment[];
  /** Provider-specific extra data (sets/reps, recipe steps, etc.). */
  payload: Record<string, unknown>;
}

export interface IntegrationAdapter {
  provider: Provider;
  /** False -> running in stub mode with mock data. */
  isConfigured(): boolean;
  fetchDailyDirectives(date: string, userId: string): Promise<DailyDirective[]>;
}
