import Link from "next/link";
import { auth } from "@/auth";
import { FormName } from "@/components/form-pills";
import { TeamSearch } from "@/components/team-search";
import { listUpcoming, listUpcomingForFavoriteTeams } from "@/lib/espn";
import { listFavorites } from "@/lib/favorites";
import { DEFAULT_LEAGUE, LEAGUES, getLeague } from "@/lib/leagues";
import { listRecentPickSnapshots, resultLabel } from "@/lib/picks";
import { isLisbonToday } from "@/lib/time";
import type { ListedMatch } from "@/lib/types";

type WhenFilter = "todos" | "hoje" | "vivo";

function sortMatches(matches: ListedMatch[]): ListedMatch[] {
  const rank = (status: ListedMatch["status"]) =>
    status === "in" ? 0 : status === "pre" ? 1 : 2;
  return [...matches].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return a.start.localeCompare(b.start);
  });
}

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

function homeHref(opts: { mine?: boolean; liga?: string; quando?: WhenFilter }): string {
  const params = new URLSearchParams();
  if (opts.mine) params.set("favoritos", "1");
  else if (opts.liga && opts.liga !== DEFAULT_LEAGUE) params.set("liga", opts.liga);
  if (opts.quando && opts.quando !== "todos") params.set("quando", opts.quando);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function chipClass(active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs ${
    active
      ? "border-lime-300 bg-lime-300 font-semibold text-emerald-950"
      : "border-emerald-200 bg-white/70 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
  }`;
}

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ liga?: string; favoritos?: string; quando?: string }>;
}) {
  const params = await searchParams;
  const mine = params.favoritos === "1";
  const when: WhenFilter =
    params.quando === "hoje" || params.quando === "vivo" ? params.quando : "todos";
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
  const includePost = when !== "todos";
  try {
    if (mine) {
      matches = await listUpcomingForFavoriteTeams(
        teamFavorites.map((fav) => ({ id: fav.symbol, league: fav.extra.league })),
        { includePost },
      );
    } else {
      matches = await listUpcoming(liga, league.name, {
        days: when === "todos" ? 8 : 2,
        includePost,
      });
    }
    if (when === "hoje") {
      matches = matches.filter((match) => match.status === "in" || isLisbonToday(match.start));
    } else if (when === "vivo") {
      matches = matches.filter((match) => match.status === "in");
    }
  } catch {
    error = "Não foi possível ler os jogos agora. Tenta daqui a um minuto.";
  }

  const snapshots = await listRecentPickSnapshots(
    6,
    mine ? savedTeamIds : undefined,
  ).catch(() => []);

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
          ? "De manhã: resumo da jornada. Depois, email se as odds abrirem ou mexerem ≥ 5%, ou se um favorito do mercado mexer ≥ 5%."
          : "Para email via SMTP: preenche .env.local e corre `npm run test-email`."}
      </p>

      <div className="mt-6">
        <TeamSearch savedIds={[...savedTeamIds]} loggedIn={Boolean(userId)} />
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {(["todos", "hoje", "vivo"] as const).map((item) => (
          <Link
            key={item}
            href={homeHref({ mine, liga, quando: item })}
            className={chipClass(when === item)}
          >
            {item === "todos" ? "Todos" : item === "hoje" ? "Hoje" : "Ao vivo"}
          </Link>
        ))}
      </nav>

      <nav className="mt-3 flex flex-wrap gap-2">
        <Link href={homeHref({ mine: !mine ? true : false, quando: when })} className={chipClass(mine)}>
          As minhas equipas
        </Link>
        {LEAGUES.map((item) => (
          <Link
            key={item.slug}
            href={homeHref({ liga: item.slug, quando: when })}
            className={chipClass(!mine && item.slug === liga)}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {error ? <p className="mt-8 text-sm text-red-700">{error}</p> : null}

      {snapshots.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
            Balanço dos picks
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            A aposta mais provável, congelada antes do jogo — não o modelo depois do resultado.
          </p>
          <ul className="mt-3 space-y-2">
            {snapshots.map((row) => {
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
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-2 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40"
                  >
                    <span className="text-sm text-emerald-950 dark:text-emerald-50">
                      {row.name}
                      {row.homeScore != null ? ` ${row.homeScore}–${row.awayScore}` : ""}
                      {likely ? ` · ${likely.market}` : ""}
                    </span>
                    {row.likelyResult ? (
                      <span className={`text-xs font-semibold ${tone}`}>
                        {resultLabel(row.likelyResult)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ul className="mt-8 divide-y divide-emerald-100 dark:divide-emerald-900/60">
        {sortMatches(matches).map((match) => (
          <li key={match.eventId}>
            <Link
              href={`/jogo/${encodeURIComponent(match.league)}/${match.eventId}`}
              className="flex items-center justify-between gap-4 rounded-xl px-2 py-4 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/40"
            >
              <div>
                <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70" suppressHydrationWarning>
                  {match.status === "in" ? (
                    <span className="font-semibold text-rose-600">
                      Ao vivo{match.minute ? ` · ${match.minute}` : ""}
                    </span>
                  ) : match.status === "post" ? (
                    <span>Fim · {formatWhen(match.start)}</span>
                  ) : (
                    formatWhen(match.start)
                  )}
                  {mine ? ` · ${match.leagueName}` : ""}
                </p>
                <p className="mt-1 font-medium text-emerald-950 dark:text-emerald-50">
                  <FormName name={match.home.name} letters={match.homeRecent} />
                  {match.status !== "pre" &&
                  match.homeScore != null &&
                  match.awayScore != null
                    ? ` ${match.homeScore}–${match.awayScore} `
                    : " – "}
                  <FormName name={match.away.name} letters={match.awayRecent} />
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-lime-300">
                {match.status === "in" ? "Ao vivo" : match.status === "post" ? "Fim" : "Abrir"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {matches.length === 0 && !error ? (
        <p className="mt-8 text-sm text-zinc-500">
          {when === "vivo"
            ? "Nenhum jogo ao vivo neste recorte."
            : when === "hoje"
              ? mine
                ? "As tuas equipas não jogam hoje neste feed."
                : "Sem jogos hoje nesta competição."
              : mine
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
