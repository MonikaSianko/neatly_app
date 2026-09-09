"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { money } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import type { Summary } from "@/lib/summary";

/**
 * Na telefonie pokazujemy dwie liczby, po ktorych widac sytuacje; reszta czeka pod strzalka.
 * Piec kwot naraz na szerokosc telefonu to sciana cyfr. Na desktopie wszystko jest od razu.
 */
export function SummaryCard({ summary, opening }: { summary: Summary; opening: ReactNode }) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  const rest = [
    { label: t.income, value: summary.income, tone: "" },
    { label: t.plannedExpenses, value: summary.plannedExpenses, tone: "" },
    { label: t.balanceWithBudgets, value: summary.balanceWithBudgets, tone: "brand" },
  ];

  return (
    <section className="rounded-[14px] border border-border bg-card p-4">
      <div className="flex items-center justify-between text-base">{opening}</div>

      {/* Telefon: dwie liczby + rozwiniecie */}
      <div className="mt-3 sm:hidden">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">{t.accountBalance}</div>
            <div className="tabular text-xl font-semibold">{money(summary.accountBalance, locale)}</div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-xs text-muted-foreground">{t.balanceNow}</div>
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
                <span className="text-sm text-muted-foreground">{item.label}</span>
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
          <div className="text-xs text-muted-foreground">{t.income}</div>
          <div className="tabular text-xl font-semibold">{money(summary.income, locale)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t.plannedExpenses}</div>
          <div className="tabular text-xl font-semibold">{money(summary.plannedExpenses, locale)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t.accountBalance}</div>
          <div className="tabular text-xl font-semibold">{money(summary.accountBalance, locale)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t.balanceWithBudgets}</div>
          <div className="tabular text-xl font-semibold" style={{ color: "var(--neatly-primary-dark)" }}>
            {money(summary.balanceWithBudgets, locale)}
          </div>
        </div>
      </div>

      <div className="mt-3 hidden items-center justify-between border-t border-border pt-3 sm:flex">
        <span className="text-xs text-muted-foreground">{t.balanceNow}</span>
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
