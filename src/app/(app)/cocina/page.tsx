import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role, Area } from "@/generated/prisma/enums";
import { DEFAULT_ROUTE } from "@/lib/constants";
import { getInventarioPageData } from "@/lib/data/inventario";
import InventarioView from "@/components/inventario/InventarioView";

export default async function CocinaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.COCINA) {
    redirect(DEFAULT_ROUTE[session.user.role]);
  }

  const { providers, currentStock, racha, sugerencias } = await getInventarioPageData(Area.COCINA);

  return (
    <InventarioView
      area={Area.COCINA}
      areaLabel="Cocina"
      providers={providers}
      initialStock={currentStock}
      initialRacha={racha}
      sugerencias={sugerencias}
    />
  );
}
