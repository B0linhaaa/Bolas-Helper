import { formatGoalLine, impliedProb, removeVig } from "./odds";
import { fitPoisson } from "./model";
import type { MatchAnalysis, MatchDetail, PastGame, Pick, PickContract, RiskTier } from "./types";

type Family = PickContract["family"];

type Candidate = {
  market: string;
  odd: number;
  oddFromBook: boolean;
  modelProb: number;
  family: Family;
  contract: PickContract;
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

function avgGoals(games: PastGame[], key: "goalsFor" | "goalsAgainst"): number {
  if (games.length === 0) return 0;
  return games.reduce((sum, game) => sum + game[key], 0) / games.length;
}

function formSnippet(name: string, games: PastGame[]): string {
  const sample = games.slice(0, 5);
  if (sample.length === 0) return `${name} sem amostra recente`;
  const seq = sample
    .map((game) => (game.result === "W" ? "V" : game.result === "D" ? "E" : "D"))
    .join("");
  return `${name} ${seq} (média ${avgGoals(sample, "goalsFor").toFixed(1)} marcados, ${avgGoals(sample, "goalsAgainst").toFixed(1)} sofridos)`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

type ExplainCtx = {
  match: MatchDetail;
  homeGames: PastGame[];
  awayGames: PastGame[];
  lambdaHome: number;
  lambdaAway: number;
  bookShare: Map<Candidate, number>;
};

function explainPick(c: Candidate, risk: RiskTier, ctx: ExplainCtx): string {
  const { match, homeGames, awayGames, lambdaHome, lambdaAway, bookShare } = ctx;
  const h = match.home.name;
  const a = match.away.name;
  const homeBit = formSnippet(h, homeGames);
  const awayBit = formSnippet(a, awayGames);
  const xg = `Golos esperados neste jogo: ${lambdaHome.toFixed(1)}–${lambdaAway.toFixed(1)}.`;
  const bookP = bookShare.get(c);
  const bookBit = c.oddFromBook
    ? `Odd ${c.odd.toFixed(2)} (${bookP != null ? pct(bookP) : pct(impliedProb(c.odd))} implícito).`
    : `Sem odd de casa; ${c.odd.toFixed(2)} é a justa do modelo (${pct(c.modelProb)}).`;
  const modelBit = `O recorte de golos dá ${pct(c.modelProb)} a este mercado.`;

  if (c.contract.family === "1x2") {
    const subject =
      c.contract.side === "home" ? h : c.contract.side === "away" ? a : "o empate";
    const form =
      c.contract.side === "home"
        ? `${homeBit}. ${awayBit}.`
        : c.contract.side === "away"
          ? `${awayBit}. ${homeBit}.`
          : `${homeBit}. ${awayBit}.`;
    if (risk === "likely") {
      const tension =
        bookP != null && Math.abs(c.modelProb - bookP) > 0.12
          ? ` O modelo e a casa não batem certo — a linha base segue a odd curta, não os últimos 5 jogos sozinhos.`
          : ` Forma recente e mercado apontam para o mesmo lado.`;
      return `${subject} é o cenário base. ${bookBit} ${form} ${xg} ${modelBit}${tension}`;
    }
    if (risk === "longshot") {
      return `${subject} a ${c.odd.toFixed(2)} é o long shot. ${bookBit} ${form} ${modelBit} Odd alta: falha na maior parte das vezes.`;
    }
    return `${c.market} a ${c.odd.toFixed(2)}. ${form} ${modelBit} Crível, mas já não é o cenário base.`;
  }

  if (c.contract.family === "totals") {
    const line = c.contract.line;
    const homePlus = overCount(homeGames, 2);
    const awayPlus = overCount(awayGames, 2);
    const side = c.contract.side === "over" ? `mais de ${formatGoalLine(line)}` : `menos de ${formatGoalLine(line)}`;
    return `${side} golos a ${c.odd.toFixed(2)}. ${h} fez 2+ em ${homePlus}/${Math.max(homeGames.length, 1)}; ${a} em ${awayPlus}/${Math.max(awayGames.length, 1)}. ${xg} ${modelBit}`;
  }

  if (c.contract.family === "btts") {
    return `Ambas marcam a ${c.odd.toFixed(2)}. BTTS em ${bttsCount(homeGames)}/${Math.max(homeGames.length, 1)} dos jogos do ${h} e ${bttsCount(awayGames)}/${Math.max(awayGames.length, 1)} do ${a}. ${modelBit}`;
  }

  return `${c.market} a ${c.odd.toFixed(2)}. ${homeBit}. ${awayBit}. ${modelBit}`;
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
  contract: PickContract,
  bookOdd: number | null,
) {
  if (modelProb < 0.06 || modelProb > 0.97) return;
  list.push({
    market,
    modelProb,
    family: contract.family,
    contract,
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
    contract: c.contract,
  };
}

function fairBook1x2(cands: Candidate[]): Map<Candidate, number> {
  const priced = cands.filter((c) => c.family === "1x2" && c.oddFromBook);
  const map = new Map<Candidate, number>();
  if (priced.length < 2) return map;
  const fair = removeVig(priced.map((c) => impliedProb(c.odd)));
  priced.forEach((c, i) => map.set(c, fair[i] ?? impliedProb(c.odd)));
  return map;
}

function likelyScore(c: Candidate, bookShare: Map<Candidate, number>): number {
  const book = bookShare.get(c);
  if (book == null) return c.modelProb;
  return 0.3 * c.modelProb + 0.7 * book;
}

function selectTiers(
  cands: Candidate[],
  ctx: Omit<ExplainCtx, "bookShare">,
): Pick[] {
  if (cands.length === 0) return [];
  const byP = [...cands].sort((a, b) => b.modelProb - a.modelProb);
  const oneXtwo = cands.filter((c) => c.family === "1x2");
  const bookShare = fairBook1x2(cands);
  const explainCtx: ExplainCtx = { ...ctx, bookShare };
  const likelyPool = oneXtwo.length > 0 ? oneXtwo : cands;
  let likely = [...likelyPool].sort((a, b) => likelyScore(b, bookShare) - likelyScore(a, bookShare))[0];
  if (!likely) return [];
  const bookFav = [...oneXtwo.filter((c) => c.oddFromBook)].sort((a, b) => a.odd - b.odd)[0];
  if (bookFav && likely.oddFromBook && likely.odd >= 3 && bookFav.odd < likely.odd) {
    likely = bookFav;
  }

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

  const out: Pick[] = [toPick(likely, "likely", explainPick(likely, "likely", explainCtx))];
  if (risky) out.push(toPick(risky, "risky", explainPick(risky, "risky", explainCtx)));
  if (longshot) out.push(toPick(longshot, "longshot", explainPick(longshot, "longshot", explainCtx)));
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

  add(cands, `${match.home.name} vence`, model.pHome, { family: "1x2", side: "home" }, odds?.home ?? null);
  add(cands, "Empate", model.pDraw, { family: "1x2", side: "draw" }, odds?.draw ?? null);
  add(cands, `${match.away.name} vence`, model.pAway, { family: "1x2", side: "away" }, odds?.away ?? null);

  const line = odds?.overLine ?? 2.5;
  const pOver = model.pOver(line);
  add(cands, `Mais de ${formatGoalLine(line)} golos`, pOver, { family: "totals", side: "over", line }, odds?.over ?? null);
  add(cands, `Menos de ${formatGoalLine(line)} golos`, 1 - pOver, { family: "totals", side: "under", line }, odds?.under ?? null);

  add(cands, "Ambas marcam", model.pBtts, { family: "btts", side: "yes" }, null);

  if (odds?.homeSpread != null && odds.homeSpreadLine != null) {
    add(
      cands,
      `${match.home.name} ${odds.homeSpreadLine > 0 ? "+" : ""}${odds.homeSpreadLine}`,
      model.pHomeCover(odds.homeSpreadLine),
      { family: "spread", side: "home", line: odds.homeSpreadLine },
      odds.homeSpread,
    );
  }

  const ctx = {
    match,
    homeGames,
    awayGames,
    lambdaHome: model.lambdaHome + alreadyH,
    lambdaAway: model.lambdaAway + alreadyA,
  };
  const bookShare = fairBook1x2(cands);
  const explainCtx: ExplainCtx = { ...ctx, bookShare };
  const priced = cands.filter((c) => c.family === "1x2");
  const favOdd = Math.min(...priced.filter((c) => c.oddFromBook).map((c) => c.odd), Number.POSITIVE_INFINITY);
  const oddsNotes = priced.map((c) => {
    const risk: RiskTier =
      c.oddFromBook && c.odd === favOdd ? "likely" : c.odd >= 3.2 ? "longshot" : "risky";
    return {
      market: c.market,
      odd: c.odd,
      modelProb: c.modelProb,
      why: explainPick(c, risk, explainCtx),
    };
  });

  return {
    text: writeAnalysis(match, homeGames, awayGames),
    lambdaHome: model.lambdaHome + alreadyH,
    lambdaAway: model.lambdaAway + alreadyA,
    pHome: model.pHome,
    pDraw: model.pDraw,
    pAway: model.pAway,
    pOver25: model.pOver25,
    pBtts: model.pBtts,
    picks: selectTiers(cands, ctx),
    oddsNotes,
  };
}
