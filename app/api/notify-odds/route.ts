import { notifyNewOdds } from "@/lib/odds-watch";
import { NextResponse } from "next/server";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return header === `Bearer ${secret}` || query === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const test = new URL(request.url).searchParams.get("test") === "1";
  if (test) {
    try {
      const { previewFavoriteOddsEmail } = await import("@/lib/odds-watch");
      const result = await previewFavoriteOddsEmail();
      return NextResponse.json({ ok: true, test: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no SMTP";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const result = await notifyNewOdds();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha a verificar odds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
