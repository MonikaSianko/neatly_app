"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { money } from "@/lib/format";
import { InfoPopover } from "@/components/note-popover";
import { useLocale } from "@/components/locale-provider";
import { pendingSummary } from "@/lib/pending-signal";
import type { Summary } from "@/lib/summary";

/** Etykieta wartosci z wyjasnieniem, jak jest liczona. */
function Label({ text, info }: { text: string; info: string }) {
  const { t } = useLocale();
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {text}
      <InfoPopover text={info} label={`${t.howCounted}: ${text}`} />
    </span>
  );
}

/**
 * Na telefonie pokazujemy dwie liczby, po ktorych widac sytuacje; reszta czeka pod strzalka.
 * Piec kwot naraz na szerokosc telefonu to sciana cyfr. Na desktopie wszystko jest od razu.
 */
export function SummaryCard({ summary, opening }: { summary: Summary; opening: ReactNode }) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const recalculating = pendingSummary.useCount() > 0;

  // Nowe podsumowanie = liczby sa juz przeliczone, szkielet moze zejsc.
  useEffect(() => {
    pendingSummary.clear();
  }, [summary]);

  if (recalculating) return <SummaryCardSkeleton opening={opening} />;

  const rest = [
    { label: t.income, value: summary.income, info: t.incomeInfo, tone: "" },
    { label: t.plannedExpenses, value: summary.plannedExpenses, info: t.plannedExpensesInfo, tone: "" },
    { label: t.balanceWithBudgets, value: summary.balanceWithBudgets, info: t.balanceWithBudgetsInfo, tone: "brand" },
  ];

  return (
    <section className="rounded-[14px] border border-border bg-card p-4">
      <div className="flex items-center justify-between text-base">{opening}</div>

      {/* Telefon: dwie liczby + rozwiniecie */}
      <div className="mt-3 sm:hidden">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Label text={t.accountBalance} info={t.accountBalanceInfo} />
            <div className="tabular text-xl font-semibold">{money(summary.accountBalance, locale)}</div>
          </div>
          <div className="min-w-0 text-right">
            <Label text={t.balanceNow} info={t.balanceNowInfo} />
            <div
              className="tabular text-xl font-semibold"
              style={{ color: summary.balanceNow < 0 ? "var(--destructive)" : "var(--neatly-success)" }}
            >
              {money(summary.balanceNow, locale)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={t.details}
            className="tap-target -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
          >
            <ChevronDown
              className="h-5 w-5 transition-transform"
              style={{ transform: open ? "rotate(180deg)" : undefined }}
            />
          </button>
        </div>

        {open && (
          <div className="mt-3 border-t border-border pt-1">
            {rest.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between border-b border-border py-2 last:border-b-0">
                <Label text={item.label} info={item.info} />
                <span
                  className="tabular text-base font-semibold"
                  style={item.tone === "brand" ? { color: "var(--neatly-primary-dark)" } : undefined}
                >
                  {money(item.value, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: wszystkie pieć wartosci od razu */}
      <div className="mt-3 hidden grid-cols-2 gap-3 sm:grid">
        <div>
          <Label text={t.income} info={t.incomeInfo} />
          <div className="tabular text-xl font-semibold">{money(summary.income, locale)}</div>
        </div>
        <div>
          <Label text={t.plannedExpenses} info={t.plannedExpensesInfo} />
          <div className="tabular text-xl font-semibold">{money(summary.plannedExpenses, locale)}</div>
        </div>
        <div>
          <Label text={t.accountBalance} info={t.accountBalanceInfo} />
          <div className="tabular text-xl font-semibold">{money(summary.accountBalance, locale)}</div>
        </div>
        <div>
          <Label text={t.balanceWithBudgets} info={t.balanceWithBudgetsInfo} />
          <div className="tabular text-xl font-semibold" style={{ color: "var(--neatly-primary-dark)" }}>
            {money(summary.balanceWithBudgets, locale)}
          </div>
        </div>
      </div>

      <div className="mt-3 hidden items-center justify-between border-t border-border pt-3 sm:flex">
        <Label text={t.balanceNow} info={t.balanceNowInfo} />
        <span
          className="tabular text-xl font-semibold"
          style={{ color: summary.balanceNow < 0 ? "var(--destructive)" : "var(--neatly-success)" }}
        >
          {money(summary.balanceNow, locale)}
        </span>
      </div>
    </section>
  );
}

/**
 * Cala karta w oczekiwaniu na przeliczenie. Zmiana stanu poczatkowego albo limitu rusza
 * wszystkie piec kwot naraz, wiec podmieniamy je razem — pojedyncze liczby aktualizujace
 * sie jedna po drugiej wygladaja jak blad rachunku.
 *
 * Arkusz stanu poczatkowego zostaje w drzewie (tylko schowany): to on prowadzi zapis,
 * wiec jego odmontowanie zgubiloby komunikat o nieudanej probie.
 */
function SummaryCardSkeleton({ opening }: { opening: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-border bg-card p-4" aria-busy>
      <div className="hidden">{opening}</div>
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />

      <div className="mt-3 flex items-start gap-3 sm:hidden">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="min-w-0 flex-1">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-[10px] bg-muted" />
      </div>

      <div className="mt-3 hidden grid-cols-2 gap-3 sm:grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-1.5 h-6 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-3 hidden items-center justify-between border-t border-border pt-3 sm:flex">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}
