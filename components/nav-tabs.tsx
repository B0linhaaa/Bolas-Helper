"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Hoje", match: (path: string) => path === "/" || path.startsWith("/jogo") },
  { href: "/mercado", label: "Mercado", match: (path: string) => path.startsWith("/mercado") },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-full border border-emerald-800/80 bg-emerald-900/50 p-1 text-xs">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1 ${
              active
                ? "bg-lime-300 font-semibold text-emerald-950"
                : "text-emerald-100/80 hover:text-lime-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
