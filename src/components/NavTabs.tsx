"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavTab } from "@/lib/constants";

export default function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex border-b border-dashed border-line">
      {tabs.map((tab) => {
        const active = pathname === tab.path || pathname.startsWith(tab.path + "/");
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex-1 py-2.5 text-center text-[10.5px] font-bold uppercase tracking-wide ${
              active ? "border-b-2 border-accent bg-ink text-on-ink" : "text-sub"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
