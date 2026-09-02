"use client";

import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import type { FavoriteKind } from "@/lib/favorites";
import { useTransition } from "react";

export function FavoriteButton({
  saved,
  kind,
  symbol,
  name,
  extra,
  compact = false,
  label,
}: {
  saved: boolean;
  kind: FavoriteKind;
  symbol: string;
  name: string;
  extra?: {
    league?: string;
    logo?: string;
    exchange?: string;
    currency?: string;
  };
  compact?: boolean;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (saved) await removeFavorite(kind, symbol);
          else await addFavorite({ kind, symbol, name, extra });
        })
      }
      className={
        compact
          ? saved
            ? "text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50 dark:text-lime-300"
            : "text-xs text-emerald-800/70 hover:text-emerald-900 disabled:opacity-50 dark:text-emerald-200"
          : "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-200"
      }
    >
      {pending
        ? "…"
        : saved
          ? label
            ? `${label} · nos favoritos`
            : "Nos favoritos"
          : label
            ? `+ ${label}`
            : "Adicionar aos favoritos"}
    </button>
  );
}
