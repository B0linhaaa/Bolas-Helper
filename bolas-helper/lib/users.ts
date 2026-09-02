import { sql } from "./db";

export async function upsertUser(id: string, email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!id || !trimmed) return;
  const db = sql();
  await db`
    INSERT INTO users (id, email)
    VALUES (${id}, ${trimmed})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()
  `;
}
