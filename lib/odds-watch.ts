import { sql } from "./db";
import { sendNotifyEmail } from "./email";
import { listUpcoming } from "./espn";
import { listTeamWatchers } from "./favorites";
import { LEAGUES } from "./leagues";
import { favoriteOddsEmail, type OddsAlert } from "./odds-email";
import { hasBookOdds } from "./odds";
import type { ListedMatch } from "./types";

type WatchRow = {
  event_id: string;
  league: string;
  name: string;
  start_at: string;
  had_odds: boolean;
  notified: boolean;
  home_odd: number | null;
  over_odd: number | null;
  last_alert_at: string | null;
};

const MOVE_REL = 0.05;
const MOVE_ABS = 0.1;
const MOVE_COOLDOWN_MS = 90 * 60 * 1000;

function matchName(match: ListedMatch): string {
  return `${match.home.name} - ${match.away.name}`;
}

function involvesTeam(match: ListedMatch, teamIds: Set<string>): boolean {
  return teamIds.has(match.home.id) || teamIds.has(match.away.id);
}

function oddMoved(prev: number | null | undefined, next: number | null): boolean {
  if (prev == null || next == null || prev <= 0) return false;
  const abs = Math.abs(next - prev);
  return abs >= MOVE_ABS || abs / prev >= MOVE_REL;
}

function cooledDown(prev: WatchRow | undefined, now: number): boolean {
  if (!prev?.last_alert_at) return true;
  const then = new Date(prev.last_alert_at).getTime();
  if (!Number.isFinite(then)) return true;
  return now - then >= MOVE_COOLDOWN_MS;
}

async function ensureWatchSchema(): Promise<void> {
  const db = sql();
  await db`ALTER TABLE odds_watch ADD COLUMN IF NOT EXISTS home_odd double precision`;
  await db`ALTER TABLE odds_watch ADD COLUMN IF NOT EXISTS over_odd double precision`;
  await db`ALTER TABLE odds_watch ADD COLUMN IF NOT EXISTS last_alert_at timestamptz`;
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
    SELECT event_id, league, name, start_at, had_odds, notified, home_odd, over_odd, last_alert_at
    FROM odds_watch
  `) as WatchRow[];
  return new Map(rows.map((row) => [row.event_id, row]));
}

async function saveWatch(rows: WatchRow[], liveIds: Set<string>, previousIds: string[]): Promise<void> {
  const db = sql();
  for (const row of rows) {
    await db`
      INSERT INTO odds_watch (
        event_id, league, name, start_at, had_odds, notified, home_odd, over_odd, last_alert_at
      )
      VALUES (
        ${row.event_id}, ${row.league}, ${row.name}, ${row.start_at}, ${row.had_odds},
        ${row.notified}, ${row.home_odd}, ${row.over_odd}, ${row.last_alert_at}
      )
      ON CONFLICT (event_id) DO UPDATE SET
        league = EXCLUDED.league,
        name = EXCLUDED.name,
        start_at = EXCLUDED.start_at,
        had_odds = EXCLUDED.had_odds,
        notified = EXCLUDED.notified,
        home_odd = EXCLUDED.home_odd,
        over_odd = EXCLUDED.over_odd,
        last_alert_at = EXCLUDED.last_alert_at,
        updated_at = now()
    `;
  }
  for (const id of previousIds) {
    if (!liveIds.has(id)) {
      await db`DELETE FROM odds_watch WHERE event_id = ${id}`;
    }
  }
}

function groupAlerts(watchers: { email: string; teamId: string }[], alerts: OddsAlert[]) {
  const byEmail = new Map<string, OddsAlert[]>();
  for (const watcher of watchers) {
    const forUser = alerts.filter((alert) =>
      involvesTeam(alert.match, new Set([watcher.teamId])),
    );
    if (forUser.length === 0) continue;
    const current = byEmail.get(watcher.email) ?? [];
    const seen = new Set(current.map((a) => a.match.eventId));
    for (const alert of forUser) {
      if (!seen.has(alert.match.eventId)) {
        seen.add(alert.match.eventId);
        current.push(alert);
      }
    }
    byEmail.set(watcher.email, current);
  }
  return byEmail;
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

  const alerts: OddsAlert[] = matches.map((match) => ({
    match,
    reason: "opened",
    prevHome: null,
    prevOver: null,
  }));
  const byEmail = groupAlerts(watchers, alerts);
  for (const [email, games] of byEmail) {
    const payload = favoriteOddsEmail(games, true);
    await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
  }

  return { checked: teamIds.size, emailed: byEmail.size > 0, games: matches.length };
}

export async function notifyNewOdds(): Promise<{
  checked: number;
  opened: number;
  moved: number;
  emailed: boolean;
}> {
  await ensureWatchSchema();
  const watchers = await listTeamWatchers();
  const teamIds = new Set(watchers.map((w) => w.teamId));
  const matches = (await listAllUpcoming(true)).filter((match) => involvesTeam(match, teamIds));
  const snapshot = await loadWatch();
  const alerts: OddsAlert[] = [];
  const nextRows: WatchRow[] = [];
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  for (const match of matches) {
    const prev = snapshot.get(match.eventId);
    const hadOdds = hasBookOdds(match.odds);
    const homeOdd = match.odds?.home ?? null;
    const overOdd = match.odds?.over ?? null;
    const opened = hadOdds && !prev?.had_odds;
    const moved =
      hadOdds &&
      Boolean(prev?.had_odds) &&
      (oddMoved(prev?.home_odd, homeOdd) || oddMoved(prev?.over_odd, overOdd));
    const shouldAlert = opened || (moved && cooledDown(prev, now));
    if (shouldAlert) {
      alerts.push({
        match,
        reason: opened ? "opened" : "moved",
        prevHome: prev?.home_odd ?? null,
        prevOver: prev?.over_odd ?? null,
      });
    }
    nextRows.push({
      event_id: match.eventId,
      league: match.league,
      name: matchName(match),
      start_at: match.start,
      had_odds: hadOdds,
      notified: shouldAlert ? true : (prev?.notified ?? false),
      home_odd: homeOdd,
      over_odd: overOdd,
      last_alert_at: shouldAlert ? nowIso : (prev?.last_alert_at ?? null),
    });
  }

  const liveIds = new Set(matches.map((m) => m.eventId));
  let emailed = false;

  if (alerts.length > 0) {
    const byEmail = groupAlerts(watchers, alerts);
    for (const [email, games] of byEmail) {
      const payload = favoriteOddsEmail(games);
      await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
      emailed = true;
    }

    if (!emailed && process.env.NOTIFY_EMAIL?.trim()) {
      const payload = favoriteOddsEmail(alerts);
      await sendNotifyEmail(payload.subject, payload.html, payload.text);
      emailed = true;
    }
  }

  if (!emailed) {
    const alertIds = new Set(alerts.map((a) => a.match.eventId));
    for (const row of nextRows) {
      if (!alertIds.has(row.event_id)) continue;
      const prev = snapshot.get(row.event_id);
      row.notified = prev?.notified ?? false;
      row.last_alert_at = prev?.last_alert_at ?? null;
    }
  }

  await saveWatch(nextRows, liveIds, [...snapshot.keys()]);
  return {
    checked: matches.length,
    opened: alerts.filter((a) => a.reason === "opened").length,
    moved: alerts.filter((a) => a.reason === "moved").length,
    emailed,
  };
}
