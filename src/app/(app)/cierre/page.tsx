import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role, Area } from "@/generated/prisma/enums";
import { getCierreDataAction } from "@/lib/actions/cierre";
import CierreShell from "@/components/cierre/CierreShell";

export default async function CierrePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Cocina, Recepción y Admin tienen cierre — no hace falta bloquear a nadie más.

  const depto = session.user.role === Role.RECEPCION ? Area.RECEPCION : Area.COCINA;
  const data = await getCierreDataAction({ depto });

  return <CierreShell role={session.user.role} initialDepto={depto} initialData={data} />;
}
