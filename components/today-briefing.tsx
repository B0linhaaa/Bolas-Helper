import Link from "next/link";
import { FormName } from "@/components/form-pills";
import { loadBriefing, likelyLine, type BriefingData, type BriefingGame, type BriefingQuote } from "@/lib/briefing";
import type { Favorite } from "@/lib/favorites";
import { resultLabel } from "@/lib/picks";
import { formatWhenLisbon } from "@/lib/time";

function whenLabel(game: BriefingGame): string {
  if (game.status === "in") {
    return `Ao vivo${game.minute ? ` · ${game.minute}` : ""}`;
  }
  if (game.status === "post") return `Fim · ${formatWhenLisbon(game.start)}`;
  return formatWhenLisbon(game.start);
}

function QuoteLine({ row }: { row: BriefingQuote }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 truncate text-emerald-950 dark:text-emerald-50">{row.name}</span>
      <span className="shrink-0 tabular-nums">
        <span className="text-zinc-500">{row.priceLabel}</span>
        <span
          className={`ml-2 font-semibold ${
            row.up ? "text-emerald-700 dark:text-lime-300" : "text-rose-600 dark:text-rose-300"
          }`}
        >
          {row.changeLabel}
        </span>
      </span>
    </p>
  );
}

function GameLine({ game }: { game: BriefingGame }) {
  const live = game.status === "in";
  return (
    <li>
      <Link
        href={`/jogo/${encodeURIComponent(game.league)}/${game.eventId}`}
        className="block rounded-lg px-1 py-2.5 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40"
      >
        <p
          className={`text-[11px] ${live ? "font-semibold text-rose-600" : "text-zinc-500"}`}
          suppressHydrationWarning
        >
          {whenLabel(game)}
          {game.leagueName ? ` · ${game.leagueName}` : ""}
        </p>
        <p className="mt-0.5 font-medium text-emerald-950 dark:text-emerald-50">
          <FormName name={game.homeName} letters={game.homeRecent} />
          {game.status !== "pre" && game.homeScore != null && game.awayScore != null
            ? ` ${game.homeScore}–${game.awayScore} `
            : " – "}
          <FormName name={game.awayName} letters={game.awayRecent} />
        </p>
        {game.likely ? (
          <p className="mt-1 text-xs text-emerald-800 dark:text-lime-200/80">
            {likelyLine(game.likely)}
            {game.likelyResult ? (
              <span className="ml-2 font-semibold text-zinc-500">{resultLabel(game.likelyResult)}</span>
            ) : null}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-lime-300">
          Análise detalhada
        </p>
      </Link>
    </li>
  );
}

export function BriefingSkeleton() {
  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-100 bg-white/60 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="bh-bar h-3 w-24" />
        <div className="mt-4 space-y-3">
          <div className="bh-bar h-10 w-full" />
          <div className="bh-bar h-10 w-full" />
          <div className="bh-bar h-10 w-full" />
        </div>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-white/60 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="bh-bar h-3 w-24" />
        <div className="mt-4 space-y-3">
          <div className="bh-bar h-8 w-full" />
          <div className="bh-bar h-8 w-full" />
          <div className="bh-bar h-8 w-full" />
        </div>
      </div>
    </section>
  );
}

export function TodayBriefingView({
  data,
  loggedIn,
}: {
  data: BriefingData;
  loggedIn: boolean;
}) {
  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-emerald-200 bg-white/80 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
              Jogos de hoje
            </h2>
            <Link href="/?quando=hoje" className="text-[11px] font-semibold text-emerald-700 dark:text-lime-300">
              Ver lista
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {data.fromFavorites
              ? "As tuas equipas. Abre um jogo para ver o porquê de cada odd."
              : "O recorte do dia. Abre um jogo para ver o porquê de cada odd."}
          </p>
          {data.games.length > 0 ? (
            <ul className="mt-2 divide-y divide-emerald-100 dark:divide-emerald-900/60">
              {data.games.map((game) => (
                <GameLine key={game.eventId} game={game} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              {data.fromFavorites
                ? "As tuas equipas não jogam hoje neste feed."
                : "Sem jogos hoje no recorte. A lista em baixo mostra os próximos."}
            </p>
          )}
        </article>

        <article className="rounded-xl border border-emerald-200 bg-white/80 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
              Mercado
            </h2>
            <Link href="/mercado" className="text-[11px] font-semibold text-emerald-700 dark:text-lime-300">
              Abrir mercado
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Pulso do dia: favoritos, maior movimento, e uma leitura de entrada.
          </p>

          {data.marketFavorites.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Os teus</p>
              {data.marketFavorites.map((row) => (
                <QuoteLine key={row.symbol} row={row} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              {loggedIn
                ? "Sem favoritos de mercado — o pulso em baixo é do grupo das conhecidas."
                : "Entra para veres os teus ativos aqui. Entretanto, o pulso das conhecidas:"}
            </p>
          )}

          <div className="mt-4 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pulso</p>
            {data.gainer ? (
              <div>
                <p className="text-[11px] text-zinc-500">Maior subida</p>
                <QuoteLine row={data.gainer} />
              </div>
            ) : null}
            {data.loser ? (
              <div>
                <p className="text-[11px] text-zinc-500">Maior descida</p>
                <QuoteLine row={data.loser} />
              </div>
            ) : null}
            {!data.gainer && !data.loser ? (
              <p className="text-sm text-zinc-500">Cotações indisponíveis neste momento.</p>
            ) : null}
          </div>

          {data.entry ? (
            <div className="mt-4 border-t border-emerald-100 pt-3 dark:border-emerald-900/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Leitura de entrada</p>
              <p className="mt-1 text-sm font-medium text-emerald-950 dark:text-emerald-50">
                {data.entry.name}
                <span
                  className={`ml-2 text-xs font-semibold ${
                    data.entry.up ? "text-emerald-700 dark:text-lime-300" : "text-rose-600"
                  }`}
                >
                  {data.entry.changeLabel}
                </span>
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                {data.entry.title}. {data.entry.why}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-zinc-500">
              Hoje ninguém no grupo está num recuo que valha destacar.
            </p>
          )}
        </article>
      </div>

      {data.yesterday.length > 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-white/60 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
            Ontem
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            A linha mais provável, congelada antes do jogo — não o modelo depois do resultado.
          </p>
          <ul className="mt-2 space-y-1">
            {data.yesterday.map((row) => {
              const likely = row.picks.find((pick) => pick.risk === "likely") ?? row.picks[0];
              const tone =
                row.likelyResult === "hit"
                  ? "text-emerald-700 dark:text-lime-300"
                  : row.likelyResult === "miss"
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-amber-700 dark:text-amber-300";
              return (
                <li key={row.eventId}>
                  <Link
                    href={`/jogo/${encodeURIComponent(row.league)}/${row.eventId}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-1 py-2 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40"
                  >
                    <span className="text-sm text-emerald-950 dark:text-emerald-50">
                      {row.name}
                      {row.homeScore != null ? ` ${row.homeScore}–${row.awayScore}` : ""}
                      {likely ? ` · ${likely.market}` : ""}
                    </span>
                    {row.likelyResult ? (
                      <span className={`text-xs font-semibold ${tone}`}>{resultLabel(row.likelyResult)}</span>
                    ) : (
                      <span className="text-xs text-zinc-500">A aguardar fecho</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export async function TodayBriefing({
  loggedIn,
  teamFavorites,
  assetFavorites,
}: {
  loggedIn: boolean;
  teamFavorites: Favorite[];
  assetFavorites: Favorite[];
}) {
  const data = await loadBriefing({ teamFavorites, assetFavorites });
  return <TodayBriefingView data={data} loggedIn={loggedIn} />;
}

