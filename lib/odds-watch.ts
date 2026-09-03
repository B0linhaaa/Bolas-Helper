import { sql } from "./db";
import { sendNotifyEmail } from "./email";
import { listUpcoming } from "./espn";
import { listTeamWatchers } from "./favorites";
import { LEAGUES } from "./leagues";
import { favoriteOddsEmail } from "./odds-email";
import { hasBookOdds } from "./odds";
import type { ListedMatch } from "./types";

type WatchRow = {
  event_id: string;
  league: string;
  name: string;
  start_at: string;
  had_odds: boolean;
  notified: boolean;
};

function matchName(match: ListedMatch): string {
  return `${match.home.name} - ${match.away.name}`;
}

function involvesTeam(match: ListedMatch, teamIds: Set<string>): boolean {
  return teamIds.has(match.home.id) || teamIds.has(match.away.id);
}

async function listAllUpcoming(fresh: boolean): Promise<ListedMatch[]> {
  const batches = await Promise.all(
    LEAGUES.map((league) =>
      listUpcoming(league.slug, league.name, { days: 10, fresh }).catch(() => [] as ListedMatch[]),
    ),
  );
  const seen = new Set<string>();
  const matches: ListedMatch[] = [];
  for (const match of batches.flat()) {
    if (seen.has(match.eventId)) continue;
    seen.add(match.eventId);
    matches.push(match);
  }
  return matches;
}

async function loadWatch(): Promise<Map<string, WatchRow>> {
  const db = sql();
  const rows = (await db`
    SELECT event_id, league, name, start_at, had_odds, notified FROM odds_watch
  `) as WatchRow[];
  return new Map(rows.map((row) => [row.event_id, row]));
}

async function saveWatch(rows: WatchRow[], liveIds: Set<string>, previousIds: string[]): Promise<void> {
  const db = sql();
  for (const row of rows) {
    await db`
      INSERT INTO odds_watch (event_id, league, name, start_at, had_odds, notified)
      VALUES (${row.event_id}, ${row.league}, ${row.name}, ${row.start_at}, ${row.had_odds}, ${row.notified})
      ON CONFLICT (event_id) DO UPDATE SET
        league = EXCLUDED.league,
        name = EXCLUDED.name,
        start_at = EXCLUDED.start_at,
        had_odds = EXCLUDED.had_odds,
        notified = EXCLUDED.notified,
        updated_at = now()
    `;
  }
  for (const id of previousIds) {
    if (!liveIds.has(id)) {
      await db`DELETE FROM odds_watch WHERE event_id = ${id}`;
    }
  }
}

export async function previewFavoriteOddsEmail(): Promise<{
  checked: number;
  emailed: boolean;
  games: number;
}> {
  const watchers = await listTeamWatchers();
  const teamIds = new Set(watchers.map((w) => w.teamId));
  const matches = (await listAllUpcoming(true)).filter(
    (match) => involvesTeam(match, teamIds) && hasBookOdds(match.odds),
  );
  if (matches.length === 0) {
    const { subject, html, text } = favoriteOddsEmail([], true);
    await sendNotifyEmail(
      "Bolas Helper — SMTP a funcionar",
      `${html}<p style="font-family:Georgia,serif;font-size:14px">Ainda não há jogos das tuas equipas com odds no feed. Quando abrirem, o email vem neste formato.</p>`,
      text || "SMTP a funcionar. Ainda sem odds das tuas equipas.",
    );
    return { checked: teamIds.size, emailed: true, games: 0 };
  }

  const byEmail = new Map<string, ListedMatch[]>();
  for (const watcher of watchers) {
    const forUser = matches.filter((match) => involvesTeam(match, new Set([watcher.teamId])));
    if (forUser.length === 0) continue;
    const current = byEmail.get(watcher.email) ?? [];
    const seen = new Set(current.map((m) => m.eventId));
    for (const match of forUser) {
      if (!seen.has(match.eventId)) {
        seen.add(match.eventId);
        current.push(match);
      }
    }
    byEmail.set(watcher.email, current);
  }

  for (const [email, games] of byEmail) {
    const payload = favoriteOddsEmail(games, true);
    await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
  }

  return { checked: teamIds.size, emailed: byEmail.size > 0, games: matches.length };
}

export async function notifyNewOdds(): Promise<{
  checked: number;
  opened: number;
  emailed: boolean;
}> {
  const watchers = await listTeamWatchers();
  const teamIds = new Set(watchers.map((w) => w.teamId));
  const matches = (await listAllUpcoming(true)).filter((match) => involvesTeam(match, teamIds));
  const snapshot = await loadWatch();
  const opened: ListedMatch[] = [];
  const nextRows: WatchRow[] = [];

  for (const match of matches) {
    const prev = snapshot.get(match.eventId);
    const hadOdds = hasBookOdds(match.odds);
    const justOpened = hadOdds && !prev?.notified;
    if (justOpened) opened.push(match);
    nextRows.push({
      event_id: match.eventId,
      league: match.league,
      name: matchName(match),
      start_at: match.start,
      had_odds: hadOdds,
      notified: prev?.notified ?? false,
    });
  }

  const liveIds = new Set(matches.map((m) => m.eventId));
  let emailed = false;

  if (opened.length > 0) {
    const byEmail = new Map<string, ListedMatch[]>();
    for (const watcher of watchers) {
      const forUser = opened.filter((match) => involvesTeam(match, new Set([watcher.teamId])));
      if (forUser.length === 0) continue;
      const current = byEmail.get(watcher.email) ?? [];
      const seen = new Set(current.map((m) => m.eventId));
      for (const match of forUser) {
        if (!seen.has(match.eventId)) {
          seen.add(match.eventId);
          current.push(match);
        }
      }
      byEmail.set(watcher.email, current);
    }

    for (const [email, games] of byEmail) {
      const payload = favoriteOddsEmail(games);
      await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
      emailed = true;
    }

    if (!emailed && process.env.NOTIFY_EMAIL?.trim()) {
      const payload = favoriteOddsEmail(opened);
      await sendNotifyEmail(payload.subject, payload.html, payload.text);
      emailed = true;
    }
  }

  if (emailed) {
    const openedIds = new Set(opened.map((m) => m.eventId));
    for (const row of nextRows) {
      if (openedIds.has(row.event_id)) row.notified = true;
    }
  }

  await saveWatch(nextRows, liveIds, [...snapshot.keys()]);
  return { checked: matches.length, opened: opened.length, emailed };
}
