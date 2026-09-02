import { formatOdd, formatOddsLine } from "./odds";
import type { ListedMatch } from "./types";

function matchName(match: ListedMatch): string {
  return `${match.home.name} - ${match.away.name}`;
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

function matchUrl(match: ListedMatch): string {
  const base = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/jogo/${encodeURIComponent(match.league)}/${match.eventId}`;
}

function oddsHtml(match: ListedMatch): string {
  const odds = match.odds;
  if (!odds) return `<p style="margin:8px 0 0;color:#6b7c72;font-size:13px">Odds ainda não no feed</p>`;
  const rows: string[] = [];
  if (odds.home != null) {
    rows.push(
      `<p style="margin:10px 0 0;font-size:16px;color:#12382a">1 <strong style="color:#0f7a4a">${formatOdd(odds.home)}</strong>${
        odds.draw != null ? `&nbsp;&nbsp;X <strong style="color:#0f7a4a">${formatOdd(odds.draw)}</strong>` : ""
      }${odds.away != null ? `&nbsp;&nbsp;2 <strong style="color:#0f7a4a">${formatOdd(odds.away)}</strong>` : ""}</p>`,
    );
  }
  if (odds.over != null && odds.overLine != null) {
    rows.push(
      `<p style="margin:4px 0 0;font-size:14px;color:#3f5c4d">Over ${odds.overLine} <strong style="color:#0f7a4a">${formatOdd(odds.over)}</strong>${
        odds.under != null ? `&nbsp;&nbsp;Under ${odds.overLine} <strong style="color:#0f7a4a">${formatOdd(odds.under)}</strong>` : ""
      }</p>`,
    );
  }
  if (rows.length === 0) {
    return `<p style="margin:8px 0 0;color:#6b7c72;font-size:13px">Odds ainda não no feed</p>`;
  }
  return rows.join("");
}

function matchCard(match: ListedMatch): string {
  const url = matchUrl(match);
  return `<div style="border:1px solid #cde5d4;border-left:4px solid #c6f06c;border-radius:10px;padding:16px 18px;margin:14px 0;background:#ffffff">
  <p style="margin:0;font-size:12px;color:#3f7a5c">${match.leagueName} · ${formatWhen(match.start)}</p>
  <p style="margin:6px 0 0;font-size:18px;font-weight:600;color:#12382a">${matchName(match)}</p>
  ${oddsHtml(match)}
  <p style="margin:14px 0 0">
    <a href="${url}" style="display:inline-block;background:#12382a;color:#c6f06c;text-decoration:none;font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px">Abrir análise →</a>
  </p>
</div>`;
}

function dayKey(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDayHeading(iso: string): string {
  if (!iso) return "";
  const text = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sortByKickoff(matches: ListedMatch[]): ListedMatch[] {
  return [...matches].sort((a, b) => a.start.localeCompare(b.start));
}

function cardsByDay(matches: ListedMatch[]): string {
  const ordered = sortByKickoff(matches);
  const parts: string[] = [];
  let lastDay = "";
  for (const match of ordered) {
    const day = dayKey(match.start);
    if (day && day !== lastDay) {
      lastDay = day;
      parts.push(
        `<p style="margin:22px 0 0;font-size:13px;font-weight:600;color:#12382a">${formatDayHeading(match.start)}</p>`,
      );
    }
    parts.push(matchCard(match));
  }
  return parts.join("");
}

export function favoriteOddsEmail(matches: ListedMatch[], preview = false): { subject: string; html: string; text: string } {
  const ordered = sortByKickoff(matches);
  const names = ordered.map(matchName);
  const subject =
    ordered.length === 1
      ? `Odds: ${names[0]}`
      : `Odds em ${ordered.length} jogos das tuas equipas`;
  const intro = preview
    ? "Pré-visualização: jogos das tuas equipas que já têm odds no feed."
    : "O feed passou a ter odds nestes jogos das tuas equipas:";
  const html = `<div style="background:#eef6ef;padding:24px 12px">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#12382a;line-height:1.45;background:#f7fbf6;border-radius:16px;overflow:hidden;border:1px solid #cde5d4">
  <div style="background:#12382a;padding:18px 22px">
    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#c6f06c">Bolas Helper</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#ffffff">${preview ? "Odds das tuas equipas" : "Odds no feed"}</h1>
  </div>
  <div style="padding:8px 22px 22px">
  <p style="margin:16px 0 0;font-size:14px;color:#3f5c4d">${intro}</p>
  ${cardsByDay(ordered)}
  <p style="margin:20px 0 0;font-size:12px;color:#7a9486">18+ · análise, não garantia. Odds do feed público.</p>
  </div>
  </div>
</div>`;
  const text = `${intro}\n\n${ordered
    .map(
      (match) =>
        `${matchName(match)}\n${match.leagueName} · ${formatWhen(match.start)}\n${formatOddsLine(match.odds)}\n${matchUrl(match)}`,
    )
    .join("\n\n")}`;
  return { subject, html, text };
}
