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
        A carregar análise…
      </p>

      <div className="mt-12 w-full space-y-5">
        <div className="bh-bar h-4 w-28" />
        <div className="bh-bar h-7 w-64" />
        <div className="mt-6 bh-bar h-20 w-full" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bh-bar h-14" />
          <div className="bh-bar h-14" />
          <div className="bh-bar h-14" />
        </div>
        <div className="mt-6 space-y-3">
          <div className="bh-bar h-5 w-40" />
          <div className="bh-bar h-16 w-full" />
          <div className="bh-bar h-16 w-full" />
          <div className="bh-bar h-16 w-full" />
        </div>
      </div>
    </main>
  );
}
