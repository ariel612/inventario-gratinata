"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { Area } from "@/generated/prisma/enums";

const areaSchema = z.nativeEnum(Area);

const addProductSchema = z.object({
  area: areaSchema,
  providerId: z.string().min(1).optional(),
  newProviderName: z.string().trim().min(1).max(80).optional(),
  newProviderWa: z.string().trim().max(20).optional(),
  productName: z.string().trim().min(1).max(120),
  min: z.number().min(0),
});

export async function addProductAction(input: z.infer<typeof addProductSchema>) {
  const data = addProductSchema.parse(input);
  await requireRole([]);

  let providerId = data.providerId;
  if (!providerId) {
    if (!data.newProviderName) throw new Error("Falta el proveedor");
    const name = data.newProviderName.toUpperCase();
    const provider = await prisma.provider.upsert({
      where: { area_name: { area: data.area, name } },
      update: {},
      create: { area: data.area, name, whatsapp: data.newProviderWa || null },
    });
    providerId = provider.id;
  }

  const maxOrden = await prisma.product.aggregate({
    where: { providerId },
    _max: { orden: true },
  });

  await prisma.product.create({
    data: {
      providerId,
      name: data.productName,
      minStock: data.min,
      orden: (maxOrden._max.orden ?? -1) + 1,
    },
  });
}

const editProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  min: z.number().min(0),
});

export async function editProductAction(input: z.infer<typeof editProductSchema>) {
  const data = editProductSchema.parse(input);
  await requireRole([]);
  await prisma.product.update({
    where: { id: data.productId },
    data: { name: data.name, minStock: data.min },
  });
}

const deleteProductSchema = z.object({ productId: z.string().min(1) });

export async function deleteProductAction(input: z.infer<typeof deleteProductSchema>) {
  const { productId } = deleteProductSchema.parse(input);
  await requireRole([]);
  await prisma.product.delete({ where: { id: productId } });
}

const updateProviderWaSchema = z.object({
  providerId: z.string().min(1),
  whatsapp: z.string().trim().max(20),
});

export async function updateProviderWhatsappAction(input: z.infer<typeof updateProviderWaSchema>) {
  const { providerId, whatsapp } = updateProviderWaSchema.parse(input);
  await requireRole([]);
  await prisma.provider.update({
    where: { id: providerId },
    data: { whatsapp: whatsapp || null },
  });
}
