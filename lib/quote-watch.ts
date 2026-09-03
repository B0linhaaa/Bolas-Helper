import { sql } from "./db";
import { sendNotifyEmail } from "./email";
import { listAssetWatchers } from "./favorites";
import { favoriteQuotesEmail, type QuoteAlert } from "./quote-email";
import { fetchSparkQuotes } from "./quotes";
import { lisbonDayKey } from "./time";

const MOVE = 0.05;

type WatchRow = {
  symbol: string;
  last_alert_day: string | null;
};

async function ensureQuoteWatchSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS quote_watch (
      symbol text PRIMARY KEY,
      name text,
      kind text,
      last_price double precision,
      last_change_pct double precision,
      last_alert_day text,
      updated_at timestamptz DEFAULT now()
    )
  `;
}

export async function notifyQuoteMoves(): Promise<{
  checked: number;
  moved: number;
  emailed: boolean;
}> {
  await ensureQuoteWatchSchema();
  const watchers = await listAssetWatchers();
  if (watchers.length === 0) {
    return { checked: 0, moved: 0, emailed: false };
  }

  const symbols = [...new Set(watchers.map((w) => w.symbol))];
  const quotes = await fetchSparkQuotes(symbols, "5d");
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const db = sql();
  const prevRows = (await db`
    SELECT symbol, last_alert_day FROM quote_watch
  `) as WatchRow[];
  const prev = new Map(prevRows.map((row) => [row.symbol, row.last_alert_day]));
  const today = lisbonDayKey();
  const alerts: QuoteAlert[] = [];

  for (const watcher of watchers) {
    const quote =
      bySymbol.get(watcher.symbol) ??
      [...bySymbol.values()].find((item) => item.symbol.toUpperCase() === watcher.symbol.toUpperCase());
    if (!quote || quote.changePct == null) continue;
    if (Math.abs(quote.changePct) < MOVE) continue;
    if (prev.get(watcher.symbol) === today) continue;
    if (alerts.some((alert) => alert.quote.symbol === quote.symbol)) continue;
    alerts.push({ quote, kind: watcher.kind, name: watcher.name || quote.name });
  }

  for (const quote of quotes) {
    await db`
      INSERT INTO quote_watch (symbol, name, last_price, last_change_pct, last_alert_day)
      VALUES (
        ${quote.symbol}, ${quote.name}, ${quote.price}, ${quote.changePct},
        ${alerts.some((alert) => alert.quote.symbol === quote.symbol) ? today : (prev.get(quote.symbol) ?? null)}
      )
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        last_price = EXCLUDED.last_price,
        last_change_pct = EXCLUDED.last_change_pct,
        last_alert_day = COALESCE(EXCLUDED.last_alert_day, quote_watch.last_alert_day),
        updated_at = now()
    `;
  }

  if (alerts.length === 0) {
    return { checked: quotes.length, moved: 0, emailed: false };
  }

  const byEmail = new Map<string, QuoteAlert[]>();
  for (const watcher of watchers) {
    const forUser = alerts.filter(
      (alert) =>
        alert.quote.symbol === watcher.symbol ||
        alert.quote.symbol.toUpperCase() === watcher.symbol.toUpperCase(),
    );
    if (forUser.length === 0) continue;
    const current = byEmail.get(watcher.email) ?? [];
    const seen = new Set(current.map((item) => item.quote.symbol));
    for (const alert of forUser) {
      if (!seen.has(alert.quote.symbol)) {
        seen.add(alert.quote.symbol);
        current.push(alert);
      }
    }
    byEmail.set(watcher.email, current);
  }

  let emailed = false;
  for (const [email, items] of byEmail) {
    const payload = favoriteQuotesEmail(items);
    await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
    emailed = true;
  }

  if (!emailed && process.env.NOTIFY_EMAIL?.trim()) {
    const payload = favoriteQuotesEmail(alerts);
    await sendNotifyEmail(payload.subject, payload.html, payload.text);
    emailed = true;
  }

  if (!emailed) {
    for (const alert of alerts) {
      await db`
        UPDATE quote_watch SET last_alert_day = ${prev.get(alert.quote.symbol) ?? null}
        WHERE symbol = ${alert.quote.symbol}
      `;
    }
  }

  return { checked: quotes.length, moved: alerts.length, emailed };
}
