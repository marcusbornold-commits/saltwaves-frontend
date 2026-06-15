import type { NextAuthConfig } from "next-auth";

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
