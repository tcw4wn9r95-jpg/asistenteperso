import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/server/currentUser";
import { generateDayPlan, readDayPlan } from "@/server/scheduling/dayPlanService";

// GET /api/schedule/:date  -> read the current (possibly empty) day plan
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const userId = await getCurrentUserId();
  return NextResponse.json(await readDayPlan(userId, date));
}

// POST /api/schedule/:date -> (re)generate a PENDING proposal for the day
export async function POST(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const userId = await getCurrentUserId();
  return NextResponse.json(await generateDayPlan(userId, date));
}
