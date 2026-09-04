import { listAllUpcoming, listUpcomingForFavoriteTeams } from "./espn";
import type { Favorite } from "./favorites";
import { formatPct, formatPrice, pickEntryReads, type EntryRead } from "./market-analysis";
import { FAMOUS_CRYPTO, FAMOUS_STOCKS, type MarketKind } from "./market-universe";
import { formatOdd, impliedProb } from "./odds";
import { listPickSnapshotsForDay, type PickSnapshot } from "./picks";
import { fetchSparkQuotes, type QuoteSnapshot } from "./quotes";
import { isLisbonToday, lisbonDayKey, lisbonYesterdayKey } from "./time";
import type { FormLetter, ListedMatch, MatchStatus, Pick, SettleResult } from "./types";

export type BriefingGame = {
  eventId: string;
  league: string;
  leagueName: string;
  start: string;
  status: MatchStatus;
  minute: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  homeRecent: FormLetter[];
  awayRecent: FormLetter[];
  likely: Pick | null;
  likelyResult: SettleResult | null;
  hasDetail: boolean;
};

export type BriefingQuote = {
  kind: MarketKind;
  name: string;
  symbol: string;
  priceLabel: string;
  changeLabel: string;
  up: boolean;
};

export type BriefingData = {
  games: BriefingGame[];
  fromFavorites: boolean;
  yesterday: PickSnapshot[];
  marketFavorites: BriefingQuote[];
  gainer: BriefingQuote | null;
  loser: BriefingQuote | null;
  entry: { name: string; title: string; why: string; changeLabel: string; up: boolean } | null;
};

function rankMatch(status: MatchStatus): number {
  if (status === "in") return 0;
  if (status === "pre") return 1;
  return 2;
}

function briefingLikely(match: ListedMatch, snapshot: PickSnapshot | undefined): Pick | null {
  const stored = snapshot?.picks.find((pick) => pick.risk === "likely") ?? snapshot?.picks[0] ?? null;
  const odds = match.odds;
  if (match.status !== "pre" || odds?.home == null || odds.away == null) return stored;

  const sides: { side: "home" | "draw" | "away"; market: string; odd: number }[] = [
    { side: "home", market: `${match.home.name} vence`, odd: odds.home },
  ];
  if (odds.draw != null) sides.push({ side: "draw", market: "Empate", odd: odds.draw });
  sides.push({ side: "away", market: `${match.away.name} vence`, odd: odds.away });
  const fav = [...sides].sort((a, b) => a.odd - b.odd)[0];
  if (!fav) return stored;

  const fromSnap = snapshot?.picks.find(
    (pick) => pick.contract?.family === "1x2" && pick.contract.side === fav.side,
  );
  if (fromSnap) {
    return { ...fromSnap, risk: "likely", riskLabel: "Mais provável" };
  }

  return {
    market: fav.market,
    odd: fav.odd,
    oddFromBook: true,
    modelProb: impliedProb(fav.odd),
    impliedProb: impliedProb(fav.odd),
    edge: 0,
    why: "",
    risk: "likely",
    riskLabel: "Mais provável",
    contract: { family: "1x2", side: fav.side },
  };
}

function toGame(match: ListedMatch, snapshot: PickSnapshot | undefined): BriefingGame {
  const likely = briefingLikely(match, snapshot);
  return {
    eventId: match.eventId,
    league: match.league,
    leagueName: match.leagueName,
    start: match.start,
    status: match.status,
    minute: match.minute,
    homeName: match.home.name,
    awayName: match.away.name,
    homeScore: match.homeScore ?? snapshot?.homeScore ?? null,
    awayScore: match.awayScore ?? snapshot?.awayScore ?? null,
    homeRecent: match.homeRecent,
    awayRecent: match.awayRecent,
    likely,
    likelyResult: snapshot?.likelyResult ?? null,
    hasDetail: Boolean(likely || snapshot),
  };
}

async function loadTodayGames(teamFavorites: Favorite[]): Promise<{
  games: BriefingGame[];
  fromFavorites: boolean;
}> {
  const fromFavorites = teamFavorites.length > 0;
  const matches = fromFavorites
    ? await listUpcomingForFavoriteTeams(
        teamFavorites.map((fav) => ({ id: fav.symbol, league: fav.extra.league })),
        { includePost: true },
      )
    : await listAllUpcoming({ days: 2, includePost: true });

  const today = matches.filter((match) => match.status === "in" || isLisbonToday(match.start));
  const sorted = [...today].sort((a, b) => {
    const byStatus = rankMatch(a.status) - rankMatch(b.status);
    if (byStatus !== 0) return byStatus;
    return a.start.localeCompare(b.start);
  });
  const sliced = sorted.slice(0, 8);
  const snapshots = await listPickSnapshotsForDay(lisbonDayKey()).catch(() => [] as PickSnapshot[]);
  const byEvent = new Map(snapshots.map((row) => [row.eventId, row]));
  return {
    fromFavorites,
    games: sliced.map((match) => toGame(match, byEvent.get(match.eventId))),
  };
}

function quoteKind(symbol: string, favoriteKinds: Map<string, MarketKind>): MarketKind {
  return favoriteKinds.get(symbol) ?? (symbol.endsWith("-USD") ? "crypto" : "stock");
}

function toBriefingQuote(
  quote: QuoteSnapshot,
  name: string,
  kind: MarketKind,
): BriefingQuote {
  const change = quote.changePct ?? 0;
  return {
    kind,
    name,
    symbol: quote.symbol,
    priceLabel: formatPrice(quote.price, quote.currency),
    changeLabel: formatPct(quote.changePct),
    up: change >= 0,
  };
}

async function loadMarketPulse(assetFavorites: Favorite[]): Promise<{
  marketFavorites: BriefingQuote[];
  gainer: BriefingQuote | null;
  loser: BriefingQuote | null;
  entry: BriefingData["entry"];
}> {
  const nameBySymbol = new Map<string, string>();
  for (const item of [...FAMOUS_STOCKS, ...FAMOUS_CRYPTO, ...assetFavorites]) {
    nameBySymbol.set(item.symbol, item.name);
  }
  const favoriteKinds = new Map<string, MarketKind>();
  for (const fav of assetFavorites) {
    if (fav.kind === "stock" || fav.kind === "crypto") {
      favoriteKinds.set(fav.symbol, fav.kind);
    }
  }

  const symbols = [
    ...FAMOUS_STOCKS.map((item) => item.symbol),
    ...FAMOUS_CRYPTO.slice(0, 4).map((item) => item.symbol),
    ...assetFavorites.map((fav) => fav.symbol),
  ];
  const quotes = await fetchSparkQuotes(symbols, "3mo");
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

  const marketFavorites = assetFavorites
    .map((fav) => {
      const quote = bySymbol.get(fav.symbol);
      if (!quote) return null;
      const kind = fav.kind === "crypto" ? "crypto" : "stock";
      return toBriefingQuote(quote, fav.name, kind);
    })
    .filter((row): row is BriefingQuote => row != null)
    .slice(0, 4);

  const withChange = quotes.filter((quote) => quote.changePct != null);
  const gainerQuote = [...withChange].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  const loserQuote = [...withChange].sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0))[0];
  const gainer = gainerQuote
    ? toBriefingQuote(
        gainerQuote,
        nameBySymbol.get(gainerQuote.symbol) || gainerQuote.name,
        quoteKind(gainerQuote.symbol, favoriteKinds),
      )
    : null;
  const loser = loserQuote && loserQuote.symbol !== gainerQuote?.symbol
    ? toBriefingQuote(
        loserQuote,
        nameBySymbol.get(loserQuote.symbol) || loserQuote.name,
        quoteKind(loserQuote.symbol, favoriteKinds),
      )
    : null;

  const stockQuotes = quotes.filter((quote) => quoteKind(quote.symbol, favoriteKinds) === "stock");
  const entryRead: EntryRead | null = pickEntryReads(stockQuotes, "stock", 1)[0] ?? null;
  const entry = entryRead
    ? {
        name: nameBySymbol.get(entryRead.quote.symbol) || entryRead.quote.name,
        title: entryRead.title,
        why: entryRead.why,
        changeLabel: formatPct(entryRead.quote.changePct),
        up: (entryRead.quote.changePct ?? 0) >= 0,
      }
    : null;

  return { marketFavorites, gainer, loser, entry };
}

export async function loadBriefing(opts: {
  teamFavorites: Favorite[];
  assetFavorites: Favorite[];
}): Promise<BriefingData> {
  const teamIds = new Set(opts.teamFavorites.map((fav) => fav.symbol));
  const [today, yesterdayAll, market] = await Promise.all([
    loadTodayGames(opts.teamFavorites).catch(() => ({ games: [] as BriefingGame[], fromFavorites: false })),
    listPickSnapshotsForDay(lisbonYesterdayKey()).catch(() => [] as PickSnapshot[]),
    loadMarketPulse(opts.assetFavorites).catch(() => ({
      marketFavorites: [] as BriefingQuote[],
      gainer: null,
      loser: null,
      entry: null,
    })),
  ]);

  const yesterday =
    teamIds.size > 0
      ? yesterdayAll.filter((row) => teamIds.has(row.homeId) || teamIds.has(row.awayId))
      : yesterdayAll.slice(0, 6);

  return {
    games: today.games,
    fromFavorites: today.fromFavorites,
    yesterday: yesterday.slice(0, 6),
    ...market,
  };
}

export function likelyLine(pick: Pick): string {
  return `${pick.market} · ${formatOdd(pick.odd)}`;
}
