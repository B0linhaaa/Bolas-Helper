import { neon } from "@neondatabase/serverless";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL não está definido");
  }
  return url;
}

export function sql() {
  return neon(databaseUrl());
}
