import Link from "next/link";
import { auth } from "@/auth";
import { TeamSearch } from "@/components/team-search";
import { listUpcoming, listUpcomingForFavoriteTeams } from "@/lib/espn";
import { listFavorites } from "@/lib/favorites";
import { DEFAULT_LEAGUE, LEAGUES, getLeague } from "@/lib/leagues";
import { formatOdd } from "@/lib/odds";
import type { ListedMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ liga?: string; favoritos?: string }>;
}) {
  const params = await searchParams;
  const mine = params.favoritos === "1";
  const liga = getLeague(params.liga ?? "")?.slug ?? DEFAULT_LEAGUE;
  const league = getLeague(liga)!;
  const session = await auth();
  const userId = session?.user?.id;
  const teamFavorites = userId
    ? await listFavorites(userId, "team").catch(() => [])
    : [];
  const savedTeamIds = new Set(teamFavorites.map((f) => f.symbol));
  let matches: ListedMatch[] = [];
  let error = "";
  try {
    if (mine) {
      matches = await listUpcomingForFavoriteTeams(
        teamFavorites.map((fav) => ({ id: fav.symbol, league: fav.extra.league })),
      );
    } else {
      matches = await listUpcoming(liga, league.name);
    }
  } catch {
    error = "Não foi possível ler os jogos agora. Tenta daqui a um minuto.";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 dark:text-lime-200">
        Jogos
      </h1>
      <p className="mt-2 max-w-xl text-sm text-emerald-900/70 dark:text-emerald-100/70">
        Análise dos resultados recentes. Em cada jogo: uma aposta mais
        provável, uma arriscada, e uma muito arriscada.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        {process.env.NOTIFY_EMAIL
          ? "Email quando as odds abrirem nos jogos das tuas equipas. Em local: `npm run watch-odds`. No Vercel o cron corre de manhã."
          : "Para email via SMTP: preenche .env.local e corre `npm run test-email`."}
      </p>

      <div className="mt-6">
        <TeamSearch savedIds={[...savedTeamIds]} loggedIn={Boolean(userId)} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        <Link
          href={mine ? "/" : "/?favoritos=1"}
          className={`rounded-full border px-3 py-1 text-xs ${
            mine
              ? "border-lime-300 bg-lime-300 font-semibold text-emerald-950"
              : "border-emerald-200 bg-white/70 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
          }`}
        >
          As minhas equipas
        </Link>
        {LEAGUES.map((item) => (
          <Link
            key={item.slug}
            href={item.slug === DEFAULT_LEAGUE ? "/" : `/?liga=${item.slug}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              !mine && item.slug === liga
                ? "border-lime-300 bg-lime-300 font-semibold text-emerald-950"
                : "border-emerald-200 bg-white/70 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {error ? <p className="mt-8 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-8 divide-y divide-emerald-100 dark:divide-emerald-900/60">
        {matches.map((match) => (
          <li key={match.eventId}>
            <Link
              href={`/jogo/${encodeURIComponent(match.league)}/${match.eventId}`}
              className="flex items-center justify-between gap-4 rounded-xl px-2 py-4 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40"
            >
              <div>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70">
                  {formatWhen(match.start)}
                  {mine ? ` · ${match.leagueName}` : ""}
                  {match.status === "in" ? (
                    <span className="ml-1 font-semibold text-rose-600"> · {match.minute}</span>
                  ) : (
                    ""
                  )}
                </p>
                <p className="mt-1 font-medium text-emerald-950 dark:text-emerald-50">
                  {match.home.name} - {match.away.name}
                </p>
                {match.odds?.over != null && match.odds.overLine != null ? (
                  <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-lime-300">
                    Over {match.odds.overLine} {formatOdd(match.odds.over)}
                    {match.odds.home != null
                      ? ` · 1 ${formatOdd(match.odds.home)}`
                      : ""}
                  </p>
                ) : match.odds?.home != null ? (
                  <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-lime-300">
                    1 {formatOdd(match.odds.home)}
                    {match.odds.draw != null ? ` · X ${formatOdd(match.odds.draw)}` : ""}
                    {match.odds.away != null ? ` · 2 ${formatOdd(match.odds.away)}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">Odds ainda não no feed</p>
                )}
              </div>
              <span className="text-xs font-medium text-emerald-700 dark:text-lime-300">Abrir</span>
            </Link>
          </li>
        ))}
      </ul>

      {matches.length === 0 && !error ? (
        <p className="mt-8 text-sm text-zinc-500">
          {mine
            ? userId
              ? teamFavorites.length === 0
                ? "Adiciona equipas aos favoritos para veres aqui os jogos delas (liga e europeias)."
                : "Sem jogos futuros nestas equipas no feed."
              : "Entra com Google para veres os jogos das tuas equipas."
            : "Sem jogos nos próximos 8 dias nesta competição."}
        </p>
      ) : null}
    </main>
  );
}
