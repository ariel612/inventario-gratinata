import { Role } from "@/generated/prisma/enums";

export type NavTab = { path: string; label: string };

// Equivalente a ROLE_MODES/MODE_LABELS de la app original: qué pestañas ve
// cada rol. ADMIN ve todo.
export const ROLE_TABS: Record<Role, NavTab[]> = {
  [Role.COCINA]: [
    { path: "/cocina", label: "Cocina" },
    { path: "/mise", label: "Mise" },
    { path: "/cierre", label: "Cierre" },
  ],
  [Role.RECEPCION]: [
    { path: "/recepcion", label: "Recepción" },
    { path: "/cierre", label: "Cierre" },
  ],
  [Role.ADMIN]: [
    { path: "/admin", label: "Admin" },
    { path: "/cocina", label: "Cocina" },
    { path: "/recepcion", label: "Recepción" },
    { path: "/mise", label: "Mise" },
    { path: "/cierre", label: "Cierre" },
  ],
};

export const DEFAULT_ROUTE: Record<Role, string> = {
  [Role.COCINA]: "/cocina",
  [Role.RECEPCION]: "/recepcion",
  [Role.ADMIN]: "/admin",
};

// Niveles por cantidad de cierres completados (gamificación de Cierre).
export const NIVELES = [
  { min: 30, n: "MAESTRO DEL CIERRE" },
  { min: 16, n: "JEFE DE TURNO" },
  { min: 8, n: "COCINERO" },
  { min: 3, n: "AYUDANTE" },
  { min: 0, n: "APRENDIZ" },
] as const;

export function nivelPorCantidad(n: number): string {
  for (const nivel of NIVELES) {
    if (n >= nivel.min) return nivel.n;
  }
  return NIVELES[NIVELES.length - 1].n;
}
