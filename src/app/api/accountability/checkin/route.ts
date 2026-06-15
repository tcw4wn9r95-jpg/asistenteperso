import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { getCurrentUserId } from "@/server/currentUser";
import { recordCheckIn } from "@/server/accountability/streaks";

const schema = z.object({
  scheduleBlockId: z.string(),
  outcome: z.enum(["DONE", "SKIPPED", "PARTIAL"]),
  date: z.string().optional(),
  implementationIntention: z.string().optional(),
  note: z.string().optional(),
});

// POST /api/accountability/checkin -> log an outcome + update streaks
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = schema.parse(await req.json());
  const result = await recordCheckIn({
    userId,
    scheduleBlockId: body.scheduleBlockId,
    outcome: body.outcome,
    date: body.date ?? DateTime.now().toISODate()!,
    implementationIntention: body.implementationIntention,
    note: body.note,
  });
  return NextResponse.json(result);
}
