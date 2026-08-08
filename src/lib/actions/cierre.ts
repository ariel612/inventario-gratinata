"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAreaAccess } from "@/lib/authz";
import { Area } from "@/generated/prisma/enums";
import { today } from "@/lib/week";
import { nivelPorCantidad } from "@/lib/constants";

const areaSchema = z.nativeEnum(Area);

type AreaSnapshot = { n: string; t: string[] };

export async function getCierreDataAction(input: { depto: Area }) {
  const { depto } = z.object({ depto: areaSchema }).parse(input);
  await requireAreaAccess(depto);

  const [areas, turno] = await Promise.all([
    prisma.cierreArea.findMany({
      where: { depto },
      orderBy: { orden: "asc" },
      include: { tareas: { orderBy: { orden: "asc" } } },
    }),
    prisma.cierreTurno.findUnique({ where: { depto_fecha: { depto, fecha: today() } } }),
  ]);

  return {
    areas,
    turno: turno
      ? {
          id: turno.id,
          nombre: turno.nombre,
          fecha: turno.fecha,
          tareas: turno.tareas as Record<string, boolean>,
          areasSnapshot: turno.areasSnapshot as AreaSnapshot[],
        }
      : null,
  };
}

const startTurnoSchema = z.object({ depto: areaSchema, nombre: z.string().trim().min(1).max(80) });

export async function startTurnoAction(input: z.infer<typeof startTurnoSchema>) {
  const { depto, nombre } = startTurnoSchema.parse(input);
  await requireAreaAccess(depto);

  const areas = await prisma.cierreArea.findMany({
    where: { depto },
    orderBy: { orden: "asc" },
    include: { tareas: { orderBy: { orden: "asc" } } },
  });
  const areasSnapshot: AreaSnapshot[] = areas.map((a) => ({ n: a.nombre, t: a.tareas.map((t) => t.texto) }));

  await prisma.cierreTurno.upsert({
    where: { depto_fecha: { depto, fecha: today() } },
    update: { nombre, tareas: {}, areasSnapshot },
    create: { depto, fecha: today(), nombre, tareas: {}, areasSnapshot },
  });
}

const cancelTurnoSchema = z.object({ depto: areaSchema });

export async function cancelTurnoAction(input: z.infer<typeof cancelTurnoSchema>) {
  const { depto } = cancelTurnoSchema.parse(input);
  await requireAreaAccess(depto);
  await prisma.cierreTurno.deleteMany({ where: { depto, fecha: today() } });
}

const toggleTareaSchema = z.object({
  depto: areaSchema,
  area: z.string().min(1),
  tarea: z.string().min(1),
});

export async function toggleTareaAction(input: z.infer<typeof toggleTareaSchema>) {
  const { depto, area, tarea } = toggleTareaSchema.parse(input);
  await requireAreaAccess(depto);

  const turno = await prisma.cierreTurno.findUnique({ where: { depto_fecha: { depto, fecha: today() } } });
  if (!turno) return;

  const tareas = { ...(turno.tareas as Record<string, boolean>) };
  const key = `${area}||${tarea}`;
  tareas[key] = !tareas[key];

  await prisma.cierreTurno.update({ where: { id: turno.id }, data: { tareas } });
}

function pendientesDeTurno(tareas: Record<string, boolean>, areas: AreaSnapshot[]) {
  const out: { area: string; tareas: string[] }[] = [];
  for (const g of areas) {
    const pend = g.t.filter((tk) => !tareas[`${g.n}||${tk}`]);
    if (pend.length > 0) out.push({ area: g.n, tareas: pend });
  }
  return out;
}

const finalizarTurnoSchema = z.object({ depto: areaSchema });

export async function finalizarTurnoAction(input: z.infer<typeof finalizarTurnoSchema>) {
  const { depto } = finalizarTurnoSchema.parse(input);
  await requireAreaAccess(depto);

  const turno = await prisma.cierreTurno.findUnique({ where: { depto_fecha: { depto, fecha: today() } } });
  if (!turno) throw new Error("No hay checklist en curso");

  const tareas = turno.tareas as Record<string, boolean>;
  const areasSnapshot = turno.areasSnapshot as AreaSnapshot[];
  const pendientes = pendientesDeTurno(tareas, areasSnapshot);

  const nombre = turno.nombre;
  const before = await prisma.cierreHistorial.count({ where: { depto, nombre } });

  await prisma.cierreHistorial.create({
    data: { depto, nombre, fecha: turno.fecha, tareas, areasSnapshot },
  });
  await prisma.cierreTurno.delete({ where: { id: turno.id } });

  const after = before + 1;
  const nivelAntes = nivelPorCantidad(before);
  const nivelAhora = nivelPorCantidad(after);

  let alerta: { alertaWa: string; mensaje: string } | null = null;
  if (pendientes.length > 0) {
    const config = await prisma.configAlerta.findUnique({ where: { id: 1 } });
    if (config?.alertaWa) {
      const lines = [
        `*Cierre de ${depto === Area.COCINA ? "Cocina" : "Recepción"} incompleto*`,
        `Responsable: ${nombre}`,
        `Fecha: ${turno.fecha}`,
        "",
        ...pendientes.map((p) => `*${p.area}*: ${p.tareas.join(", ")}`),
      ];
      alerta = { alertaWa: config.alertaWa, mensaje: lines.join("\n") };
    }
  }

  return {
    pendientesCount: pendientes.length,
    alerta,
    nivelSubio: nivelAhora !== nivelAntes,
    nivelAhora,
    cantidadCierres: after,
    nombre,
  };
}

const deptoSchema = z.object({ depto: areaSchema });

export async function getCierreHistorialAction(input: { depto: Area }) {
  const { depto } = deptoSchema.parse(input);
  await requireAreaAccess(depto);

  const docs = await prisma.cierreHistorial.findMany({
    where: { depto },
    orderBy: { finalizadoEn: "desc" },
    take: 10,
  });

  return docs.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    fecha: d.fecha,
    tareas: d.tareas as Record<string, boolean>,
    areasSnapshot: d.areasSnapshot as AreaSnapshot[],
  }));
}

const deleteHistorialSchema = z.object({ id: z.string().min(1), depto: areaSchema });

export async function deleteCierreHistorialAction(input: z.infer<typeof deleteHistorialSchema>) {
  const { id, depto } = deleteHistorialSchema.parse(input);
  await requireAreaAccess(depto);
  await prisma.cierreHistorial.deleteMany({ where: { id, depto } });
}

export async function getRankingAction(input: { depto: Area }) {
  const { depto } = deptoSchema.parse(input);
  await requireAreaAccess(depto);

  const docs = await prisma.cierreHistorial.findMany({ where: { depto }, select: { nombre: true } });
  const counts = new Map<string, number>();
  for (const d of docs) {
    const n = d.nombre.trim();
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad, nivel: nivelPorCantidad(cantidad) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

const addAreaSchema = z.object({ depto: areaSchema, nombre: z.string().trim().min(1).max(60) });

export async function addCierreAreaAction(input: z.infer<typeof addAreaSchema>) {
  const { depto, nombre } = addAreaSchema.parse(input);
  await requireAreaAccess(depto);

  const nombreUpper = nombre.toUpperCase();
  const existing = await prisma.cierreArea.findUnique({ where: { depto_nombre: { depto, nombre: nombreUpper } } });
  if (existing) throw new Error(`El área "${nombreUpper}" ya existe`);

  const max = await prisma.cierreArea.aggregate({ where: { depto }, _max: { orden: true } });
  await prisma.cierreArea.create({
    data: { depto, nombre: nombreUpper, orden: (max._max.orden ?? -1) + 1 },
  });
}

const renameAreaSchema = z.object({ areaId: z.string().min(1), depto: areaSchema, nombre: z.string().trim().min(1).max(60) });

export async function renameCierreAreaAction(input: z.infer<typeof renameAreaSchema>) {
  const { areaId, depto, nombre } = renameAreaSchema.parse(input);
  await requireAreaAccess(depto);
  await prisma.cierreArea.update({ where: { id: areaId }, data: { nombre: nombre.toUpperCase() } });
}

const removeAreaSchema = z.object({ areaId: z.string().min(1), depto: areaSchema });

export async function removeCierreAreaAction(input: z.infer<typeof removeAreaSchema>) {
  const { areaId, depto } = removeAreaSchema.parse(input);
  await requireAreaAccess(depto);
  await prisma.cierreArea.delete({ where: { id: areaId } });
}

const addTaskSchema = z.object({ areaId: z.string().min(1), depto: areaSchema, texto: z.string().trim().min(1).max(160) });

export async function addCierreTaskAction(input: z.infer<typeof addTaskSchema>) {
  const { areaId, depto, texto } = addTaskSchema.parse(input);
  await requireAreaAccess(depto);
  const max = await prisma.cierreTarea.aggregate({ where: { cierreAreaId: areaId }, _max: { orden: true } });
  await prisma.cierreTarea.create({
    data: { cierreAreaId: areaId, texto, orden: (max._max.orden ?? -1) + 1 },
  });
}

const removeTaskSchema = z.object({ tareaId: z.string().min(1), depto: areaSchema });

export async function removeCierreTaskAction(input: z.infer<typeof removeTaskSchema>) {
  const { tareaId, depto } = removeTaskSchema.parse(input);
  await requireAreaAccess(depto);
  await prisma.cierreTarea.delete({ where: { id: tareaId } });
}
