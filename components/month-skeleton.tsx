/** Odwzorowuje uklad MonthContent, zeby zamiana szkieletu na dane nie przesuwala strony. */
export function MonthSkeleton() {
  return (
    <>
      <aside className="order-1 flex flex-col gap-4 md:order-2" aria-hidden>
        <section className="rounded-[14px] border border-border bg-card p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-5 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
        </section>
        <section className="rounded-[14px] border border-border bg-card p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-16 animate-pulse rounded-[10px] bg-muted" />
        </section>
      </aside>

      <section className="order-2 flex flex-col gap-3 md:order-1" aria-busy>
        <div className="h-10 w-64 animate-pulse rounded-full bg-muted" />
        <div className="rounded-[14px] border border-border bg-card">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
