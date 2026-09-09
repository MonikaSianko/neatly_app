"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export type TabKey = "upcoming" | "expense" | "income";

const ORDER: TabKey[] = ["upcoming", "expense", "income"];

/**
 * Wszystkie trzy panele sa renderowane po stronie serwera z tych samych danych miesiaca
 * i przelaczane wylacznie w przegladarce — zmiana zakladki nie odpytuje serwera.
 * URL aktualizujemy przez history.replaceState, ktore Next synchronizuje z useSearchParams,
 * wiec nawigacja miesiaca zachowuje aktywna zakladke.
 */
export function MonthTabs({
  initialTab,
  labels,
  panels,
}: {
  initialTab: TabKey;
  labels: Record<TabKey, string>;
  panels: Record<TabKey, ReactNode>;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const searchParams = useSearchParams();

  function select(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  return (
    <>
      <div role="tablist" className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
        {ORDER.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${key}`}
              onClick={() => select(key)}
              className="min-h-11 rounded-full px-4 text-base font-medium sm:min-h-8 sm:px-3"
              style={
                active
                  ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {labels[key]}
            </button>
          );
        })}
      </div>

      {ORDER.map((key) => (
        <div key={key} id={`panel-${key}`} role="tabpanel" hidden={tab !== key}>
          {panels[key]}
        </div>
      ))}
    </>
  );
}
