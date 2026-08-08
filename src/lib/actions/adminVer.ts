"use server";

import { z } from "zod";
import { Area } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/authz";
import { getInventarioPageData } from "@/lib/data/inventario";

const areaSchema = z.nativeEnum(Area);

export async function getAdminVerDataAction(input: { area: Area }) {
  const { area } = z.object({ area: areaSchema }).parse(input);
  await requireRole([]); // solo ADMIN
  return getInventarioPageData(area);
}
