"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Role } from "@/generated/prisma/enums";
import { today } from "@/lib/week";

const EMPTY_DIA = { linea: {}, repuesto: {}, producir: {}, sel: {}, hecho: {} };

async function getOrCreateHoy() {
  const fecha = today();
  const doc = await prisma.miseDiario.findUnique({ where: { fecha } });
  if (doc) {
    return {
      linea: doc.linea as Record<string, string>,
      repuesto: doc.repuesto as Record<string, string>,
      producir: doc.producir as Record<string, string>,
      sel: doc.sel as Record<string, boolean>,
      hecho: doc.hecho as Record<string, boolean>,
    };
  }
  return EMPTY_DIA as {
    linea: Record<string, string>;
    repuesto: Record<string, string>;
    producir: Record<string, string>;
    sel: Record<string, boolean>;
    hecho: Record<string, boolean>;
  };
}

export async function getMiseDataAction() {
  await requireRole([Role.COCINA]);
  const [cat, dia] = await Promise.all([
    prisma.miseItem.findMany({ orderBy: { orden: "asc" } }),
    getOrCreateHoy(),
  ]);
  return { cat, dia };
}

const fieldSchema = z.enum(["linea", "repuesto", "producir"]);
const updateFieldSchema = z.object({ name: z.string().min(1), field: fieldSchema, value: z.string().max(200) });

export async function updateMiseFieldAction(input: z.infer<typeof updateFieldSchema>) {
  const { name, field, value } = updateFieldSchema.parse(input);
  await requireRole([Role.COCINA]);

  const fecha = today();
  const dia = await getOrCreateHoy();
  dia[field] = { ...dia[field], [name]: value };

  await prisma.miseDiario.upsert({
    where: { fecha },
    update: { [field]: dia[field] },
    create: { fecha, ...EMPTY_DIA, [field]: dia[field] },
  });
}

const nameSchema = z.object({ name: z.string().min(1) });

export async function toggleMiseSelAction(input: z.infer<typeof nameSchema>) {
  const { name } = nameSchema.parse(input);
  await requireRole([Role.COCINA]);

  const fecha = today();
  const dia = await getOrCreateHoy();
  const nuevo = !dia.sel[name];
  const sel = { ...dia.sel, [name]: nuevo };
  const hecho = nuevo ? dia.hecho : { ...dia.hecho, [name]: false };

  await prisma.miseDiario.upsert({
    where: { fecha },
    update: { sel, hecho },
    create: { fecha, ...EMPTY_DIA, sel, hecho },
  });
}

export async function toggleMiseHechoAction(input: z.infer<typeof nameSchema>) {
  const { name } = nameSchema.parse(input);
  await requireRole([Role.COCINA]);

  const fecha = today();
  const dia = await getOrCreateHoy();
  if (!dia.sel[name]) return { allDone: false };
  const hecho = { ...dia.hecho, [name]: !dia.hecho[name] };

  await prisma.miseDiario.upsert({
    where: { fecha },
    update: { hecho },
    create: { fecha, ...EMPTY_DIA, hecho },
  });

  const selKeys = Object.keys(dia.sel).filter((k) => dia.sel[k]);
  const doneKeys = selKeys.filter((k) => hecho[k]);
  return { allDone: selKeys.length > 0 && doneKeys.length === selKeys.length };
}

const addItemSchema = z.object({ nombre: z.string().trim().min(1).max(120), min: z.number().min(0) });

export async function addMiseItemAction(input: z.infer<typeof addItemSchema>) {
  const { nombre, min } = addItemSchema.parse(input);
  await requireRole([Role.COCINA]);

  const existing = await prisma.miseItem.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (existing) throw new Error(`"${nombre}" ya existe en la lista`);

  const max = await prisma.miseItem.aggregate({ _max: { orden: true } });
  await prisma.miseItem.create({ data: { nombre, min, orden: (max._max.orden ?? -1) + 1 } });
}

const removeItemSchema = z.object({ itemId: z.string().min(1) });

export async function removeMiseItemAction(input: z.infer<typeof removeItemSchema>) {
  const { itemId } = removeItemSchema.parse(input);
  await requireRole([Role.COCINA]);
  await prisma.miseItem.delete({ where: { id: itemId } });
}

const editMinSchema = z.object({ itemId: z.string().min(1), min: z.number().min(0) });

export async function editMiseMinAction(input: z.infer<typeof editMinSchema>) {
  const { itemId, min } = editMinSchema.parse(input);
  await requireRole([Role.COCINA]);
  await prisma.miseItem.update({ where: { id: itemId }, data: { min } });
}

export async function finalizarMiseAction() {
  await requireRole([Role.COCINA]);
  const fecha = today();
  const dia = await getOrCreateHoy();
  const selKeys = Object.keys(dia.sel).filter((k) => dia.sel[k]);
  if (selKeys.length === 0) throw new Error("No hay productos seleccionados para guardar en el historial");

  const items = selKeys.map((n) => ({
    n,
    linea: dia.linea[n] || "",
    repuesto: dia.repuesto[n] || "",
    producir: dia.producir[n] || "",
    hecho: !!dia.hecho[n],
  }));

  await prisma.miseHistorial.create({ data: { fecha, items } });
}

export async function getMiseHistorialAction() {
  await requireRole([Role.COCINA]);
  const docs = await prisma.miseHistorial.findMany({ orderBy: { guardadoEn: "desc" }, take: 10 });
  return docs.map((d) => ({
    id: d.id,
    fecha: d.fecha,
    items: d.items as { n: string; linea: string; repuesto: string; producir: string; hecho: boolean }[],
  }));
}
