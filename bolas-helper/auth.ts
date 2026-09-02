import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email && token.sub) {
        const { upsertUser } = await import("@/lib/users");
        await upsertUser(token.sub, user.email).catch(() => undefined);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
