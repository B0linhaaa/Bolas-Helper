import type { QuoteSnapshot } from "./quotes";

export type MarketPick = {
  risk: "likely" | "risky" | "longshot";
  riskLabel: string;
  title: string;
  why: string;
};

export type MarketAnalysis = {
  text: string;
  vol: number;
  trend: "up" | "down" | "flat";
  picks: MarketPick[];
};

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const varSum = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(varSum);
}

function returns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

export function analyseQuote(quote: QuoteSnapshot, kind: "stock" | "crypto"): MarketAnalysis {
  const daily = returns(quote.closes.slice(-22));
  const vol = stdev(daily);
  const month = quote.monthPct ?? 0;
  const trend: MarketAnalysis["trend"] =
    month > 0.04 ? "up" : month < -0.04 ? "down" : "flat";
  const asset = kind === "crypto" ? "crypto" : "ação";
  const monthLabel = quote.monthPct == null ? "sem mês completo" : `${(quote.monthPct * 100).toFixed(1)}% no mês`;
  const dayLabel = quote.changePct == null ? "" : ` Hoje ${(quote.changePct * 100).toFixed(1)}%.`;

  const volWord = vol > 0.04 ? "volatilidade alta" : vol > 0.02 ? "volatilidade média" : "volatilidade baixa";

  let text: string;
  if (trend === "up") {
    text = `${quote.name} vem a subir (${monthLabel}).${dayLabel} Isso descreve o que já aconteceu — não garante continuação. ${volWord} nos últimos dias: um recuo cabe no ruído, não é por si um sinal de compra.`;
  } else if (trend === "down") {
    text = `${quote.name} recuou (${monthLabel}).${dayLabel} Preço mais baixo não é automaticamente oportunidade: pode ser tendência a prolongar-se. ${volWord}. A leitura útil é se o movimento é desproporcional ao histórico recente, não “já caiu, tem de subir”.`;
  } else {
    text = `${quote.name} está relativamente estável no mês (${monthLabel}).${dayLabel} Sem tendência clara, o risco está mais na ${volWord} do que num cenário direcional. Não há aqui um palpite de “vai subir”.`;
  }

  const picks: MarketPick[] = [
    {
      risk: "likely",
      riskLabel: "Mais conservador",
      title: trend === "down" ? "Não perseguir a queda" : "Posição pequena / manter",
      why:
        trend === "down"
          ? `O caminho mais comum depois de uma queda recente não é uma inversão imediata. A leitura conservadora é não aumentar só porque o preço já desceu.`
          : `Com ${volWord}, a leitura mais soberana é não concentrar. Se já tens exposição, manter pesa mais do que acrescentar.`,
    },
    {
      risk: "risky",
      riskLabel: "Arriscado",
      title: trend === "up" ? "Entrar só num recuo, não na euforia" : "Entrada táctica, tamanho reduzido",
      why:
        trend === "up"
          ? `Comprar depois de ${monthLabel} é pagar o movimento que já ocorreu. Uma entrada faz mais sentido se o preço devolver parte da subida — e mesmo assim pode continuar a correr.`
          : `Uma entrada aqui assume que o mercado já precificou o pior. Isso falha vezes suficientes para ser arriscado: tamanho pequeno, e só com dinheiro que podes perder.`,
    },
    {
      risk: "longshot",
      riskLabel: "Muito arriscado",
      title: kind === "crypto" ? "All-in / alavancagem" : "All-in neste título",
      why:
        kind === "crypto"
          ? `Crypto move-se o suficiente num dia para apagar uma tese. Concentrar ou alavancar nesta ${asset} não é uma leitura — é um buraco.`
          : `Meter uma fatia grande do capital neste único nome transforma ruído de mercado em risco de ruína. O long shot aqui é o tamanho da posição, não um cenário mágico.`,
    },
  ];

  return { text, vol, trend, picks };
}

export type EntryRead = {
  quote: QuoteSnapshot;
  score: number;
  title: string;
  why: string;
};

function windowMax(values: number[]): number {
  return Math.max(...values);
}

function windowMin(values: number[]): number {
  return Math.min(...values);
}

type EntryMode = "strict" | "soft";

/**
 * Leitura de entrada: recuo numa tendência de médio prazo que ainda está de pé.
 * Não é um sinal de compra — é o sítio onde uma posição pequena paga menos
 * do que o pico recente, sem apanhar uma queda livre.
 */
export function scoreEntry(
  quote: QuoteSnapshot,
  kind: "stock" | "crypto",
  mode: EntryMode = "strict",
): EntryRead | null {
  const closes = quote.closes;
  if (closes.length < 20 || !(quote.price > 0)) return null;

  const price = quote.price;
  const last20 = closes.slice(-20);
  const high20 = windowMax(last20);
  const low20 = windowMin(last20);
  const older = closes.length >= 42 ? closes[closes.length - 42] : closes[0];
  const retMed = older > 0 ? price / older - 1 : 0;
  const drawdown = high20 > 0 ? (high20 - price) / high20 : 0;
  const span = high20 - low20;
  const posInRange = span > 0 ? (price - low20) / span : 0.5;
  const vol = stdev(returns(closes.slice(-22)));
  const day = quote.changePct ?? 0;
  const crypto = kind === "crypto";
  const soft = mode === "soft";

  const pullMin = crypto ? (soft ? 0.02 : 0.03) : soft ? 0.012 : 0.02;
  const pullMax = crypto ? (soft ? 0.28 : 0.2) : soft ? 0.18 : 0.13;
  const maxVol = crypto ? (soft ? 0.12 : 0.09) : soft ? 0.065 : 0.05;
  const minTrend = crypto ? (soft ? -0.06 : 0) : soft ? -0.03 : 0.01;
  const crashDay = crypto ? -0.08 : -0.05;

  if (retMed < minTrend) return null;
  if (drawdown < pullMin || drawdown > pullMax) return null;
  if (posInRange < 0.12 && retMed < 0.06) return null;
  if (vol > maxVol) return null;
  if (day < crashDay) return null;

  const pullIdeal = crypto ? 0.08 : 0.055;
  const pullScore = 1 - Math.abs(drawdown - pullIdeal) / pullMax;
  const trendScore = Math.min(Math.max(retMed, 0) / 0.15, 1);
  const score =
    pullScore * 0.5 + trendScore * 0.4 - (vol / maxVol) * 0.2 + (soft ? -0.25 : 0);

  const ddPct = (drawdown * 100).toFixed(1);
  const medPct = `${retMed >= 0 ? "+" : ""}${(retMed * 100).toFixed(1)}%`;
  const why = soft
    ? `Está ${ddPct}% abaixo das máximas de 20 dias (${medPct} no médio prazo). Não é o recuo limpo, mas é mais honesto do que comprar no pico.`
    : retMed >= 0.04
      ? `No médio prazo ainda está acima (${medPct}). Recuou ${ddPct}% das máximas de 20 dias — uma entrada pequena paga menos do que o pico, sem ser queda livre.`
      : `Recuou ${ddPct}% do topo recente e o médio prazo não partiu (${medPct}). Entrada táctica, tamanho reduzido: o recuo pode continuar.`;

  return {
    quote,
    score,
    title: soft ? "Fora das máximas" : "Recuo na tendência",
    why,
  };
}

export function pickEntryReads(
  quotes: QuoteSnapshot[],
  kind: "stock" | "crypto",
  limit = 3,
): EntryRead[] {
  const ranked = (mode: EntryMode) =>
    quotes
      .map((quote) => scoreEntry(quote, kind, mode))
      .filter((row): row is EntryRead => row != null)
      .sort((a, b) => b.score - a.score);

  const strict = ranked("strict");
  if (strict.length >= limit) return strict.slice(0, limit);

  const seen = new Set(strict.map((row) => row.quote.symbol));
  const soft = ranked("soft").filter((row) => !seen.has(row.quote.symbol));
  return [...strict, ...soft].slice(0, limit);
}

export function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: currency ? "currency" : "decimal",
      currency: currency || "EUR",
      maximumFractionDigits: price >= 100 ? 2 : 4,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`.trim();
  }
}

export function formatPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}
