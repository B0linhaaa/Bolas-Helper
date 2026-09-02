"use client";

import { searchTeamsAction } from "@/app/actions/search";
import { FavoriteButton } from "@/components/favorite-button";
import type { TeamHit } from "@/lib/espn";
import { useState, useTransition } from "react";

export function TeamSearch({
  savedIds,
  loggedIn,
}: {
  savedIds: string[];
  loggedIn: boolean;
}) {
  const saved = new Set(savedIds);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TeamHit[]>([]);
  const [pending, start] = useTransition();

  function run(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    start(async () => {
      setHits(await searchTeamsAction(value));
    });
  }

  if (!loggedIn) {
    return (
      <p className="text-xs text-zinc-500">
        Entra com Google para adicionar equipas aos favoritos. A análise dos jogos
        pode filtrar só essas equipas.
      </p>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => run(e.target.value)}
        placeholder="Procurar equipa (Sporting, Benfica…)"
        className="w-full rounded-md border border-emerald-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-lime-200 dark:border-emerald-800 dark:bg-emerald-950/40"
      />
      {pending ? <p className="mt-2 text-xs text-zinc-500">A procurar…</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {hits.map((hit) => (
            <li key={`${hit.league}-${hit.id}`} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">{hit.name}</p>
                <p className="text-xs text-zinc-500">{hit.league}</p>
              </div>
              <FavoriteButton
                compact
                saved={saved.has(hit.id)}
                kind="team"
                symbol={hit.id}
                name={hit.name}
                extra={{ league: hit.league, logo: hit.logo }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
