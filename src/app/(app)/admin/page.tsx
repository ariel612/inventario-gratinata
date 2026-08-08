import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role, Area } from "@/generated/prisma/enums";
import { getInventarioPageData } from "@/lib/data/inventario";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.ADMIN) redirect("/");

  const data = await getInventarioPageData(Area.COCINA);

  return <AdminShell initialArea={Area.COCINA} initialData={data} />;
}
