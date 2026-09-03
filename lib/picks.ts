import { sql } from "./db";
import { analyseMatch } from "./analysis";
import { getMatchDetail } from "./espn";
import { getLeague } from "./leagues";
import { isLisbonToday, lisbonDayKey } from "./time";
import type { ListedMatch, MatchDetail, Pick, SettleResult } from "./types";

export type PickSnapshot = {
  eventId: string;
  league: string;
  name: string;
  startAt: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  picks: Pick[];
  homeScore: number | null;
  awayScore: number | null;
  settled: boolean;
  likelyResult: SettleResult | null;
  settledAt: string | null;
};

type SnapshotRow = {
  event_id: string;
  league: string;
  name: string;
  start_at: string;
  home_id: string;
  away_id: string;
  home_name: string;
  away_name: string;
  picks: Pick[] | string;
  home_score: number | null;
  away_score: number | null;
  settled: boolean;
  likely_result: SettleResult | null;
  settled_at: string | null;
};

function parsePicks(raw: Pick[] | string): Pick[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as Pick[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRow(row: SnapshotRow): PickSnapshot {
  return {
    eventId: row.event_id,
    league: row.league,
    name: row.name,
    startAt: row.start_at,
    homeId: row.home_id,
    awayId: row.away_id,
    homeName: row.home_name,
    awayName: row.away_name,
    picks: parsePicks(row.picks),
    homeScore: row.home_score,
    awayScore: row.away_score,
    settled: row.settled,
    likelyResult: row.likely_result,
    settledAt: row.settled_at,
  };
}

export function settleContract(pick: Pick, home: number, away: number): SettleResult {
  const total = home + away;
  const { contract } = pick;
  if (contract.family === "1x2") {
    if (contract.side === "home") return home > away ? "hit" : "miss";
    if (contract.side === "away") return away > home ? "hit" : "miss";
    return home === away ? "hit" : "miss";
  }
  if (contract.family === "totals") {
    if (total === contract.line) return "push";
    if (contract.side === "over") return total > contract.line ? "hit" : "miss";
    return total < contract.line ? "hit" : "miss";
  }
  if (contract.family === "btts") {
    return home > 0 && away > 0 ? "hit" : "miss";
  }
  const adj = home + contract.line;
  if (adj === away) return "push";
  return adj > away ? "hit" : "miss";
}

export function resultLabel(result: SettleResult): string {
  if (result === "hit") return "Acertou";
  if (result === "miss") return "Falhou";
  return "Push";
}

async function ensurePickSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS pick_snapshots (
      event_id text PRIMARY KEY,
      league text NOT NULL,
      name text NOT NULL,
      start_at timestamptz,
      home_id text,
      away_id text,
      home_name text,
      away_name text,
      picks jsonb NOT NULL,
      home_score integer,
      away_score integer,
      settled boolean DEFAULT false,
      likely_result text,
      settled_at timestamptz,
      created_at timestamptz DEFAULT now()
    )
  `;
}

function matchName(match: ListedMatch): string {
  return `${match.home.name} - ${match.away.name}`;
}

export async function savePickSnapshot(match: MatchDetail, picks: Pick[]): Promise<void> {
  if (picks.length === 0) return;
  await ensurePickSchema();
  const db = sql();
  await db`
    INSERT INTO pick_snapshots (
      event_id, league, name, start_at, home_id, away_id, home_name, away_name, picks
    )
    VALUES (
      ${match.eventId}, ${match.league}, ${matchName(match)}, ${match.start},
      ${match.home.id}, ${match.away.id}, ${match.home.name}, ${match.away.name},
      ${JSON.stringify(picks)}::jsonb
    )
    ON CONFLICT (event_id) DO NOTHING
  `;
}

export async function getPickSnapshot(eventId: string): Promise<PickSnapshot | null> {
  await ensurePickSchema();
  const db = sql();
  const rows = (await db`
    SELECT event_id, league, name, start_at, home_id, away_id, home_name, away_name,
           picks, home_score, away_score, settled, likely_result, settled_at
    FROM pick_snapshots
    WHERE event_id = ${eventId}
    LIMIT 1
  `) as SnapshotRow[];
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listRecentPickSnapshots(
  limit = 8,
  teamIds?: Set<string>,
): Promise<PickSnapshot[]> {
  await ensurePickSchema();
  const db = sql();
  const rows = (await db`
    SELECT event_id, league, name, start_at, home_id, away_id, home_name, away_name,
           picks, home_score, away_score, settled, likely_result, settled_at
    FROM pick_snapshots
    WHERE settled = true
    ORDER BY settled_at DESC NULLS LAST, start_at DESC
    LIMIT ${limit * 3}
  `) as SnapshotRow[];
  const mapped = rows.map(mapRow);
  const filtered = teamIds
    ? mapped.filter((row) => teamIds.has(row.homeId) || teamIds.has(row.awayId))
    : mapped;
  return filtered.slice(0, limit);
}

export async function listPickSnapshotsForDay(day: string): Promise<PickSnapshot[]> {
  await ensurePickSchema();
  const db = sql();
  const rows = (await db`
    SELECT event_id, league, name, start_at, home_id, away_id, home_name, away_name,
           picks, home_score, away_score, settled, likely_result, settled_at
    FROM pick_snapshots
    ORDER BY start_at ASC
  `) as SnapshotRow[];
  return rows.map(mapRow).filter((row) => lisbonDayKey(row.startAt) === day);
}

export async function snapshotTodayPicks(matches: ListedMatch[]): Promise<number> {
  const due = matches.filter((match) => match.status === "pre" && isLisbonToday(match.start)).slice(0, 8);
  let saved = 0;
  for (const match of due) {
    const existing = await getPickSnapshot(match.eventId);
    if (existing) continue;
    const detail = await getMatchDetail(match.league, match.leagueName, match.eventId).catch(() => null);
    if (!detail) continue;
    const picks = analyseMatch(detail).picks;
    await savePickSnapshot(detail, picks);
    if (picks.length > 0) saved += 1;
  }
  return saved;
}

export async function settlePicks(): Promise<{ checked: number; settled: number }> {
  await ensurePickSchema();
  const db = sql();
  const rows = (await db`
    SELECT event_id, league, name, start_at, home_id, away_id, home_name, away_name,
           picks, home_score, away_score, settled, likely_result, settled_at
    FROM pick_snapshots
    WHERE settled = false
  `) as SnapshotRow[];
  let settled = 0;
  for (const row of rows) {
    const snapshot = mapRow(row);
    const start = new Date(snapshot.startAt).getTime();
    if (Number.isFinite(start) && Date.now() < start + 80 * 60 * 1000) continue;
    const leagueName = getLeague(snapshot.league)?.name ?? snapshot.league;
    const match = await getMatchDetail(snapshot.league, leagueName, snapshot.eventId).catch(() => null);
    if (!match || match.status !== "post") continue;
    if (match.homeScore == null || match.awayScore == null) continue;
    const likely = snapshot.picks.find((pick) => pick.risk === "likely") ?? snapshot.picks[0];
    if (!likely) continue;
    const likelyResult = settleContract(likely, match.homeScore, match.awayScore);
    await db`
      UPDATE pick_snapshots
      SET home_score = ${match.homeScore},
          away_score = ${match.awayScore},
          settled = true,
          likely_result = ${likelyResult},
          settled_at = now()
      WHERE event_id = ${snapshot.eventId}
    `;
    settled += 1;
  }
  return { checked: rows.length, settled };
}
