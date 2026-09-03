export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20">
      <div className="bh-spinner" />
      <div className="mt-5 flex items-center gap-2">
        <span className="bh-dot" />
        <span className="bh-dot" />
        <span className="bh-dot" />
      </div>
      <p className="mt-5 text-sm font-medium tracking-wide text-emerald-800/70 dark:text-emerald-200/70">
        A carregar jogos…
      </p>

      <div className="mt-12 w-full space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl px-2 py-4"
          >
            <div className="flex-1 space-y-2">
              <div className="bh-bar w-24" />
              <div className="bh-bar w-48" />
            </div>
            <div className="bh-bar ml-4 h-5 w-12" />
          </div>
        ))}
      </div>
    </main>
  );
}
