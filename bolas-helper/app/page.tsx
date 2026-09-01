import Link from "next/link";
import { DEFAULT_LEAGUE, LEAGUES, getLeague } from "@/lib/leagues";
import { listUpcoming } from "@/lib/espn";
import { formatOdd } from "@/lib/odds";
import type { ListedMatch } from "@/lib/types";

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
  searchParams: Promise<{ liga?: string }>;
}) {
  const params = await searchParams;
  const liga = getLeague(params.liga ?? "")?.slug ?? DEFAULT_LEAGUE;
  const league = getLeague(liga)!;
  let matches: ListedMatch[] = [];
  let error = "";
  try {
    matches = await listUpcoming(liga, league.name);
    const { rememberListedMatches } = await import("@/lib/odds-watch");
    await rememberListedMatches(matches).catch(() => undefined);
  } catch {
    error = "Não foi possível ler os jogos agora. Tenta daqui a um minuto.";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Jogos</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Análise dos resultados recentes. Em cada jogo: uma aposta mais
        provável, uma arriscada, e uma muito arriscada.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        {process.env.NOTIFY_EMAIL
          ? "Aviso por email quando as odds abrirem: ativo. Corre também `npm run watch-odds` com o site ligado."
          : "Para email via SMTP quando as odds abrirem: preenche .env.local (Gmail + palavra-passe de aplicação) e corre `npm run test-email`."}
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {LEAGUES.map((item) => (
          <Link
            key={item.slug}
            href={item.slug === DEFAULT_LEAGUE ? "/" : `/?liga=${item.slug}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              item.slug === liga
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {error ? <p className="mt-8 text-sm text-red-700">{error}</p> : null}

      <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
        {matches.map((match) => (
          <li key={match.eventId}>
            <Link
              href={`/jogo/${encodeURIComponent(match.league)}/${match.eventId}`}
              className="flex items-center justify-between gap-4 py-4 hover:opacity-80"
            >
              <div>
                <p className="text-xs text-zinc-500">
                  {formatWhen(match.start)}
                  {match.status === "in" ? ` · ${match.minute}` : ""}
                </p>
                <p className="mt-1 font-medium">
                  {match.home.name} - {match.away.name}
                </p>
                {match.odds?.over != null && match.odds.overLine != null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Over {match.odds.overLine} {formatOdd(match.odds.over)}
                    {match.odds.home != null
                      ? ` · 1 ${formatOdd(match.odds.home)}`
                      : ""}
                  </p>
                ) : match.odds?.home != null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    1 {formatOdd(match.odds.home)}
                    {match.odds.draw != null ? ` · X ${formatOdd(match.odds.draw)}` : ""}
                    {match.odds.away != null ? ` · 2 ${formatOdd(match.odds.away)}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">Odds ainda não no feed</p>
                )}
              </div>
              <span className="text-xs text-zinc-400">Abrir</span>
            </Link>
          </li>
        ))}
      </ul>

      {matches.length === 0 && !error ? (
        <p className="mt-8 text-sm text-zinc-500">
          Sem jogos nos próximos 8 dias nesta competição.
        </p>
      ) : null}
    </main>
  );
}
