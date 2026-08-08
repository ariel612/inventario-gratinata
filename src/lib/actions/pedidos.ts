"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAreaAccess } from "@/lib/authz";
import { Area } from "@/generated/prisma/enums";
import { wk } from "@/lib/week";

const areaSchema = z.nativeEnum(Area);

const updatePedidoSchema = z.object({
  productId: z.string().min(1),
  area: areaSchema,
  value: z.string().max(20),
});

export async function updatePedidoAction(input: z.infer<typeof updatePedidoSchema>) {
  const { productId, area, value } = updatePedidoSchema.parse(input);
  await requireAreaAccess(area);

  const weekKey = wk();
  const pedido = value === "" ? null : parseFloat(value);

  await prisma.stockEntry.upsert({
    where: { productId_weekKey: { productId, weekKey } },
    update: { pedido: pedido === null || isNaN(pedido) ? null : pedido },
    create: { productId, weekKey, pedido: pedido === null || isNaN(pedido) ? null : pedido },
  });
}

const pedidoItemSchema = z.object({
  provider: z.string(),
  product: z.string(),
  cantidad: z.string(),
});

const savePedidoSchema = z.object({
  area: areaSchema,
  items: z.array(pedidoItemSchema),
});

export async function savePedidoAction(input: z.infer<typeof savePedidoSchema>) {
  const { area, items } = savePedidoSchema.parse(input);
  await requireAreaAccess(area);
  if (items.length === 0) return;

  await prisma.pedido.create({ data: { area, items } });

  const limite = new Date();
  limite.setDate(limite.getDate() - 14);
  await prisma.pedido.deleteMany({ where: { area, fecha: { lt: limite } } });
}

export async function getPedidosHistorialAction(input: { area: Area }) {
  const { area } = z.object({ area: areaSchema }).parse(input);
  await requireAreaAccess(area);

  const pedidos = await prisma.pedido.findMany({
    where: { area },
    orderBy: { fecha: "desc" },
    take: 10,
  });

  return pedidos.map((p) => ({
    id: p.id,
    fecha: p.fecha.toLocaleDateString("es-CL"),
    items: p.items as z.infer<typeof pedidoItemSchema>[],
  }));
}

export async function deletePedidoAction(input: { id: string; area: Area }) {
  const { id, area } = z.object({ id: z.string().min(1), area: areaSchema }).parse(input);
  await requireAreaAccess(area);
  await prisma.pedido.deleteMany({ where: { id, area } });
}
