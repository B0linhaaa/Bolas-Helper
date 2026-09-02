import { FavoriteButton } from "@/components/favorite-button";
import { formatPct, formatPrice } from "@/lib/market-analysis";
import type { MarketKind } from "@/lib/market-universe";
import type { QuoteSnapshot } from "@/lib/quotes";

export function MarketQuoteRow({
  kind,
  name,
  quote,
  saved,
}: {
  kind: MarketKind;
  name: string;
  quote: QuoteSnapshot;
  saved: boolean;
}) {
  const up = (quote.changePct ?? 0) >= 0;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-zinc-500">{quote.symbol}</p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold">{formatPrice(quote.price, quote.currency)}</p>
          <p className={`text-xs font-medium ${up ? "text-emerald-700 dark:text-lime-300" : "text-rose-600"}`}>
            {formatPct(quote.changePct)}
          </p>
        </div>
        <FavoriteButton
          compact
          saved={saved}
          kind={kind}
          symbol={quote.symbol}
          name={name}
        />
      </div>
    </li>
  );
}
