// Thin wrapper around the Anthropic SDK. AI features degrade gracefully: when
// ANTHROPIC_API_KEY is absent the app still runs and callers fall back to
// deterministic behavior.

import Anthropic from "@anthropic-ai/sdk";

export const PLAN_MODEL = process.env.PLAN_MODEL || "claude-opus-4-8";
export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
