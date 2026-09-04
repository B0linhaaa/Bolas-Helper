import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { FormName } from "@/components/form-pills";
import { TeamSearch } from "@/components/team-search";
import { BriefingSkeleton, TodayBriefing } from "@/components/today-briefing";
import { listUpcoming, listUpcomingForFavoriteTeams } from "@/lib/espn";
import { listFavorites } from "@/lib/favorites";
import { DEFAULT_LEAGUE, LEAGUES, getLeague } from "@/lib/leagues";
import { formatWhenLisbon, isLisbonToday } from "@/lib/time";
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
  const session = await auth();
  const userId = session?.user?.id;
  const favorites = userId ? await listFavorites(userId).catch(() => []) : [];
  const teamFavorites = favorites.filter((fav) => fav.kind === "team");
  const assetFavorites = favorites.filter((fav) => fav.kind === "stock" || fav.kind === "crypto");
  const savedTeamIds = new Set(teamFavorites.map((f) => f.symbol));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-emerald-950 dark:text-lime-200">
        Hoje
      </h1>
      <p className="mt-2 max-w-xl text-sm text-emerald-900/70 dark:text-emerald-100/70">
        Assistente de análise: abres e vês o que já foi lido nos jogos e no
        mercado. Não é para construíres o relatório — é para o reveres.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        {process.env.NOTIFY_EMAIL
          ? "De manhã: resumo da jornada por email. Depois, alerta se as odds ou um favorito do mercado mexerem ≥ 5%."
          : "Para email via SMTP: preenche .env.local e corre `npm run test-email`."}
      </p>

      <Suspense fallback={<BriefingSkeleton />}>
        <TodayBriefing
          loggedIn={Boolean(userId)}
          teamFavorites={teamFavorites}
          assetFavorites={assetFavorites}
        />
      </Suspense>

      <div className="mt-10">
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

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-emerald-800 dark:text-lime-300">
        Lista de jogos
      </h2>

      <Suspense
        fallback={
          <div className="mt-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-3">
                <div className="flex-1 space-y-2">
                  <div className="bh-bar w-24" />
                  <div className="bh-bar w-48" />
                </div>
                <div className="bh-bar ml-4 h-5 w-12" />
              </div>
            ))}
          </div>
        }
      >
        <MatchBrowser
          mine={mine}
          when={when}
          liga={liga}
          loggedIn={Boolean(userId)}
          teamFavorites={teamFavorites}
        />
      </Suspense>
    </main>
  );
}

async function MatchBrowser({
  mine,
  when,
  liga,
  loggedIn,
  teamFavorites,
}: {
  mine: boolean;
  when: WhenFilter;
  liga: string;
  loggedIn: boolean;
  teamFavorites: Awaited<ReturnType<typeof listFavorites>>;
}) {
  const league = getLeague(liga)!;
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

  return (
    <>
      {error ? <p className="mt-8 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-4 divide-y divide-emerald-100 dark:divide-emerald-900/60">
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
                    <span>Fim · {formatWhenLisbon(match.start)}</span>
                  ) : (
                    formatWhenLisbon(match.start)
                  )}
                  {mine ? ` · ${match.leagueName}` : ""}
                </p>
                <p className="mt-1 font-medium text-emerald-950 dark:text-emerald-50">
                  <FormName name={match.home.name} letters={match.homeRecent} />
                  {match.status !== "pre" && match.homeScore != null && match.awayScore != null
                    ? ` ${match.homeScore}–${match.awayScore} `
                    : " – "}
                  <FormName name={match.away.name} letters={match.awayRecent} />
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-lime-300">
                {match.status === "in" ? "Ao vivo" : match.status === "post" ? "Fim" : "Análise"}
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
                ? loggedIn
                  ? teamFavorites.length === 0
                    ? "Adiciona equipas aos favoritos para veres aqui os jogos delas (liga e europeias)."
                    : "Sem jogos futuros nestas equipas no feed."
                  : "Entra com Google para veres os jogos das tuas equipas."
                : "Sem jogos nos próximos 8 dias nesta competição."}
        </p>
      ) : null}
    </>
  );
}
