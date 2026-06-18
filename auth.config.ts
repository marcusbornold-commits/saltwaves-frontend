import type { NextAuthConfig } from "next-auth";
import { ensureProfileForUser } from "@/lib/ensure-profile";

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/app");

      if (!isProtected) {
        return true;
      }

      return !!auth?.user;
    },
    async signIn({ user }) {
      if (user?.id) {
        await ensureProfileForUser(user.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
