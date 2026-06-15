import { NextResponse } from "next/server";
import { isAiConfigured, CHAT_MODEL, PLAN_MODEL } from "@/server/ai/client";

// GET /api/health -> reports whether AI (Claude) features are enabled.
export async function GET() {
  return NextResponse.json({
    ok: true,
    aiConfigured: isAiConfigured(),
    models: isAiConfigured() ? { chat: CHAT_MODEL, plan: PLAN_MODEL } : null,
  });
}
