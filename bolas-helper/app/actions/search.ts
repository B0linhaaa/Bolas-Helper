"use server";

import { searchSoccerTeams } from "@/lib/espn";
import { searchAssets } from "@/lib/quotes";

export async function searchTeamsAction(query: string) {
  return searchSoccerTeams(query);
}

export async function searchAssetsAction(query: string, kind?: "stock" | "crypto") {
  return searchAssets(query, kind);
}
