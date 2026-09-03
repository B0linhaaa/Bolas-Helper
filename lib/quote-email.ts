import { formatPrice, formatPct } from "./market-analysis";
import type { QuoteSnapshot } from "./quotes";

export type QuoteAlert = {
  quote: QuoteSnapshot;
  kind: "stock" | "crypto";
  name: string;
};

function marketUrl(): string {
  const base = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/mercado`;
}

function card(alert: QuoteAlert): string {
  const pct = alert.quote.changePct ?? 0;
  const color = pct >= 0 ? "#0f7a4a" : "#b42318";
  return `<div style="border:1px solid #cde5d4;border-left:4px solid ${pct >= 0 ? "#c6f06c" : "#f2c9c2"};border-radius:10px;padding:16px 18px;margin:14px 0;background:#ffffff">
  <p style="margin:0;font-size:12px;color:#3f7a5c">${alert.kind === "crypto" ? "Crypto" : "Ação"} · ${alert.quote.symbol}</p>
  <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:#12382a">${alert.name}</p>
  <p style="margin:8px 0 0;font-size:15px;color:#12382a">${formatPrice(alert.quote.price, alert.quote.currency)} · <strong style="color:${color}">${formatPct(pct)}</strong> hoje</p>
</div>`;
}

export function favoriteQuotesEmail(alerts: QuoteAlert[]): { subject: string; html: string; text: string } {
  const subject =
    alerts.length === 1
      ? `${alerts[0].name} mexeu ${formatPct(alerts[0].quote.changePct)}`
      : `${alerts.length} favoritos mexeram ≥ 5%`;
  const intro = "Um dos teus favoritos no mercado mexeu pelo menos 5% no dia:";
  const html = `<div style="background:#eef6ef;padding:24px 12px">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#12382a;line-height:1.45;background:#f7fbf6;border-radius:16px;overflow:hidden;border:1px solid #cde5d4">
  <div style="background:#12382a;padding:18px 22px">
    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c6f06c">Bolas Helper</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#ffffff">Mercado mexeu</h1>
  </div>
  <div style="padding:8px 22px 22px">
  <p style="margin:16px 0 0;font-size:14px;color:#3f5c4d">${intro}</p>
  ${alerts.map(card).join("")}
  <p style="margin:14px 0 0">
    <a href="${marketUrl()}" style="display:inline-block;background:#12382a;color:#c6f06c;text-decoration:none;font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px">Abrir mercado →</a>
  </p>
  <p style="margin:20px 0 0;font-size:12px;color:#7a9486">Não é um conselho de compra. Um movimento de 5% descreve o dia, não o que vem a seguir. Um aviso por título e por dia.</p>
  </div>
  </div>
  </div>`;
  const text = `${intro}\n\n${alerts
    .map((alert) => {
      const pct = alert.quote.changePct;
      return `${alert.name} (${alert.quote.symbol}) ${formatPrice(alert.quote.price, alert.quote.currency)} ${formatPct(pct)}`;
    })
    .join("\n")}\n\n${marketUrl()}`;
  return { subject, html, text };
}
