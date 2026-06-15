// Single-user app for now: resolve "the" user. Auth (Auth.js) is a deferred
// step — every table already carries userId, so adding real sessions later is
// additive. Until then we resolve the only seeded user.

import { prisma } from "@/server/db";

export async function getCurrentUserId(): Promise<string> {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error("No user found. Run `npm run db:seed`.");
  }
  return user.id;
}
