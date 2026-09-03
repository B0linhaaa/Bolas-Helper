import Link from "next/link";
import type { MarketKind } from "@/lib/market-universe";

export function MarketKindTabs({ kind }: { kind: MarketKind }) {
  const tabs: { id: MarketKind; href: string; label: string }[] = [
    { id: "stock", href: "/mercado", label: "Ações" },
    { id: "crypto", href: "/mercado?tipo=crypto", label: "Crypto" },
  ];
  return (
    <nav className="mt-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === kind;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-full border px-3 py-1 text-xs ${
              active
                ? "border-lime-300 bg-lime-300 font-semibold text-emerald-950"
                : "border-emerald-200 bg-white/70 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
