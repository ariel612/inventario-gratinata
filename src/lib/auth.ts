import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_LOCKOUT_MS = 10 * 60 * 1000;

const credencialesSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credencialesSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        const desde = new Date(Date.now() - VENTANA_LOCKOUT_MS);
        const fallosRecientes = await prisma.loginAttempt.count({
          where: { username, ip, success: false, createdAt: { gte: desde } },
        });
        if (fallosRecientes >= MAX_INTENTOS_FALLIDOS) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;
        const ok = !!user && user.active && passwordOk;

        await prisma.loginAttempt.create({ data: { username, ip, success: ok } });

        if (!ok || !user) return null;
        return { id: user.id, name: user.name, role: user.role, username: user.username };
      },
    }),
  ],
});
