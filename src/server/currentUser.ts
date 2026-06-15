// Resolves the authenticated user from the Auth.js session. Routes are gated by
// middleware, so a missing session here means a misconfiguration or a direct
// unauthenticated call.

import { auth } from "@/server/auth";

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }
  return session.user.id;
}
