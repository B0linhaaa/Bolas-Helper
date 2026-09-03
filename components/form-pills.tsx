import type { FormLetter, PastGame } from "@/lib/types";

const LABEL: Record<FormLetter, string> = { W: "V", D: "E", L: "D" };
const TONE: Record<FormLetter, string> = {
  W: "bg-emerald-600 text-white",
  D: "bg-zinc-400 text-white",
  L: "bg-rose-600 text-white",
};

export function lettersFromGames(games: PastGame[]): FormLetter[] {
  return games.slice(0, 5).reverse().map((game) => game.result);
}

export function FormPills({
  letters,
  size = "sm",
}: {
  letters: FormLetter[];
  size?: "sm" | "md";
}) {
  if (letters.length === 0) return null;
  const box = size === "md" ? "h-6 w-6 text-[11px]" : "h-4 w-4 text-[9px]";
  return (
    <span className="inline-flex items-center gap-0.5">
      {letters.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={`inline-flex items-center justify-center rounded-sm font-semibold ${box} ${TONE[letter]}`}
        >
          {LABEL[letter]}
        </span>
      ))}
    </span>
  );
}

export function FormName({
  name,
  letters,
  className = "",
}: {
  name: string;
  letters: FormLetter[];
  className?: string;
}) {
  if (letters.length === 0) {
    return <span className={className}>{name}</span>;
  }
  const summary = `Forma recente: ${letters.map((letter) => LABEL[letter]).join(" ")}. Mais recente à direita.`;
  return (
    <span className={`group/form relative inline-block max-w-full ${className}`}>
      <span
        className="decoration-emerald-700/50 underline decoration-dotted underline-offset-[5px] group-hover/form:decoration-emerald-800 dark:decoration-lime-300/40"
        aria-label={`${name}. ${summary}`}
      >
        {name}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 hidden w-max -translate-x-1/2 rounded-lg border border-emerald-800 bg-emerald-950 px-2.5 py-2 shadow-lg group-hover/form:block"
      >
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-lime-300/80">
          Últimos 5
        </span>
        <FormPills letters={letters} size="md" />
      </span>
    </span>
  );
}
