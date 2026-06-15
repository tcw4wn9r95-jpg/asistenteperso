import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/currentUser";

const patchSchema = z.object({
  // ISO datetimes for a move/resize; both optional.
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  locked: z.boolean().optional(),
});

// PATCH /api/schedule/:date/blocks/:blockId
// Move/resize/lock a single block. A user edit pins the block (locked + source=USER)
// and marks the day MODIFIED, so a later "reflow" preserves it.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ date: string; blockId: string }> },
) {
  const { date, blockId } = await params;
  const userId = await getCurrentUserId();
  const body = patchSchema.parse(await req.json());

  const block = await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: {
      ...(body.start ? { start: new Date(body.start) } : {}),
      ...(body.end ? { end: new Date(body.end) } : {}),
      locked: body.locked ?? true,
      source: "USER",
    },
  });

  await prisma.dayPlan.update({
    where: { userId_date: { userId, date } },
    data: { status: "MODIFIED" },
  });

  return NextResponse.json({ id: block.id, start: block.start, end: block.end, locked: block.locked });
}

// DELETE /api/schedule/:date/blocks/:blockId -> remove a block from the day
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const { blockId } = await params;
  await prisma.scheduleBlock.delete({ where: { id: blockId } });
  return NextResponse.json({ ok: true });
}
