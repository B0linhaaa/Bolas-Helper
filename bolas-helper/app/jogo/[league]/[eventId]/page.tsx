import Link from "next/link";
import { notFound } from "next/navigation";
import { analyseMatch } from "@/lib/analysis";
import { getMatchDetail } from "@/lib/espn";
import { getLeague } from "@/lib/leagues";
import { formatOdd } from "@/lib/odds";

export const revalidate = 300;

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

  const analysis = analyseMatch(match);
  const book = match.odds;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href={slug === "por.1" ? "/" : `/?liga=${slug}`} className="text-xs text-zinc-500">
        Voltar aos jogos
      </Link>

      <p className="mt-6 text-xs text-zinc-500">
        {league.name}
        {match.venue ? ` · ${match.venue}` : ""} · {formatWhen(match.start)}
        {match.status === "in" ? ` · ${match.minute}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {match.home.name} - {match.away.name}
      </h1>
      {match.status !== "pre" && match.homeScore != null && match.awayScore != null ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {match.homeScore}-{match.awayScore}
        </p>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Análise
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200">
        {analysis.text}
      </p>

      <div className="mt-6 flex flex-wrap gap-6">
        <div>
          <p className="text-xl font-semibold">{pct(analysis.pOver25)}</p>
          <p className="text-xs text-zinc-500">P(Over 2.5) modelo</p>
        </div>
        <div>
          <p className="text-xl font-semibold">{pct(analysis.pBtts)}</p>
          <p className="text-xs text-zinc-500">P(BTTS) modelo</p>
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
            <p className="text-xs text-zinc-500">Odd 1 · {book.bookmaker}</p>
          </div>
        ) : null}
      </div>

      <hr className="my-8 border-zinc-200 dark:border-zinc-800" />

      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Apostas neste jogo
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Três níveis: o mais provável, um cenário possível, e um long shot.
        Não são para apostar os três ao mesmo tempo.
      </p>

      {analysis.picks.length > 0 ? (
        <div className="mt-3 rounded-md border border-zinc-300 bg-zinc-100 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
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
                      ? "text-lg font-semibold text-emerald-800 dark:text-emerald-400"
                      : pick.risk === "risky"
                        ? "text-lg font-semibold text-amber-800 dark:text-amber-400"
                        : "text-lg font-semibold text-zinc-800 dark:text-zinc-200"
                  }
                >
                  {pick.market} - {formatOdd(pick.odd)}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {pct(pick.modelProb)}
                    {pick.oddFromBook ? "" : " · odd justa"}
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

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">
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
