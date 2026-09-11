"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PendingContextValue = {
  /** Ile akcji czeka teraz na odpowiedz — liczy sie, bo kilka moze biec naraz. */
  count: number;
  start: () => void;
  finish: () => void;
};

const PendingContext = createContext<PendingContextValue | null>(null);

/**
 * Zlicza trwajace akcje w calej aplikacji. Pasek u gory jest jedynym stanem ladowania,
 * ktory widac niezaleznie od tego, gdzie sie kliknelo — takze wtedy, gdy klikniety przycisk
 * zdazyl juz zniknac (menu, arkusz) albo gdy odpowiedz przychodzi po przewinieciu strony.
 */
export function PendingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const start = useCallback(() => setCount((n) => n + 1), []);
  const finish = useCallback(() => setCount((n) => Math.max(0, n - 1)), []);
  const value = useMemo(() => ({ count, start, finish }), [count, start, finish]);

  return (
    <PendingContext.Provider value={value}>
      {children}
      <GlobalPendingBar active={count > 0} />
    </PendingContext.Provider>
  );
}

/** Brak providera nie moze wywracac komponentu — akcja ma dzialac tak czy siak. */
export function usePendingCounter(): PendingContextValue {
  return useContext(PendingContext) ?? { count: 0, start: () => {}, finish: () => {} };
}

/**
 * Wpina cudze czekanie (useTransition, useOptimistic, nawigacje) w ten sam licznik,
 * zeby pasek u gory pokazywal sie tak samo niezaleznie od tego, czym akcja jest w srodku.
 */
export function usePendingSignal(active: boolean) {
  const { start, finish } = usePendingCounter();

  useEffect(() => {
    if (!active) return;
    start();
    return finish;
  }, [active, start, finish]);
}

function GlobalPendingBar({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden={!active}
      role="progressbar"
      aria-busy={active}
      // Nad naglowkiem i arkuszami, pod palcem nieklikalny — to tylko sygnal, ze cos trwa.
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-200"
      style={{ opacity: active ? 1 : 0 }}
    >
      {active && (
        <div
          className="h-full w-2/5 rounded-full"
          style={{ background: "var(--neatly-primary-dark)", animation: "neatly-slide 1.1s ease-in-out infinite" }}
        />
      )}
    </div>
  );
}
