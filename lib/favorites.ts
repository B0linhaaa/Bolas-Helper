import { sql } from "./db";

export type FavoriteKind = "team" | "stock" | "crypto";

export type Favorite = {
  id: string;
  userId: string;
  kind: FavoriteKind;
  symbol: string;
  name: string;
  extra: {
    league?: string;
    logo?: string;
    exchange?: string;
    currency?: string;
  };
};

type FavoriteRow = {
  id: string;
  user_id: string;
  kind: FavoriteKind;
  symbol: string;
  name: string;
  extra: Favorite["extra"] | string;
};

function mapRow(row: FavoriteRow): Favorite {
  const extra =
    typeof row.extra === "string"
      ? (JSON.parse(row.extra) as Favorite["extra"])
      : row.extra;
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    symbol: row.symbol,
    name: row.name,
    extra: extra ?? {},
  };
}

export async function listFavorites(
  userId: string,
  kind?: FavoriteKind,
): Promise<Favorite[]> {
  const db = sql();
  const rows = kind
    ? await db`
        SELECT id, user_id, kind, symbol, name, extra
        FROM favorites
        WHERE user_id = ${userId} AND kind = ${kind}
        ORDER BY created_at ASC
      `
    : await db`
        SELECT id, user_id, kind, symbol, name, extra
        FROM favorites
        WHERE user_id = ${userId}
        ORDER BY kind ASC, created_at ASC
      `;
  return (rows as FavoriteRow[]).map(mapRow);
}

export async function addFavoriteRecord(
  userId: string,
  item: {
    kind: FavoriteKind;
    symbol: string;
    name: string;
    extra?: Favorite["extra"];
  },
): Promise<void> {
  const extra = JSON.stringify(item.extra ?? {});
  const db = sql();
  await db`
    INSERT INTO favorites (user_id, kind, symbol, name, extra)
    VALUES (${userId}, ${item.kind}, ${item.symbol}, ${item.name}, ${extra}::jsonb)
    ON CONFLICT (user_id, kind, symbol)
    DO UPDATE SET name = EXCLUDED.name, extra = EXCLUDED.extra
  `;
}

export async function removeFavoriteRecord(
  userId: string,
  kind: FavoriteKind,
  symbol: string,
): Promise<void> {
  const db = sql();
  await db`
    DELETE FROM favorites
    WHERE user_id = ${userId} AND kind = ${kind} AND symbol = ${symbol}
  `;
}

export function favoriteKey(kind: FavoriteKind, symbol: string): string {
  return `${kind}:${symbol}`;
}

export type TeamWatcher = {
  userId: string;
  email: string;
  teamId: string;
  league?: string;
};

export async function listTeamWatchers(): Promise<TeamWatcher[]> {
  const db = sql();
  const fallback = process.env.NOTIFY_EMAIL?.trim().toLowerCase() ?? "";
  const rows = (await db`
    SELECT f.user_id, f.symbol, f.extra, COALESCE(NULLIF(u.email, ''), ${fallback}) AS email
    FROM favorites f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE f.kind = 'team'
  `) as { user_id: string; symbol: string; extra: Favorite["extra"] | string; email: string }[];
  return rows
    .filter((row) => row.email)
    .map((row) => {
      const extra =
        typeof row.extra === "string" ? (JSON.parse(row.extra) as Favorite["extra"]) : row.extra;
      return {
        userId: row.user_id,
        email: row.email,
        teamId: row.symbol,
        league: extra?.league,
      };
    });
}

export type AssetWatcher = {
  userId: string;
  email: string;
  kind: "stock" | "crypto";
  symbol: string;
  name: string;
};

export async function listAssetWatchers(): Promise<AssetWatcher[]> {
  const db = sql();
  const fallback = process.env.NOTIFY_EMAIL?.trim().toLowerCase() ?? "";
  const rows = (await db`
    SELECT f.user_id, f.kind, f.symbol, f.name,
           COALESCE(NULLIF(u.email, ''), ${fallback}) AS email
    FROM favorites f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE f.kind IN ('stock', 'crypto')
  `) as { user_id: string; kind: "stock" | "crypto"; symbol: string; name: string; email: string }[];
  return rows
    .filter((row) => row.email)
    .map((row) => ({
      userId: row.user_id,
      email: row.email,
      kind: row.kind,
      symbol: row.symbol,
      name: row.name,
    }));
}
