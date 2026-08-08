"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

type IngredienteLinea = { n: string; cant: number | null; u: string };

export async function getRecetasDataAction() {
  await requireRole([]);
  const [productos, ventas] = await Promise.all([
    prisma.recetaProducto.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ventaProducto.findMany(),
  ]);
  return {
    productos: productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      ingredientes: p.ingredientes as IngredienteLinea[],
    })),
    ventas: Object.fromEntries(ventas.map((v) => [v.producto, v.cantidad])) as Record<string, number>,
  };
}

const updateLineaSchema = z.object({
  productoId: z.string().min(1),
  idx: z.number().int().min(0),
  campo: z.enum(["cant", "u"]),
  valor: z.string(),
});

export async function updateRecetaLineaAction(input: z.infer<typeof updateLineaSchema>) {
  const { productoId, idx, campo, valor } = updateLineaSchema.parse(input);
  await requireRole([]);

  const producto = await prisma.recetaProducto.findUniqueOrThrow({ where: { id: productoId } });
  const lineas = [...(producto.ingredientes as IngredienteLinea[])];
  if (!lineas[idx]) return;
  lineas[idx] =
    campo === "cant"
      ? { ...lineas[idx], cant: valor === "" ? null : parseFloat(valor) }
      : { ...lineas[idx], u: valor };

  await prisma.recetaProducto.update({ where: { id: productoId }, data: { ingredientes: lineas } });
}

const addLineaSchema = z.object({
  productoId: z.string().min(1),
  n: z.string().trim().min(1).max(120),
  cant: z.number().nullable(),
  u: z.string().trim().max(20),
});

export async function addRecetaLineaAction(input: z.infer<typeof addLineaSchema>) {
  const { productoId, n, cant, u } = addLineaSchema.parse(input);
  await requireRole([]);

  const producto = await prisma.recetaProducto.findUniqueOrThrow({ where: { id: productoId } });
  const lineas = [...(producto.ingredientes as IngredienteLinea[]), { n, cant, u: u || "gr" }];
  await prisma.recetaProducto.update({ where: { id: productoId }, data: { ingredientes: lineas } });
}

const removeLineaSchema = z.object({ productoId: z.string().min(1), idx: z.number().int().min(0) });

export async function removeRecetaLineaAction(input: z.infer<typeof removeLineaSchema>) {
  const { productoId, idx } = removeLineaSchema.parse(input);
  await requireRole([]);

  const producto = await prisma.recetaProducto.findUniqueOrThrow({ where: { id: productoId } });
  const lineas = (producto.ingredientes as IngredienteLinea[]).filter((_, i) => i !== idx);
  await prisma.recetaProducto.update({ where: { id: productoId }, data: { ingredientes: lineas } });
}
