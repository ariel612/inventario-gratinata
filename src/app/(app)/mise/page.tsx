import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { DEFAULT_ROUTE } from "@/lib/constants";
import { getMiseDataAction } from "@/lib/actions/mise";
import MiseShell from "@/components/mise/MiseShell";

export default async function MisePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.COCINA) {
    redirect(DEFAULT_ROUTE[session.user.role]);
  }

  const { cat, dia } = await getMiseDataAction();

  return <MiseShell initialCat={cat} initialDia={dia} />;
}
