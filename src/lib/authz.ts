import { auth } from "@/lib/auth";
import { Role, Area } from "@/generated/prisma/enums";
import type { Session } from "next-auth";

export class ForbiddenError extends Error {
  constructor(msg = "No autorizado") {
    super(msg);
    this.name = "ForbiddenError";
  }
}

async function requireSession(): Promise<Session["user"]> {
  const session = await auth();
  if (!session?.user) throw new ForbiddenError("Sesión requerida");
  return session.user;
}

// Server Actions llaman esto primero. ADMIN siempre pasa (mismo criterio que
// ROLE_MODES.administrador en la app original, que incluía todos los modos).
export async function requireRole(allowed: Role[]): Promise<Session["user"]> {
  const user = await requireSession();
  if (user.role === Role.ADMIN) return user;
  if (!allowed.includes(user.role)) throw new ForbiddenError("Rol no autorizado");
  return user;
}

// Cocina solo puede tocar el área Cocina, Recepción solo la suya; Admin, cualquiera.
// Reemplaza curArea()/AR() del cliente, ahora validado en servidor.
export async function requireAreaAccess(area: Area): Promise<Session["user"]> {
  const user = await requireSession();
  if (user.role === Role.ADMIN) return user;
  if (user.role !== (area as string)) throw new ForbiddenError("Sin acceso a esta área");
  return user;
}

export async function currentUser(): Promise<Session["user"] | null> {
  const session = await auth();
  return session?.user ?? null;
}
