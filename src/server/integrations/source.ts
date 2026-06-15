// Reads JSON published by your other apps' repos. Coach Claudio (training-ai)
// and NutriPrep both commit their plans as JSON to GitHub, so "talking to" them
// is just fetching those files — no API keys, exactly matching their architecture.
//
// Uses raw.githubusercontent by default (works server-side and sends permissive
// CORS for the future in-browser build); override with INTEGRATION_BASE to point
// at jsDelivr or a fork.

const OWNER = process.env.INTEGRATION_OWNER || "tcw4wn9r95-jpg";
const BRANCH = process.env.INTEGRATION_BRANCH || "main";
const BASE =
  process.env.INTEGRATION_BASE || `https://raw.githubusercontent.com/${OWNER}`;

export function repoFileUrl(repo: string, path: string): string {
  return `${BASE}/${repo}/${BRANCH}/${path}`;
}

/** Fetch and parse a JSON file from a repo. Returns null on any failure so a
 *  missing/unsynced file never breaks day generation. */
export async function fetchRepoJson<T>(repo: string, path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(repoFileUrl(repo, path), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Map an "HH:mm" hint to a coarse time-of-day bucket. */
export function timeToTimeOfDay(
  time: string | undefined,
): "MORNING" | "MIDDAY" | "EVENING" | "ANY" {
  if (!time) return "ANY";
  const [h] = time.split(":").map(Number);
  if (h < 11) return "MORNING";
  if (h < 15) return "MIDDAY";
  if (h >= 17) return "EVENING";
  return "ANY";
}
