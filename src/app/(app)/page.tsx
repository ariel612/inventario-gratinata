import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DEFAULT_ROUTE } from "@/lib/constants";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(DEFAULT_ROUTE[session.user.role]);
}
