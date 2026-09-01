import { impliedProb } from "./odds";
import { fitPoisson } from "./model";
import type { MatchAnalysis, MatchDetail, PastGame, Pick, RiskTier } from "./types";

type Family = "1x2" | "totals" | "btts" | "spread";

type Candidate = {
  market: string;
  odd: number;
  oddFromBook: boolean;
  modelProb: number;
  family: Family;
};

const RISK_LABEL: Record<RiskTier, string> = {
  likely: "Mais provável",
  risky: "Arriscado",
  longshot: "Muito arriscado",
};

function leagueish(game: PastGame, leagueName: string): boolean {
  const a = game.competition.toLowerCase();
  const b = leagueName.toLowerCase();
  if (!a) return true;
  if (a.includes("friendly") || a.includes("amigável") || a.includes("club friendly")) {
    return false;
  }
  if (b.includes("liga") || b.includes("primeira") || b.includes("premier") || b.includes("serie") || b.includes("bundes") || b.includes("ligue") || b.includes("eredivisie") || b.includes("la liga")) {
    return a.includes("liga") || a.includes("primeira") || a.includes("premier") || a.includes("serie") || a.includes("bundes") || a.includes("ligue") || a.includes("eredivisie") || a.includes("la liga") || a.includes("portuguese");
  }
  return true;
}

function overCount(games: PastGame[], n: number): number {
  return games.filter((g) => g.goalsFor >= n).length;
}

function bttsCount(games: PastGame[]): number {
  return games.filter((g) => g.goalsFor > 0 && g.goalsAgainst > 0).length;
}

function writeAnalysis(match: MatchDetail, leagueGamesHome: PastGame[], leagueGamesAway: PastGame[]): string {
  const h = match.home.name;
  const a = match.away.name;
  const hn = leagueGamesHome.length;
  const an = leagueGamesAway.length;
  const hPlus2 = overCount(leagueGamesHome, 2);
  const aPlus2 = overCount(leagueGamesAway, 2);
  const lastHome = leagueGamesHome[0];
  const lastAway = leagueGamesAway[0];

  const fadeHome =
    lastHome && lastHome.goalsFor >= 4
      ? ` O último ${lastHome.goalsFor}-${lastHome.goalsAgainst} com o ${lastHome.opponent} não se copia: foi um outlier, não o ritmo deste jogo.`
      : "";
  const awayBlank =
    lastAway && lastAway.goalsFor === 0
      ? ` O ${a} não marcou no último (${lastAway.venue === "Fora" ? "fora" : "casa"} com o ${lastAway.opponent}).`
      : "";
  const leak =
    leagueGamesAway.reduce((s, g) => s + g.goalsAgainst, 0) / Math.max(an, 1) >= 1.4
      ? ` A defesa do ${a} tem sofrido (média ${(leagueGamesAway.reduce((s, g) => s + g.goalsAgainst, 0) / Math.max(an, 1)).toFixed(1)} sofridos) — os 2+ do ${h} continuam credíveis.`
      : ` O ${a} não está a ser um crivo; a sequência ofensiva do ${h} merece regressão.`;

  return `${h} marcou 2+ golos em ${hPlus2} dos últimos ${hn} jogos desta competição. ${a} marcou 2+ em ${aPlus2}/${an}.${fadeHome}${leak}${awayBlank} BTTS nos jogos do ${h}: ${bttsCount(leagueGamesHome)}/${hn}. A análise usa estes resultados, não uma média cega nem um palpite.`;
}

function fairOdd(p: number): number {
  return Math.max(1.01, 1 / Math.max(p, 0.02));
}

function add(
  list: Candidate[],
  market: string,
  modelProb: number,
  family: Family,
  bookOdd: number | null,
) {
  if (modelProb < 0.06 || modelProb > 0.97) return;
  list.push({
    market,
    modelProb,
    family,
    odd: bookOdd ?? fairOdd(modelProb),
    oddFromBook: bookOdd != null && bookOdd >= 1.01,
  });
}

function isOpposite(a: Candidate, b: Candidate): boolean {
  if (a.family === "totals" && b.family === "totals") return true;
  if (a.family === "btts" && b.family === "btts") return true;
  if (a.family === "spread" && b.family === "spread") return true;
  return false;
}

function toPick(c: Candidate, risk: RiskTier, why: string): Pick {
  return {
    market: c.market,
    odd: c.odd,
    oddFromBook: c.oddFromBook,
    modelProb: c.modelProb,
    impliedProb: impliedProb(c.odd),
    edge: c.modelProb - impliedProb(c.odd),
    why,
    risk,
    riskLabel: RISK_LABEL[risk],
  };
}

function selectTiers(cands: Candidate[]): Pick[] {
  if (cands.length === 0) return [];
  const byP = [...cands].sort((a, b) => b.modelProb - a.modelProb);
  const oneXtwo = byP.filter((c) => c.family === "1x2");
  const likely = oneXtwo[0] ?? byP[0];

  const afterLikely = byP.filter((c) => c.market !== likely.market && !isOpposite(c, likely));

  const mediumBand = afterLikely.filter((c) => c.modelProb >= 0.28 && c.modelProb <= 0.55);
  const risky =
    mediumBand.find((c) => c.family !== likely.family)
    || afterLikely.find((c) => c.family !== likely.family)
    || mediumBand[0]
    || afterLikely[0];

  const afterRisky = afterLikely.filter(
    (c) => risky && c.market !== risky.market && !isOpposite(c, risky),
  );
  const longBand = afterRisky.filter((c) => c.modelProb >= 0.08 && c.modelProb < 0.36);
  const longshot =
    [...longBand].sort((a, b) => b.odd - a.odd)[0]
    || [...afterRisky].sort((a, b) => a.modelProb - b.modelProb)[0];

  const whyLikely = `${RISK_LABEL.likely}: o modelo dá ${Math.round(likely.modelProb * 100)}% a este mercado.`;
  const whyRisky = risky
    ? `${RISK_LABEL.risky}: ainda é crível (${Math.round(risky.modelProb * 100)}%), mas já não é o cenário base.`
    : "";
  const whyLong = longshot
    ? `${RISK_LABEL.longshot}: ${Math.round(longshot.modelProb * 100)}% — possível, pouco frequente. Odd alta, falha muitas vezes.`
    : "";

  const out: Pick[] = [toPick(likely, "likely", whyLikely)];
  if (risky) out.push(toPick(risky, "risky", whyRisky));
  if (longshot) out.push(toPick(longshot, "longshot", whyLong));
  return out;
}

export function analyseMatch(match: MatchDetail): MatchAnalysis {
  const homeLeague = match.homeForm.filter((g) => leagueish(g, match.leagueName));
  const awayLeague = match.awayForm.filter((g) => leagueish(g, match.leagueName));
  const homeGames = homeLeague.length >= 3 ? homeLeague : match.homeForm;
  const awayGames = awayLeague.length >= 3 ? awayLeague : match.awayForm;

  const minute = match.status === "in" ? Number(String(match.minute).replace(/\D/g, "")) || 0 : 0;
  const alreadyH = match.status === "pre" ? 0 : match.homeScore ?? 0;
  const alreadyA = match.status === "pre" ? 0 : match.awayScore ?? 0;

  const model = fitPoisson(homeGames, awayGames, alreadyH, alreadyA, match.status === "in" ? minute : 0);
  const odds = match.odds;
  const cands: Candidate[] = [];

  add(cands, `${match.home.name} vence`, model.pHome, "1x2", odds?.home ?? null);
  add(cands, "Empate", model.pDraw, "1x2", odds?.draw ?? null);
  add(cands, `${match.away.name} vence`, model.pAway, "1x2", odds?.away ?? null);

  const line = odds?.overLine ?? 2.5;
  const pOver = model.pOver(line);
  add(cands, `Over ${line}`, pOver, "totals", odds?.over ?? null);
  add(cands, `Under ${line}`, 1 - pOver, "totals", odds?.under ?? null);

  add(cands, "BTTS sim", model.pBtts, "btts", null);

  if (odds?.homeSpread != null && odds.homeSpreadLine != null) {
    add(
      cands,
      `${match.home.name} ${odds.homeSpreadLine > 0 ? "+" : ""}${odds.homeSpreadLine}`,
      model.pHomeCover(odds.homeSpreadLine),
      "spread",
      odds.homeSpread,
    );
  }

  return {
    text: writeAnalysis(match, homeGames, awayGames),
    lambdaHome: model.lambdaHome + alreadyH,
    lambdaAway: model.lambdaAway + alreadyA,
    pHome: model.pHome,
    pDraw: model.pDraw,
    pAway: model.pAway,
    pOver25: model.pOver25,
    pBtts: model.pBtts,
    picks: selectTiers(cands),
  };
}
