const QUOTE_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export type AssetHit = {
  kind: "stock" | "crypto";
  symbol: string;
  name: string;
  exchange: string;
};

export type QuoteSnapshot = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  changePct: number | null;
  monthPct: number | null;
  closes: number[];
};

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  exchange?: string;
};

function kindFromQuoteType(quoteType: string | undefined): AssetHit["kind"] | null {
  const t = (quoteType ?? "").toUpperCase();
  if (t === "CRYPTOCURRENCY" || t === "CRYPTO") return "crypto";
  if (t === "EQUITY" || t === "ETF" || t === "INDEX") return "stock";
  return null;
}

export async function searchAssets(
  query: string,
  kind?: "stock" | "crypto",
): Promise<AssetHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
    { cache: "no-store", headers: QUOTE_HEADERS },
  );
  if (!res.ok) throw new Error(`Yahoo search ${res.status}`);
  const payload = (await res.json()) as { quotes?: YahooQuote[] };
  const hits: AssetHit[] = [];
  const seen = new Set<string>();
  for (const quote of payload.quotes ?? []) {
    const hitKind = kindFromQuoteType(quote.quoteType);
    const symbol = quote.symbol?.trim();
    if (!hitKind || !symbol || seen.has(symbol)) continue;
    if (kind && hitKind !== kind) continue;
    seen.add(symbol);
    hits.push({
      kind: hitKind,
      symbol,
      name: quote.longname || quote.shortname || symbol,
      exchange: quote.exchDisp || quote.exchange || "",
    });
  }
  return hits;
}

export async function fetchQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`,
    { next: { revalidate: 300 }, headers: QUOTE_HEADERS },
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          symbol?: string;
          shortName?: string;
          longName?: string;
          currency?: string;
          regularMarketPrice?: number;
        };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  if (!result) return null;
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (closes.length === 0) return null;
  const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : null;
  const monthAgo = closes.length > 21 ? closes[closes.length - 22] : closes[0];
  return {
    symbol: result.meta?.symbol ?? symbol,
    name: result.meta?.longName || result.meta?.shortName || symbol,
    currency: result.meta?.currency ?? "",
    price,
    changePct: prev && prev !== 0 ? (price - prev) / prev : null,
    monthPct: monthAgo && monthAgo !== 0 ? (price - monthAgo) / monthAgo : null,
    closes,
  };
}

type SparkPayload = {
  spark?: {
    result?: Array<{
      symbol?: string;
      response?: Array<{
        meta?: {
          symbol?: string;
          shortName?: string;
          longName?: string;
          currency?: string;
          regularMarketPrice?: number;
        };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    }>;
  };
};

export async function fetchSparkQuotes(
  symbols: string[],
  range: "5d" | "3mo" = "5d",
): Promise<QuoteSnapshot[]> {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 12) chunks.push(unique.slice(i, i + 12));

  const batches = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(chunk.join(","))}&range=${range}&interval=1d`,
        { next: { revalidate: 300 }, headers: QUOTE_HEADERS },
      );
      if (!res.ok) return [] as QuoteSnapshot[];
      const payload = (await res.json()) as SparkPayload;
      const out: QuoteSnapshot[] = [];
      for (const item of payload.spark?.result ?? []) {
        const result = item.response?.[0];
        if (!result) continue;
        const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n),
        );
        if (closes.length === 0) continue;
        const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
        const prev = closes.length > 1 ? closes[closes.length - 2] : null;
        const monthAgo = closes.length > 21 ? closes[closes.length - 22] : closes[0];
        out.push({
          symbol: result.meta?.symbol ?? item.symbol ?? "",
          name: result.meta?.longName || result.meta?.shortName || item.symbol || "",
          currency: result.meta?.currency ?? "",
          price,
          changePct: prev && prev !== 0 ? (price - prev) / prev : null,
          monthPct: monthAgo && monthAgo !== 0 ? (price - monthAgo) / monthAgo : null,
          closes,
        });
      }
      return out;
    }),
  );

  return batches.flat().filter((q) => q.symbol);
}
