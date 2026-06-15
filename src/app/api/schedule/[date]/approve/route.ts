import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";

// POST /api/schedule/:date/approve -> flip the day's proposal to APPROVED
export async function POST(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const userId = await getCurrentUserId();

  const dayPlan = await prisma.dayPlan.update({
    where: { userId_date: { userId, date } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return NextResponse.json({ id: dayPlan.id, status: dayPlan.status });
}
