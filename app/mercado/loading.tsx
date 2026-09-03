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
        A carregar mercado…
      </p>

      <div className="mt-12 w-full space-y-4">
        <div className="bh-bar h-6 w-32" />
        <div className="bh-bar h-4 w-64" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="space-y-2">
                <div className="bh-bar h-3 w-28" />
                <div className="bh-bar h-4 w-20" />
              </div>
              <div className="bh-bar h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
