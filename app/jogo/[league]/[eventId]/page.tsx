import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { FavoriteButton } from "@/components/favorite-button";
import { analyseMatch } from "@/lib/analysis";
import { getMatchDetail } from "@/lib/espn";
import { listFavorites } from "@/lib/favorites";
import { getLeague } from "@/lib/leagues";
import { formatOdd } from "@/lib/odds";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function JogoPage({
  params,
}: {
  params: Promise<{ league: string; eventId: string }>;
}) {
  const { league: leagueParam, eventId } = await params;
  const slug = decodeURIComponent(leagueParam);
  const league = getLeague(slug);
  if (!league) notFound();

  let match;
  try {
    match = await getMatchDetail(slug, league.name, eventId);
  } catch {
    match = null;
  }
  if (!match) notFound();

  const session = await auth();
  const savedTeams = session?.user?.id
    ? new Set(
        (await listFavorites(session.user.id, "team").catch(() => [])).map((f) => f.symbol),
      )
    : new Set<string>();
  const loggedIn = Boolean(session?.user?.id);

  const analysis = analyseMatch(match);
  const book = match.odds;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href={slug === "por.1" ? "/" : `/?liga=${slug}`} className="text-xs font-medium text-emerald-700 dark:text-lime-300">
        Voltar aos jogos
      </Link>

      <p className="mt-6 text-xs text-emerald-800/70 dark:text-emerald-200/70">
        {league.name}
        {match.venue ? ` · ${match.venue}` : ""} · {formatWhen(match.start)}
        {match.status === "in" ? ` · ${match.minute}` : ""}
      </p>
      <h1 className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight text-emerald-950 dark:text-lime-200">
        <span className="inline-flex min-w-0 items-center gap-1">
          {loggedIn ? (
            <FavoriteButton
              compact
              saved={savedTeams.has(match.home.id)}
              kind="team"
              symbol={match.home.id}
              name={match.home.name}
              extra={{ league: slug, logo: match.home.logo }}
            />
          ) : null}
          <span className="truncate">{match.home.name}</span>
        </span>
        <span className="font-normal text-emerald-700/70 dark:text-lime-200/50">–</span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="truncate">{match.away.name}</span>
          {loggedIn ? (
            <FavoriteButton
              compact
              saved={savedTeams.has(match.away.id)}
              kind="team"
              symbol={match.away.id}
              name={match.away.name}
              extra={{ league: slug, logo: match.away.logo }}
            />
          ) : null}
        </span>
      </h1>
      {match.status === "in" ? (
        <p className="mt-2 text-lg font-semibold text-rose-600">
          Ao vivo · {match.minute}
          {match.homeScore != null && match.awayScore != null
            ? ` · ${match.homeScore}–${match.awayScore}`
            : ""}
        </p>
      ) : match.status !== "pre" && match.homeScore != null && match.awayScore != null ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {match.homeScore}-{match.awayScore}
        </p>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
        Análise
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200">
        {analysis.text}
      </p>

      <div className="mt-6 flex flex-wrap gap-6">
        <div>
          <p className="text-xl font-semibold">{pct(analysis.pOver25)}</p>
          <p className="text-xs text-zinc-500">Prob. mais de 2,5 golos</p>
        </div>
        <div>
          <p className="text-xl font-semibold">{pct(analysis.pBtts)}</p>
          <p className="text-xs text-zinc-500">Prob. ambas marcam</p>
        </div>
        <div>
          <p className="text-xl font-semibold">
            {analysis.lambdaHome.toFixed(2)} / {analysis.lambdaAway.toFixed(2)}
          </p>
          <p className="text-xs text-zinc-500">Golos esperados</p>
        </div>
        {book?.home != null ? (
          <div>
            <p className="text-xl font-semibold">{formatOdd(book.home)}</p>
            <p className="text-xs text-zinc-500">
              {match.home.name} a ganhar · {book.bookmaker}
            </p>
          </div>
        ) : null}
      </div>

      <hr className="my-8 border-emerald-100 dark:border-emerald-900" />

      <p className="text-xs uppercase tracking-wide text-emerald-800 dark:text-lime-300">
        Apostas neste jogo
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Três níveis: o mais provável, um cenário possível, e um long shot.
        Não são para apostar os três ao mesmo tempo.
      </p>

      {analysis.picks.length > 0 ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-semibold">
            {match.home.name} - {match.away.name}
          </p>
          <ul className="mt-3 space-y-3">
            {analysis.picks.map((pick) => (
              <li key={pick.risk}>
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  {pick.riskLabel}
                </p>
                <p
                  className={
                    pick.risk === "likely"
                      ? "text-lg font-semibold text-emerald-800 dark:text-lime-300"
                      : pick.risk === "risky"
                        ? "text-lg font-semibold text-amber-700 dark:text-amber-300"
                        : "text-lg font-semibold text-rose-800 dark:text-rose-300"
                  }
                >
                  {pick.market} · {formatOdd(pick.odd)}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    modelo {pct(pick.modelProb)}
                    {pick.oddFromBook
                      ? ` · casa implica ${pct(pick.impliedProb)}`
                      : " · odd justa do modelo"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            {book
              ? `Odds ${book.bookmaker} quando o mercado existe. Sem odd de casa, mostramos a odd justa do modelo.`
              : "Ainda sem odd de casa neste jogo — as linhas são odd justa do modelo (1 / probabilidade)."}
          </p>
        </div>
      ) : null}

      {analysis.picks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {analysis.picks.map((pick) => (
            <li key={`${pick.risk}-why`} className="text-sm leading-6">
              <span className="font-semibold">
                {pick.riskLabel}: {pick.market} · {formatOdd(pick.odd)}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400"> — {pick.why}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
        Jogos usados
      </h2>
      <FormTable title={match.home.name} games={match.homeForm} />
      <FormTable title={match.away.name} games={match.awayForm} />

      <p className="mt-8 text-xs leading-5 text-zinc-500">
        Resultados e odds via feed público ESPN/DraftKings quando existem.
        Apostas envolvem risco. 18+.
      </p>
    </main>
  );
}

function FormTable({
  title,
  games,
}: {
  title: string;
  games: { date: string; competition: string; opponent: string; venue: string; goalsFor: number; goalsAgainst: number }[];
}) {
  if (games.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500">{title}: sem histórico recente neste feed.</p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">{title}</p>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-1 pr-2 font-medium">Data</th>
            <th className="py-1 pr-2 font-medium">Adv.</th>
            <th className="py-1 pr-2 font-medium">Comp.</th>
            <th className="py-1 pr-2 font-medium">Loc.</th>
            <th className="py-1 font-medium">Res.</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={`${game.date}-${game.opponent}`} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1.5 pr-2 whitespace-nowrap">
                {game.date.slice(0, 10)}
              </td>
              <td className="py-1.5 pr-2">{game.opponent}</td>
              <td className="py-1.5 pr-2">{game.competition}</td>
              <td className="py-1.5 pr-2">{game.venue}</td>
              <td className="py-1.5">
                {game.goalsFor}-{game.goalsAgainst}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
