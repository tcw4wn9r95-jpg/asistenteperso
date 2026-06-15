import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";

// GET /api/accountability/streaks -> the user's current/longest streaks
export async function GET() {
  const userId = await getCurrentUserId();
  const streaks = await prisma.streak.findMany({
    where: { userId },
    orderBy: { current: "desc" },
  });
  return NextResponse.json(streaks);
}
