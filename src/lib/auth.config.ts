import type { NextAuthConfig } from "next-auth";

// Config compatible con Edge Runtime (usada por middleware.ts): nada de
// Prisma ni bcrypt acá, solo lo necesario para leer/firmar el JWT de sesión.
// El provider con acceso a la base vive en auth.ts (runtime Node).
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.username = token.username;
      return session;
    },
  },
} satisfies NextAuthConfig;
