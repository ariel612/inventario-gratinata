import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLE_TABS } from "@/lib/constants";
import { logoutAction } from "@/lib/actions/auth";
import NavTabs from "@/components/NavTabs";
import ThemeToggle from "@/components/ThemeToggle";
import OnlineBanner from "@/components/OnlineBanner";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tabs = ROLE_TABS[session.user.role];

  return (
    <div className="min-h-screen bg-cream text-text">
      <header className="sticky top-0 z-10 border-b border-dashed border-line bg-cream px-4 pt-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <div className="text-base font-bold tracking-wide">GRATINATA</div>
            <div className="text-[10px] text-sub">{session.user.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="border border-line bg-paper px-2 py-1 text-sm"
                title="Salir"
              >
                ⏻
              </button>
            </form>
          </div>
        </div>
        {tabs.length > 1 && <NavTabs tabs={tabs} />}
      </header>
      <OnlineBanner />
      <main>{children}</main>
    </div>
  );
}
