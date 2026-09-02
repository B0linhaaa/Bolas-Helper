"use client";

import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import type { FavoriteKind } from "@/lib/favorites";
import { useTransition } from "react";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M12 3.4 14.6 8.7l5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.4z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  const actionLabel = saved ? "Remover dos favoritos" : "Adicionar aos favoritos";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={compact ? actionLabel : undefined}
      title={compact ? actionLabel : undefined}
      onClick={() =>
        start(async () => {
          if (saved) await removeFavorite(kind, symbol);
          else await addFavorite({ kind, symbol, name, extra });
        })
      }
      className={
        compact
          ? `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
              saved
                ? "text-lime-300 hover:text-lime-200"
                : "text-emerald-300/70 hover:text-lime-300"
            }`
          : "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-200"
      }
    >
      {pending ? (
        "…"
      ) : compact ? (
        <StarIcon filled={saved} />
      ) : saved ? (
        label ? `${label} · nos favoritos` : "Nos favoritos"
      ) : label ? (
        `+ ${label}`
      ) : (
        "Adicionar aos favoritos"
      )}
    </button>
  );
}
