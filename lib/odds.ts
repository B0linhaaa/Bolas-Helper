export function parseAmerican(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function americanToDecimal(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function impliedProb(decimalOdd: number): number {
  return 1 / decimalOdd;
}

export function removeVig(probs: number[]): number[] {
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return probs;
  return probs.map((p) => p / sum);
}

export function formatOdd(decimal: number): string {
  return decimal.toFixed(2);
}

export function formatGoalLine(line: number): string {
  return String(line).replace(".", ",");
}

export function formatOddsPreview(
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
    overLine: number | null;
    over: number | null;
    under?: number | null;
  } | null,
  homeName: string,
  awayName: string,
): string[] {
  if (!odds) return [];
  const lines: string[] = [];
  if (odds.over != null && odds.overLine != null) {
    lines.push(`Mais de ${formatGoalLine(odds.overLine)} golos ${formatOdd(odds.over)}`);
  }
  if (odds.home != null) {
    lines.push(`${homeName} a ganhar ${formatOdd(odds.home)}`);
  }
  if (odds.over == null && odds.draw != null) {
    lines.push(`Empate ${formatOdd(odds.draw)}`);
  }
  if (odds.over == null && odds.away != null) {
    lines.push(`${awayName} a ganhar ${formatOdd(odds.away)}`);
  }
  return lines;
}

export function hasBookOdds(odds: { home: number | null; over: number | null } | null): boolean {
  if (!odds) return false;
  return odds.home != null || odds.over != null;
}

export function formatOddsLine(
  odds: {
    home: number | null;
    draw: number | null;
    away: number | null;
    overLine: number | null;
    over: number | null;
    under?: number | null;
  } | null,
  teams?: { home: string; away: string },
): string {
  if (!odds) return "";
  const home = teams?.home ?? "Casa";
  const away = teams?.away ?? "Visitante";
  const parts: string[] = [];
  if (odds.home != null) {
    parts.push(`${home} a ganhar ${formatOdd(odds.home)}`);
    if (odds.draw != null) parts.push(`Empate ${formatOdd(odds.draw)}`);
    if (odds.away != null) parts.push(`${away} a ganhar ${formatOdd(odds.away)}`);
  }
  if (odds.over != null && odds.overLine != null) {
    parts.push(`Mais de ${formatGoalLine(odds.overLine)} golos ${formatOdd(odds.over)}`);
    if (odds.under != null) {
      parts.push(`Menos de ${formatGoalLine(odds.overLine)} golos ${formatOdd(odds.under)}`);
    }
  }
  return parts.join(" · ");
}

export function espnOddsToBook(raw: unknown): {
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
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const provider = o.provider as { displayName?: string; name?: string } | undefined;
  const bookmaker = provider?.displayName || provider?.name || "Casa";

  const moneyline = (o.moneyline ?? o.moneyLine) as Record<string, unknown> | undefined;
  const closeOf = (side: unknown): unknown => {
    if (!side || typeof side !== "object") return side;
    const s = side as Record<string, unknown>;
    return s.close ?? s;
  };

  const mlHome = closeOf(moneyline?.home) as Record<string, unknown> | undefined;
  const mlAway = closeOf(moneyline?.away) as Record<string, unknown> | undefined;
  const mlDraw = closeOf(moneyline?.draw) as Record<string, unknown> | undefined;
  const drawOdds = o.drawOdds as Record<string, unknown> | undefined;

  const homeAm = parseAmerican(mlHome?.odds);
  const awayAm = parseAmerican(mlAway?.odds);
  const drawAm =
    parseAmerican(mlDraw?.odds) ?? parseAmerican(drawOdds?.moneyLine);

  const total = o.total as Record<string, unknown> | undefined;
  const overClose = closeOf(total?.over) as Record<string, unknown> | undefined;
  const underClose = closeOf(total?.under) as Record<string, unknown> | undefined;
  const overAm = parseAmerican(overClose?.odds);
  const underAm = parseAmerican(underClose?.odds);

  const lineFrom = (line: unknown, fallback: unknown): number | null => {
    if (typeof fallback === "number") return fallback;
    const text = String(line ?? "");
    const m = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  const spread = o.pointSpread as Record<string, unknown> | undefined;
  const spHome = closeOf(spread?.home) as Record<string, unknown> | undefined;
  const spAway = closeOf(spread?.away) as Record<string, unknown> | undefined;

  const book = {
    bookmaker,
    home: homeAm == null ? null : americanToDecimal(homeAm),
    draw: drawAm == null ? null : americanToDecimal(drawAm),
    away: awayAm == null ? null : americanToDecimal(awayAm),
    overLine: lineFrom(overClose?.line, o.overUnder),
    over: overAm == null ? null : americanToDecimal(overAm),
    under: underAm == null ? null : americanToDecimal(underAm),
    homeSpreadLine: lineFrom(spHome?.line, null),
    homeSpread: (() => {
      const am = parseAmerican(spHome?.odds);
      return am == null ? null : americanToDecimal(am);
    })(),
    awaySpread: (() => {
      const am = parseAmerican(spAway?.odds);
      return am == null ? null : americanToDecimal(am);
    })(),
  };

  const hasAny =
    book.home != null ||
    book.over != null ||
    book.homeSpread != null;
  return hasAny ? book : null;
}
