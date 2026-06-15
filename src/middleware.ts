import NextAuth from "next-auth";
import { authConfig } from "@/server/auth.config";

// Uses the edge-safe config (no Prisma/bcrypt) to gate routes via the JWT.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect everything except Next internals, the manifest, the service worker,
  // and image assets (icons must be publicly fetchable for install-to-home-screen).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
