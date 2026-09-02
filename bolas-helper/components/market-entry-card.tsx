import { FavoriteButton } from "@/components/favorite-button";
import { formatPct, formatPrice, type EntryRead } from "@/lib/market-analysis";
import type { MarketKind } from "@/lib/market-universe";

export function MarketEntryCard({
  kind,
  name,
  read,
  saved,
}: {
  kind: MarketKind;
  name: string;
  read: EntryRead;
  saved: boolean;
}) {
  const up = (read.quote.changePct ?? 0) >= 0;
  return (
    <li className="rounded-xl border border-lime-300/50 bg-white/80 px-4 py-4 shadow-sm dark:border-lime-400/25 dark:bg-emerald-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
            {read.title}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold">{name}</h3>
          <p className="text-xs text-zinc-500">{read.quote.symbol}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold">
              {formatPrice(read.quote.price, read.quote.currency)}
            </p>
            <p
              className={`text-xs font-medium ${
                up ? "text-emerald-700 dark:text-lime-300" : "text-rose-600"
              }`}
            >
              {formatPct(read.quote.changePct)}
            </p>
          </div>
          <FavoriteButton
            compact
            saved={saved}
            kind={kind}
            symbol={read.quote.symbol}
            name={name}
          />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{read.why}</p>
    </li>
  );
}
