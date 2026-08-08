"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";

export async function listUsersAction() {
  await requireRole([]);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
  }));
}

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, números, punto, guion"),
  name: z.string().trim().min(1).max(80),
  role: z.nativeEnum(Role),
  password: z.string().min(8, "Mínimo 8 caracteres").max(200),
});

export async function createUserAction(input: z.infer<typeof createUserSchema>) {
  const data = createUserSchema.parse(input);
  await requireRole([]);

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) throw new Error(`Ya existe un usuario "${data.username}"`);

  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.create({
    data: { username: data.username, name: data.name, role: data.role, passwordHash },
  });
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Mínimo 8 caracteres").max(200),
});

export async function resetPasswordAction(input: z.infer<typeof resetPasswordSchema>) {
  const data = resetPasswordSchema.parse(input);
  await requireRole([]);
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.update({ where: { id: data.userId }, data: { passwordHash } });
}

const toggleActiveSchema = z.object({ userId: z.string().min(1) });

export async function toggleUserActiveAction(input: z.infer<typeof toggleActiveSchema>) {
  const { userId } = toggleActiveSchema.parse(input);
  const admin = await requireRole([]);
  if (userId === admin.id) throw new Error("No podés desactivar tu propia cuenta");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { active: !user.active } });
}

export async function getAlertaWaAction() {
  await requireRole([]);
  const config = await prisma.configAlerta.findUnique({ where: { id: 1 } });
  return config?.alertaWa ?? "";
}

const updateAlertaWaSchema = z.object({ whatsapp: z.string().trim().max(20) });

export async function updateAlertaWaAction(input: z.infer<typeof updateAlertaWaSchema>) {
  const { whatsapp } = updateAlertaWaSchema.parse(input);
  await requireRole([]);
  await prisma.configAlerta.upsert({
    where: { id: 1 },
    update: { alertaWa: whatsapp || null },
    create: { id: 1, alertaWa: whatsapp || null },
  });
}
