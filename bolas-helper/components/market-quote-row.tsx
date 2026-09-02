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
    <li className="flex items-center gap-2 py-1">
      <p className="min-w-0 flex-1 truncate text-sm leading-5">
        <span className="font-medium">{name}</span>
        <span className="ml-1.5 text-[11px] text-zinc-500">{quote.symbol}</span>
      </p>
      <p className="shrink-0 text-sm font-semibold tabular-nums leading-5">
        {formatPrice(quote.price, quote.currency)}
      </p>
      <p
        className={`w-12 shrink-0 text-right text-[11px] font-medium tabular-nums leading-5 ${
          up ? "text-emerald-700 dark:text-lime-300" : "text-rose-600"
        }`}
      >
        {formatPct(quote.changePct)}
      </p>
      <FavoriteButton
        compact
        saved={saved}
        kind={kind}
        symbol={quote.symbol}
        name={name}
      />
    </li>
  );
}
