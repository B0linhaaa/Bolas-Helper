export type MatchStatus = "pre" | "in" | "post";

export type BookOdds = {
  bookmaker: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  overLine: number | null;
  over: number | null;
  under: number | null;
  homeSpreadLine: number | null;
  homeSpread: number | null;
  awaySpread: number | null;
};

export type PastGame = {
  date: string;
  competition: string;
  opponent: string;
  venue: "Casa" | "Fora";
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
};

export type ListedMatch = {
  eventId: string;
  league: string;
  leagueName: string;
  start: string;
  venue: string;
  home: { id: string; name: string; logo: string };
  away: { id: string; name: string; logo: string };
  status: MatchStatus;
  minute: string;
  homeScore: number | null;
  awayScore: number | null;
  odds: BookOdds | null;
};

export type MatchDetail = ListedMatch & {
  homeForm: PastGame[];
  awayForm: PastGame[];
};

export type RiskTier = "likely" | "risky" | "longshot";

export type Pick = {
  market: string;
  odd: number;
  oddFromBook: boolean;
  modelProb: number;
  impliedProb: number;
  edge: number;
  why: string;
  risk: RiskTier;
  riskLabel: string;
};

export type MatchAnalysis = {
  text: string;
  lambdaHome: number;
  lambdaAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pBtts: number;
  picks: Pick[];
};
