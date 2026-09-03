import { formatOdd, formatOddsLine } from "./odds";
import { resultLabel, type PickSnapshot } from "./picks";
import type { MatchAnalysis } from "./types";
import type { ListedMatch, Pick } from "./types";

export type DigestGame = {
  match: ListedMatch;
  picks: Pick[];
  analysis: MatchAnalysis | null;
};

function matchUrl(match: { league: string; eventId: string }): string {
  const base = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/jogo/${encodeURIComponent(match.league)}/${match.eventId}`;
}

function formatWhen(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pickLines(picks: Pick[]): string {
  return picks
    .map(
      (pick) =>
        `<p style="margin:8px 0 0;font-size:14px;color:#12382a"><span style="color:#6b7c72;font-size:11px;text-transform:uppercase;letter-spacing:0.04em">${pick.riskLabel}</span><br>${pick.market} · <strong style="color:#0f7a4a">${formatOdd(pick.odd)}</strong></p>`,
    )
    .join("");
}

function gameCard(game: DigestGame): string {
  const { match } = game;
  const live =
    match.status === "in"
      ? `<p style="margin:8px 0 0;font-size:13px;color:#b42318">Ao vivo${match.minute ? ` · ${match.minute}` : ""}${
          match.homeScore != null ? ` · ${match.homeScore}–${match.awayScore}` : ""
        }</p>`
      : "";
  return `<div style="border:1px solid #cde5d4;border-left:4px solid #c6f06c;border-radius:10px;padding:16px 18px;margin:14px 0;background:#ffffff">
  <p style="margin:0;font-size:12px;color:#3f7a5c">${match.leagueName} · ${formatWhen(match.start)}</p>
  <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:#12382a">${match.home.name} - ${match.away.name}</p>
  ${live}
  ${pickLines(game.picks)}
  <p style="margin:10px 0 0;font-size:13px;color:#3f5c4d">${formatOddsLine(match.odds, { home: match.home.name, away: match.away.name }) || "Odds ainda não no feed"}</p>
  <p style="margin:14px 0 0">
    <a href="${matchUrl(match)}" style="display:inline-block;background:#12382a;color:#c6f06c;text-decoration:none;font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px">Abrir análise →</a>
  </p>
</div>`;
}

function yesterdayCard(row: PickSnapshot): string {
  const likely = row.picks.find((pick) => pick.risk === "likely") ?? row.picks[0];
  const badge = row.likelyResult ? resultLabel(row.likelyResult) : "";
  const color =
    row.likelyResult === "hit" ? "#0f7a4a" : row.likelyResult === "miss" ? "#b42318" : "#8a5a12";
  return `<p style="margin:10px 0 0;font-size:14px;color:#12382a">${row.name}${
    row.homeScore != null ? ` ${row.homeScore}–${row.awayScore}` : ""
  }${likely ? ` · ${likely.market}` : ""}${
    badge ? ` · <strong style="color:${color}">${badge}</strong>` : ""
  }</p>`;
}

export function morningDigestEmail(
  games: DigestGame[],
  yesterday: PickSnapshot[],
): { subject: string; html: string; text: string } {
  const names = games.map((game) => `${game.match.home.name} - ${game.match.away.name}`);
  const subject =
    games.length === 1
      ? `Jornada: ${names[0]}`
      : games.length > 1
        ? `Jornada: ${games.length} jogos das tuas equipas`
        : "Balanço dos picks de ontem";
  const intro =
    games.length > 0
      ? "Jogos das tuas equipas para hoje, com as três leituras e o estado das odds."
      : "Sem jogos das tuas equipas hoje. Fica o balanço dos picks de ontem.";
  const html = `<div style="background:#eef6ef;padding:24px 12px">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#12382a;line-height:1.45;background:#f7fbf6;border-radius:16px;overflow:hidden;border:1px solid #cde5d4">
  <div style="background:#12382a;padding:18px 22px">
    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c6f06c">Bolas Helper</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#ffffff">Resumo da jornada</h1>
  </div>
  <div style="padding:8px 22px 22px">
  <p style="margin:16px 0 0;font-size:14px;color:#3f5c4d">${intro}</p>
  ${games.map(gameCard).join("")}
  ${
    yesterday.length > 0
      ? `<p style="margin:22px 0 0;font-size:13px;font-weight:600;color:#12382a">Ontem</p>${yesterday.map(yesterdayCard).join("")}`
      : ""
  }
  <p style="margin:20px 0 0;font-size:12px;color:#7a9486">18+ · análise, não garantia. As picks ficam congeladas à hora do email — o balanço usa essa versão, não o modelo depois do resultado.</p>
  </div>
  </div>
  </div>`;
  const text = `${intro}\n\n${games
    .map((game) => {
      const picks = game.picks.map((pick) => `${pick.riskLabel}: ${pick.market} ${formatOdd(pick.odd)}`).join("\n");
      return `${game.match.home.name} - ${game.match.away.name}\n${game.match.leagueName} · ${formatWhen(game.match.start)}\n${picks}\n${matchUrl(game.match)}`;
    })
    .join("\n\n")}${
    yesterday.length
      ? `\n\nOntem\n${yesterday
          .map((row) => {
            const likely = row.picks.find((pick) => pick.risk === "likely");
            return `${row.name} ${row.homeScore ?? ""}-${row.awayScore ?? ""} ${likely?.market ?? ""} ${row.likelyResult ? resultLabel(row.likelyResult) : ""}`;
          })
          .join("\n")}`
      : ""
  }`;
  return { subject, html, text };
}
