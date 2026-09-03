"use client";

import { searchAssetsAction } from "@/app/actions/search";
import { FavoriteButton } from "@/components/favorite-button";
import type { AssetHit } from "@/lib/quotes";
import { useState, useTransition } from "react";

export function AssetSearch({
  savedSymbols,
  loggedIn,
  kind,
}: {
  savedSymbols: string[];
  loggedIn: boolean;
  kind: "stock" | "crypto";
}) {
  const saved = new Set(savedSymbols);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AssetHit[]>([]);
  const [pending, start] = useTransition();

  function run(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setHits([]);
      return;
    }
    start(async () => {
      setHits(await searchAssetsAction(value, kind));
    });
  }

  if (!loggedIn) {
    return (
      <p className="text-xs text-zinc-500">
        Entra com Google para montar a lista de {kind === "crypto" ? "crypto" : "ações"} a analisar.
      </p>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => run(e.target.value)}
        placeholder={
          kind === "crypto" ? "Procurar (BTC, ETH, SOL…)" : "Procurar (GALP, AAPL, NVDA…)"
        }
        className="w-full rounded-md border border-emerald-200 bg-white/80 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-lime-200 dark:border-emerald-800 dark:bg-emerald-950/40"
      />
      {pending ? <p className="mt-2 text-xs text-zinc-500">A procurar…</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {hits.map((hit) => (
            <li key={hit.symbol} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {hit.name}{" "}
                  <span className="font-normal text-zinc-500">{hit.symbol}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {hit.kind === "crypto" ? "Crypto" : "Ação"}
                  {hit.exchange ? ` · ${hit.exchange}` : ""}
                </p>
              </div>
              <FavoriteButton
                compact
                saved={saved.has(`${hit.kind}:${hit.symbol}`)}
                kind={hit.kind}
                symbol={hit.symbol}
                name={hit.name}
                extra={{ exchange: hit.exchange }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
