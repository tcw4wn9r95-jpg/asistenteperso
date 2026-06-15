import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared with the middleware. It must NOT import Prisma or
// bcrypt (Node-only) — those live in the full config (auth.ts) used by the
// route handler. Here we only define routing + the authorization gate.
export const authConfig: NextAuthConfig = {
  trustHost: true, // remote/dev runs behind a proxy host
  pages: { signIn: "/login" },
  providers: [], // real providers are added in auth.ts
  callbacks: {
    // Gate every page/route except the login screen and the auth endpoints.
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") || pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      return session;
    },
  },
};
