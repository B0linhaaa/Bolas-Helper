import { cronAuthorized } from "@/lib/cron-auth";
import { notifyNewOdds } from "@/lib/odds-watch";
import { settlePicks } from "@/lib/picks";
import { notifyQuoteMoves } from "@/lib/quote-watch";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
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
    const odds = await notifyNewOdds();
    const quotes = await notifyQuoteMoves().catch((error) => ({
      error: error instanceof Error ? error.message : "Falha nas cotações",
    }));
    const picks = await settlePicks().catch((error) => ({
      error: error instanceof Error ? error.message : "Falha a fechar picks",
    }));
    return NextResponse.json({ odds, quotes, picks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha a verificar odds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
