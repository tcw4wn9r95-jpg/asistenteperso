import { DailyDirective, IntegrationAdapter, Provider } from "./adapter";
import { coachClaudioAdapter } from "./coachClaudio";
import { nutriPrepAdapter } from "./nutriPrep";

const ADAPTERS: IntegrationAdapter[] = [coachClaudioAdapter, nutriPrepAdapter];

export function getAdapter(provider: Provider): IntegrationAdapter | undefined {
  return ADAPTERS.find((a) => a.provider === provider);
}

export function allAdapters(): IntegrationAdapter[] {
  return ADAPTERS;
}

/** Pull directives from every provider for a date (used by the sync route). */
export async function fetchAllDirectives(
  date: string,
  userId: string,
): Promise<DailyDirective[]> {
  const results = await Promise.all(
    ADAPTERS.map((a) => a.fetchDailyDirectives(date, userId)),
  );
  return results.flat();
}
