import { sql } from "./db";
import { analyseMatch } from "./analysis";
import { sendNotifyEmail } from "./email";
import { getMatchDetail, listUpcomingForFavoriteTeams } from "./espn";
import { listTeamWatchers, type TeamWatcher } from "./favorites";
import { morningDigestEmail, type DigestGame } from "./digest-email";
import { listPickSnapshotsForDay, savePickSnapshot, settlePicks } from "./picks";
import { isLisbonToday, lisbonDayKey, lisbonYesterdayKey } from "./time";

async function ensureDigestSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS digest_log (
      day text NOT NULL,
      email text NOT NULL,
      PRIMARY KEY (day, email)
    )
  `;
}

async function alreadySent(day: string, email: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    SELECT email FROM digest_log WHERE day = ${day} AND email = ${email} LIMIT 1
  `) as { email: string }[];
  return rows.length > 0;
}

async function markSent(day: string, email: string): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO digest_log (day, email)
    VALUES (${day}, ${email})
    ON CONFLICT (day, email) DO NOTHING
  `;
}

export async function sendMorningDigest(): Promise<{
  day: string;
  games: number;
  emailed: number;
  skipped: number;
}> {
  await ensureDigestSchema();
  await settlePicks().catch(() => ({ checked: 0, settled: 0 }));

  const day = lisbonDayKey();
  const watchers = await listTeamWatchers();
  const byEmail = new Map<string, TeamWatcher[]>();
  for (const watcher of watchers) {
    const list = byEmail.get(watcher.email) ?? [];
    list.push(watcher);
    byEmail.set(watcher.email, list);
  }

  const yesterday = await listPickSnapshotsForDay(lisbonYesterdayKey());
  let emailed = 0;
  let skipped = 0;
  let gamesCount = 0;

  for (const [email, userWatchers] of byEmail) {
    if (await alreadySent(day, email)) {
      skipped += 1;
      continue;
    }
    const teamIds = new Set(userWatchers.map((w) => w.teamId));
    const teams = userWatchers.map((w) => ({ id: w.teamId, league: w.league }));
    const matches = (await listUpcomingForFavoriteTeams(teams, { includePost: true })).filter(
      (match) => match.status === "in" || isLisbonToday(match.start),
    );
    const games: DigestGame[] = [];
    for (const match of matches.filter((item) => item.status !== "post")) {
      const detail = await getMatchDetail(match.league, match.leagueName, match.eventId).catch(() => null);
      const analysis = detail ? analyseMatch(detail) : null;
      if (detail && analysis) {
        await savePickSnapshot(detail, analysis.picks);
      }
      games.push({
        match: detail ?? match,
        picks: analysis?.picks ?? [],
        analysis,
      });
    }
    const yForUser = yesterday.filter(
      (row) => teamIds.has(row.homeId) || teamIds.has(row.awayId),
    );
    if (games.length === 0 && yForUser.length === 0) {
      skipped += 1;
      continue;
    }
    gamesCount += games.length;
    const payload = morningDigestEmail(games, yForUser);
    await sendNotifyEmail(payload.subject, payload.html, payload.text, email);
    await markSent(day, email);
    emailed += 1;
  }

  if (emailed === 0 && process.env.NOTIFY_EMAIL?.trim() && byEmail.size === 0) {
    skipped += 1;
  }

  return { day, games: gamesCount, emailed, skipped };
}
