import { auth } from "@/auth";
import { AssetSearch } from "@/components/asset-search";
import { FavoriteButton } from "@/components/favorite-button";
import { MarketEntryCard } from "@/components/market-entry-card";
import { MarketKindTabs } from "@/components/market-kind-tabs";
import { MarketQuoteRow } from "@/components/market-quote-row";
import { listFavorites } from "@/lib/favorites";
import { analyseQuote, formatPct, formatPrice, pickEntryReads } from "@/lib/market-analysis";
import { universeFor, type MarketKind } from "@/lib/market-universe";
import { fetchQuote, fetchSparkQuotes, type QuoteSnapshot } from "@/lib/quotes";

export const dynamic = "force-dynamic";

function rankedByDay(quotes: QuoteSnapshot[], direction: "up" | "down", limit = 5): QuoteSnapshot[] {
  const withChange = quotes.filter((q) => q.changePct != null);
  const sorted = [...withChange].sort((a, b) =>
    direction === "up"
      ? (b.changePct ?? 0) - (a.changePct ?? 0)
      : (a.changePct ?? 0) - (b.changePct ?? 0),
  );
  return sorted.slice(0, limit);
}

export default async function MercadoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const params = await searchParams;
  const kind: MarketKind = params.tipo === "crypto" ? "crypto" : "stock";
  const session = await auth();
  const userId = session?.user?.id;
  const favorites = userId
    ? (await listFavorites(userId).catch(() => [])).filter((f) => f.kind === kind)
    : [];
  const savedSymbols = new Set(favorites.map((f) => `${f.kind}:${f.symbol}`));

  const universe = universeFor(kind);
  const sparkQuotes = await fetchSparkQuotes(
    universe.map((item) => item.symbol),
    "3mo",
  );
  const bySymbol = new Map(sparkQuotes.map((q) => [q.symbol, q]));
  const famous = universe
    .map((item) => {
      const quote = bySymbol.get(item.symbol);
      if (!quote) return null;
      return { item, quote };
    })
    .filter((row): row is { item: (typeof universe)[number]; quote: QuoteSnapshot } => row != null);

  const gainers = rankedByDay(sparkQuotes, "up");
  const losers = rankedByDay(sparkQuotes, "down");
  const nameBySymbol = new Map(universe.map((item) => [item.symbol, item.name]));
  const entries = pickEntryReads(sparkQuotes, kind, 3);

  const cards = await Promise.all(
    favorites.map(async (fav) => {
      const quote = await fetchQuote(fav.symbol);
      const analysis = quote ? analyseQuote(quote, kind) : null;
      return { fav, quote, analysis };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 dark:text-lime-200">
        Mercado
      </h1>
      <p className="mt-2 max-w-xl text-sm text-emerald-900/70 dark:text-emerald-100/70">
        Ações e crypto em listas separadas. Os teus favoritos ficam em cima,
        com análise. Depois o pulso do dia: entradas, conhecidas, subidas e
        descidas.
      </p>

      <MarketKindTabs kind={kind} />

      <div className="mt-6">
        <AssetSearch
          kind={kind}
          savedSymbols={[...savedSymbols]}
          loggedIn={Boolean(userId)}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
          Os teus favoritos
        </h2>
        {userId && favorites.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            A lista desta tab está vazia. Procura em cima ou adiciona a partir das conhecidas.
          </p>
        ) : null}

        <ul className="mt-4 space-y-8">
          {cards.map(({ fav, quote, analysis }) => (
            <li
              key={fav.id}
              className="rounded-xl border border-emerald-100 bg-white/80 px-4 py-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {kind === "crypto" ? "Crypto" : "Ação"}
                    {fav.extra.exchange ? ` · ${fav.extra.exchange}` : ""}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{fav.name}</h3>
                  <p className="text-xs text-zinc-500">{fav.symbol}</p>
                </div>
                <FavoriteButton
                  compact
                  saved
                  kind={fav.kind}
                  symbol={fav.symbol}
                  name={fav.name}
                  extra={fav.extra}
                />
              </div>

              {quote ? (
                <div className="mt-3 flex flex-wrap gap-6">
                  <div>
                    <p className="text-xl font-semibold">
                      {formatPrice(quote.price, quote.currency)}
                    </p>
                    <p className="text-xs text-zinc-500">Preço</p>
                  </div>
                  <div>
                    <p
                      className={`text-xl font-semibold ${
                        (quote.changePct ?? 0) >= 0
                          ? "text-emerald-700 dark:text-lime-300"
                          : "text-rose-600"
                      }`}
                    >
                      {formatPct(quote.changePct)}
                    </p>
                    <p className="text-xs text-zinc-500">Hoje</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{formatPct(quote.monthPct)}</p>
                    <p className="text-xs text-zinc-500">~1 mês</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Não foi possível ler o preço agora.
                </p>
              )}

              {analysis ? (
                <>
                  <p className="mt-4 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                    {analysis.text}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {analysis.picks.map((pick) => (
                      <li key={pick.risk} className="text-sm leading-6">
                        <span
                          className={
                            pick.risk === "likely"
                              ? "font-semibold text-emerald-800 dark:text-emerald-400"
                              : pick.risk === "risky"
                                ? "font-semibold text-amber-800 dark:text-amber-400"
                                : "font-semibold"
                          }
                        >
                          {pick.riskLabel}: {pick.title}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {" "}
                          — {pick.why}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
          Onde entrar agora
        </h2>
        <p className="mt-2 max-w-xl text-sm text-emerald-900/70 dark:text-emerald-100/65">
          Recuo numa tendência que ainda não partiu. Não é “compra já”: é o
          sítio onde uma posição pequena faz mais sentido do que nas máximas ou
          na queda livre.
        </p>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Hoje ninguém neste grupo está num recuo que valha destacar. Não
            forço nomes só para encher a lista.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {entries.map((read) => (
              <MarketEntryCard
                key={read.quote.symbol}
                kind={kind}
                name={nameBySymbol.get(read.quote.symbol) || read.quote.name}
                read={read}
                saved={savedSymbols.has(`${kind}:${read.quote.symbol}`)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
          Mais conhecidas
        </h2>
        <ul className="mt-3 divide-y divide-emerald-100 dark:divide-emerald-900/60">
          {famous.map(({ item, quote }) => (
            <MarketQuoteRow
              key={item.symbol}
              kind={kind}
              name={item.name}
              quote={quote}
              saved={savedSymbols.has(`${kind}:${quote.symbol}`)}
            />
          ))}
        </ul>
      </section>

      <div className="mt-8 grid items-start gap-x-8 gap-y-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
            Melhor subida
          </h2>
          {gainers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Ninguém subiu neste grupo hoje.</p>
          ) : (
            <ul className="mt-3 divide-y divide-emerald-100 dark:divide-emerald-900/60">
              {gainers.map((quote) => (
                <MarketQuoteRow
                  key={quote.symbol}
                  kind={kind}
                  name={nameBySymbol.get(quote.symbol) || quote.name}
                  quote={quote}
                  saved={savedSymbols.has(`${kind}:${quote.symbol}`)}
                />
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Pior descida
          </h2>
          {losers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Ninguém desceu neste grupo hoje.</p>
          ) : (
            <ul className="mt-3 divide-y divide-emerald-100 dark:divide-emerald-900/60">
              {losers.map((quote) => (
                <MarketQuoteRow
                  key={quote.symbol}
                  kind={kind}
                  name={nameBySymbol.get(quote.symbol) || quote.name}
                  quote={quote}
                  saved={savedSymbols.has(`${kind}:${quote.symbol}`)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs leading-5 text-zinc-500">
        Preços via feed público. As entradas são uma leitura de recuo no grupo
        das conhecidas, não um conselho de compra. Subidas e descidas são do
        mesmo grupo, no dia. Investir envolve risco de perda de capital. Isto
        não é aconselhamento financeiro.
      </p>
    </main>
  );
}
