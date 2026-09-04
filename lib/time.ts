const LISBON = "Europe/Lisbon";

export function lisbonDayKey(when: string | Date = new Date()): string {
  const date = typeof when === "string" ? new Date(when) : when;
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LISBON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isLisbonToday(iso: string): boolean {
  const day = lisbonDayKey(iso);
  return Boolean(day) && day === lisbonDayKey(new Date());
}

export function lisbonYesterdayKey(): string {
  const [year, month, day] = lisbonDayKey().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatWhenLisbon(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: LISBON,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
