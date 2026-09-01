import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listUpcoming } from "./espn";
import { LEAGUES } from "./leagues";
import { formatOddsLine, hasBookOdds } from "./odds";
import { sendNotifyEmail } from "./email";
import type { ListedMatch } from "./types";

type SnapshotRow = {
  eventId: string;
  league: string;
  name: string;
  start: string;
  hadOdds: boolean;
  notified: boolean;
};

type Snapshot = {
  matches: Record<string, SnapshotRow>;
};

const FILE = path.join(process.cwd(), "data", "odds-snapshot.json");

async function loadSnapshot(): Promise<Snapshot> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    return { matches: parsed.matches ?? {} };
  } catch {
    return { matches: {} };
  }
}

async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(snapshot, null, 2), "utf8");
}

function matchName(match: ListedMatch): string {
  return `${match.home.name} - ${match.away.name}`;
}

export async function rememberListedMatches(matches: ListedMatch[]): Promise<void> {
  const snapshot = await loadSnapshot();
  for (const match of matches) {
    const prev = snapshot.matches[match.eventId];
    if (!prev) {
      snapshot.matches[match.eventId] = {
        eventId: match.eventId,
        league: match.league,
        name: matchName(match),
        start: match.start,
        hadOdds: hasBookOdds(match.odds),
        notified: false,
      };
    } else if (!prev.hadOdds) {
      snapshot.matches[match.eventId] = {
        ...prev,
        name: matchName(match),
        start: match.start,
      };
    }
  }
  await saveSnapshot(snapshot);
}

async function listAllUpcoming(fresh: boolean): Promise<ListedMatch[]> {
  const batches = await Promise.all(
    LEAGUES.map((league) =>
      listUpcoming(league.slug, league.name, { days: 7, fresh }).catch(() => [] as ListedMatch[]),
    ),
  );
  return batches.flat();
}

function matchUrl(match: ListedMatch): string {
  const base = (process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
  return `${base}/jogo/${encodeURIComponent(match.league)}/${match.eventId}`;
}

export async function notifyNewOdds(): Promise<{
  checked: number;
  opened: number;
  emailed: boolean;
}> {
  const snapshot = await loadSnapshot();
  const matches = await listAllUpcoming(true);
  const opened: ListedMatch[] = [];

  const liveIds = new Set(matches.map((m) => m.eventId));
  for (const match of matches) {
    const prev = snapshot.matches[match.eventId];
    const hadOdds = hasBookOdds(match.odds);
    const justOpened = Boolean(prev) && prev.hadOdds === false && hadOdds && !prev.notified;
    if (justOpened) opened.push(match);

    snapshot.matches[match.eventId] = {
      eventId: match.eventId,
      league: match.league,
      name: matchName(match),
      start: match.start,
      hadOdds,
      notified: prev?.notified ?? false,
    };
  }

  for (const id of Object.keys(snapshot.matches)) {
    if (!liveIds.has(id)) delete snapshot.matches[id];
  }

  let emailed = false;
  if (opened.length > 0 && process.env.NOTIFY_EMAIL?.trim()) {
    const lines = opened.map((match) => {
      const when = new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Lisbon",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(match.start));
      const odds = formatOddsLine(match.odds);
      return `<p><strong>${matchName(match)}</strong> · ${match.leagueName} · ${when}<br/>${odds}<br/><a href="${matchUrl(match)}">Abrir análise</a></p>`;
    });
    const text = opened
      .map((match) => `${matchName(match)} · ${formatOddsLine(match.odds)} · ${matchUrl(match)}`)
      .join("\n");
    await sendNotifyEmail(
      opened.length === 1
        ? `Odds disponíveis: ${matchName(opened[0])}`
        : `Odds disponíveis em ${opened.length} jogos`,
      `<p>O feed passou a ter odds nestes jogos:</p>${lines.join("")}`,
      `O feed passou a ter odds nestes jogos:\n\n${text}`,
    );
    emailed = true;
    for (const match of opened) {
      snapshot.matches[match.eventId].notified = true;
    }
  }

  await saveSnapshot(snapshot);
  return { checked: matches.length, opened: opened.length, emailed };
}
