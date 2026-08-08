import { prisma } from "@/lib/prisma";
import { Area } from "@/generated/prisma/enums";
import { wk, pwk } from "@/lib/week";

export async function getInventarioPageData(area: Area) {
  const weekKey = wk();
  const prevWeekKey = pwk();

  const providers = await prisma.provider.findMany({
    where: { area },
    orderBy: { orden: "asc" },
    include: { products: { orderBy: { orden: "asc" } } },
  });

  const productIds = providers.flatMap((p) => p.products.map((pr) => pr.id));

  const [current, previous, racha, sugerencias] = await Promise.all([
    prisma.stockEntry.findMany({ where: { weekKey, productId: { in: productIds } } }),
    prisma.stockEntry.findMany({ where: { weekKey: prevWeekKey, productId: { in: productIds } } }),
    prisma.racha.findUnique({ where: { area } }),
    prisma.sugerencia.findMany(),
  ]);

  return {
    providers,
    currentStock: Object.fromEntries(
      current.map((e) => [e.productId, { stock: e.stock, procesado: e.procesado }])
    ) as Record<string, { stock: number | null; procesado: boolean }>,
    currentPedido: Object.fromEntries(current.map((e) => [e.productId, e.pedido])) as Record<
      string,
      number | null
    >,
    prevStock: Object.fromEntries(previous.map((e) => [e.productId, e.stock])) as Record<
      string,
      number | null
    >,
    racha: racha
      ? { actual: racha.actual, mejor: racha.mejor, ultimaFecha: racha.ultimaFecha }
      : { actual: 0, mejor: 0, ultimaFecha: null },
    sugerencias: Object.fromEntries(sugerencias.map((s) => [s.producto, s.valor])) as Record<string, number>,
  };
}
