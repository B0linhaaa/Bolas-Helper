export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return header === `Bearer ${secret}` || query === secret;
}
