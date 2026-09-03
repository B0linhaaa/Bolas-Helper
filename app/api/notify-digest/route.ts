import { cronAuthorized } from "@/lib/cron-auth";
import { sendMorningDigest } from "@/lib/digest";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const digest = await sendMorningDigest();
    return NextResponse.json(digest);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no resumo da jornada";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
