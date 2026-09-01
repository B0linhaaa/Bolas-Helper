import { espnOddsToBook } from "./odds";
import type { ListedMatch, MatchDetail, MatchStatus, PastGame } from "./types";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

async function espnGet(path: string, fresh = false): Promise<unknown> {
  const res = await fetch(`${ESPN}/${path}`, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 1200 } }),
    headers: {
      Accept: "application/json",
      "User-Agent": "BolasHelper/0.1 (personal match analysis)",
    },
  });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${path}`);
  }
  return res.json();
}

function yyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function scoreValue(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object" && "value" in raw) {
    const v = (raw as { value: unknown }).value;
    return typeof v === "number" ? v : Number(v);
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function statusFrom(raw: unknown): { status: MatchStatus; minute: string } {
  const type = (raw as { type?: { state?: string; detail?: string; shortDetail?: string } })
    ?.type;
  const state = type?.state;
  const minute = type?.shortDetail || type?.detail || "";
  if (state === "in") return { status: "in", minute };
  if (state === "post") return { status: "post", minute: "Fim" };
  return { status: "pre", minute: "" };
}

function parseEvent(event: Record<string, unknown>, leagueSlug: string, leagueName: string): ListedMatch | null {
  const competitions = event.competitions as Record<string, unknown>[] | undefined;
  const comp = competitions?.[0] ?? event;
  const competitors = (comp.competitors as Record<string, unknown>[]) ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const homeTeam = home.team as Record<string, unknown>;
  const awayTeam = away.team as Record<string, unknown>;
  const { status, minute } = statusFrom(comp.status ?? event.status);
  const oddsRaw = ((comp.odds as unknown[]) ?? (event.odds as unknown[]) ?? [])[0];
  const venue = (comp.venue as { fullName?: string } | undefined)?.fullName
    || (event.venue as { displayName?: string } | undefined)?.displayName
    || "";

  return {
    eventId: String(event.id),
    league: leagueSlug,
    leagueName,
    start: String(event.date ?? comp.date ?? ""),
    venue,
    home: {
      id: String(homeTeam.id),
      name: String(homeTeam.displayName ?? homeTeam.name),
      logo: String(homeTeam.logo ?? ""),
    },
    away: {
      id: String(awayTeam.id),
      name: String(awayTeam.displayName ?? awayTeam.name),
      logo: String(awayTeam.logo ?? ""),
    },
    status,
    minute,
    homeScore: scoreValue(home.score),
    awayScore: scoreValue(away.score),
    odds: espnOddsToBook(oddsRaw),
  };
}

export async function listUpcoming(
  leagueSlug: string,
  leagueName: string,
  options: { days?: number; fresh?: boolean } = {},
): Promise<ListedMatch[]> {
  const span = options.days ?? 8;
  const days = Array.from({ length: span }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    return yyyymmdd(d);
  });

  const payloads = await Promise.all(
    days.map(async (day) => {
      try {
        return (await espnGet(
          `${leagueSlug}/scoreboard?dates=${day}`,
          options.fresh,
        )) as Record<string, unknown>;
      } catch {
        return { events: [] };
      }
    }),
  );

  const seen = new Set<string>();
  const matches: ListedMatch[] = [];
  for (const payload of payloads) {
    const events = (payload.events as Record<string, unknown>[]) ?? [];
    for (const event of events) {
      const match = parseEvent(event, leagueSlug, leagueName);
      if (!match || seen.has(match.eventId)) continue;
      seen.add(match.eventId);
      if (match.status === "post") continue;
      matches.push(match);
    }
  }

  return matches.sort((a, b) => a.start.localeCompare(b.start));
}

function mapLastFive(raw: unknown, teamId: string): PastGame[] {
  const groups = Array.isArray(raw) ? raw : [];
  const group = groups.find((g) => String((g as { team?: { id?: string } }).team?.id) === teamId)
    ?? groups[0];
  const events = ((group as { events?: Record<string, unknown>[] } | undefined)?.events) ?? [];

  return events
    .map((ev): PastGame | null => {
      const homeId = String(ev.homeTeamId ?? "");
      const gf = Number(homeId === teamId ? ev.homeTeamScore : ev.awayTeamScore);
      const ga = Number(homeId === teamId ? ev.awayTeamScore : ev.homeTeamScore);
      if (!Number.isFinite(gf) || !Number.isFinite(ga)) return null;
      const result = (ev.gameResult as PastGame["result"]) || (gf > ga ? "W" : gf < ga ? "L" : "D");
      const opponent = (ev.opponent as { displayName?: string } | undefined)?.displayName || "Adversário";
      return {
        date: String(ev.gameDate ?? ""),
        competition: String(ev.leagueName || ev.competitionName || ""),
        opponent,
        venue: homeId === teamId ? "Casa" : "Fora",
        goalsFor: gf,
        goalsAgainst: ga,
        result,
      };
    })
    .filter((g): g is PastGame => g != null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function mapSchedule(raw: unknown, teamId: string): PastGame[] {
  const events = ((raw as { events?: Record<string, unknown>[] })?.events) ?? [];
  const games: PastGame[] = [];
  for (const event of events) {
    const comp = ((event.competitions as Record<string, unknown>[]) ?? [event])[0];
    const status = (comp.status as { type?: { completed?: boolean } } | undefined)?.type;
    if (!status?.completed) continue;
    const competitors = (comp.competitors as Record<string, unknown>[]) ?? [];
    const self = competitors.find((c) => String((c.team as { id?: string })?.id) === teamId);
    const opp = competitors.find((c) => String((c.team as { id?: string })?.id) !== teamId);
    if (!self || !opp) continue;
    const gf = scoreValue(self.score);
    const ga = scoreValue(opp.score);
    if (gf == null || ga == null) continue;
    const venue = self.homeAway === "home" ? "Casa" : "Fora";
    games.push({
      date: String(event.date ?? ""),
      competition: String(
        (event.league as { name?: string } | undefined)?.name
          || (comp.notes as { headline?: string }[] | undefined)?.[0]?.headline
          || "Liga",
      ),
      opponent: String((opp.team as { displayName?: string }).displayName),
      venue,
      goalsFor: gf,
      goalsAgainst: ga,
      result: gf > ga ? "W" : gf < ga ? "L" : "D",
    });
  }
  return games.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

function mergeForm(primary: PastGame[], secondary: PastGame[]): PastGame[] {
  const key = (g: PastGame) => `${g.date}|${g.opponent}|${g.goalsFor}-${g.goalsAgainst}`;
  const seen = new Set(primary.map(key));
  const extra = secondary.filter((g) => !seen.has(key(g)));
  return [...primary, ...extra].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
}

export async function getMatchDetail(
  leagueSlug: string,
  leagueName: string,
  eventId: string,
): Promise<MatchDetail | null> {
  const summary = (await espnGet(`${leagueSlug}/summary?event=${eventId}`)) as Record<string, unknown>;
  const header = summary.header as Record<string, unknown> | undefined;
  if (!header) return null;

  const headerEvent = {
    ...header,
    competitions: header.competitions,
    id: header.id ?? eventId,
    date: (header.competitions as Record<string, unknown>[])?.[0]?.date,
  };
  const listed = parseEvent(headerEvent, leagueSlug, leagueName);
  if (!listed) return null;

  const pickOdds = espnOddsToBook(((summary.pickcenter as unknown[]) ?? [])[0]);
  if (!listed.odds && pickOdds) listed.odds = pickOdds;

  const [homeSchedule, awaySchedule] = await Promise.all([
    espnGet(`${leagueSlug}/teams/${listed.home.id}/schedule`).catch(() => ({})),
    espnGet(`${leagueSlug}/teams/${listed.away.id}/schedule`).catch(() => ({})),
  ]);

  const lastFive = summary.lastFiveGames;
  const homeForm = mergeForm(
    mapSchedule(homeSchedule, listed.home.id),
    mapLastFive(lastFive, listed.home.id),
  );
  const awayForm = mergeForm(
    mapSchedule(awaySchedule, listed.away.id),
    mapLastFive(lastFive, listed.away.id),
  );

  return { ...listed, homeForm, awayForm };
}
