"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAreaAccess } from "@/lib/authz";
import { Area } from "@/generated/prisma/enums";
import { wk, today } from "@/lib/week";

const areaSchema = z.nativeEnum(Area);

async function maybeAdvanceRacha(area: Area) {
  const weekKey = wk();
  const products = await prisma.product.findMany({
    where: { provider: { area } },
    select: { id: true },
  });
  if (products.length === 0) return;

  const conStock = await prisma.stockEntry.count({
    where: { weekKey, productId: { in: products.map((p) => p.id) }, stock: { not: null } },
  });
  if (conStock !== products.length) return;

  const hoy = today();
  const racha = await prisma.racha.findUnique({ where: { area } });
  if (racha?.ultimaFecha === hoy) return;

  const diffDias = racha?.ultimaFecha
    ? Math.round((new Date(hoy).getTime() - new Date(racha.ultimaFecha).getTime()) / 86400000)
    : null;
  const actual = diffDias === 1 ? racha!.actual + 1 : 1;
  const mejor = Math.max(racha?.mejor ?? 0, actual);

  await prisma.racha.upsert({
    where: { area },
    update: { actual, mejor, ultimaFecha: hoy },
    create: { area, actual, mejor, ultimaFecha: hoy },
  });
}

const updateStockSchema = z.object({
  productId: z.string().min(1),
  area: areaSchema,
  value: z.string().max(20),
});

export async function updateStockAction(input: z.infer<typeof updateStockSchema>) {
  const { productId, area, value } = updateStockSchema.parse(input);
  await requireAreaAccess(area);

  const weekKey = wk();
  const stock = value === "" ? null : parseFloat(value);

  await prisma.stockEntry.upsert({
    where: { productId_weekKey: { productId, weekKey } },
    update: { stock: stock === null || isNaN(stock) ? null : stock },
    create: { productId, weekKey, stock: stock === null || isNaN(stock) ? null : stock },
  });

  await maybeAdvanceRacha(area);
}

const toggleProcesadoSchema = z.object({
  productId: z.string().min(1),
  area: areaSchema,
});

export async function toggleProcesadoAction(input: z.infer<typeof toggleProcesadoSchema>) {
  const { productId, area } = toggleProcesadoSchema.parse(input);
  await requireAreaAccess(area);

  const weekKey = wk();
  const existing = await prisma.stockEntry.findUnique({
    where: { productId_weekKey: { productId, weekKey } },
  });
  await prisma.stockEntry.upsert({
    where: { productId_weekKey: { productId, weekKey } },
    update: { procesado: !(existing?.procesado ?? false) },
    create: { productId, weekKey, procesado: true },
  });
}

export async function resetInventarioAction(input: { area: Area }) {
  const { area } = z.object({ area: areaSchema }).parse(input);
  await requireAreaAccess(area);

  const weekKey = wk();
  await prisma.stockEntry.deleteMany({
    where: { weekKey, product: { provider: { area } } },
  });
}

export async function getStockSnapshotAction(input: { area: Area }) {
  const { area } = z.object({ area: areaSchema }).parse(input);
  await requireAreaAccess(area);

  const weekKey = wk();
  const entries = await prisma.stockEntry.findMany({
    where: { weekKey, product: { provider: { area } } },
    select: { productId: true, stock: true, procesado: true },
  });
  const racha = await prisma.racha.findUnique({ where: { area } });

  return {
    stock: Object.fromEntries(
      entries.map((e) => [e.productId, { stock: e.stock, procesado: e.procesado }])
    ) as Record<string, { stock: number | null; procesado: boolean }>,
    racha: racha
      ? { actual: racha.actual, mejor: racha.mejor, ultimaFecha: racha.ultimaFecha }
      : { actual: 0, mejor: 0, ultimaFecha: null },
  };
}
