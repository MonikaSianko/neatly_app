"use client";

import { useSyncExternalStore } from "react";

/**
 * Licznik rzeczy, ktore czekaja na swieze dane z serwera.
 *
 * Nadawca i odbiorca sygnalu stoja w roznych galeziach drzewa — przycisk dodawania obok
 * <Suspense> z trescia miesiaca, arkusz stanu poczatkowego wewnatrz karty podsumowania —
 * wiec nie ma jak przekazac tego propsami. Zwykly magazyn zewnetrzny zamiast kontekstu,
 * bo zerowanie dzieje sie w efekcie odbiorcy, a tam setState jest zakazane i slusznie.
 */
export function createPendingSignal() {
  let count = 0;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    start() {
      count += 1;
      emit();
    },
    /** Nieudana akcja — dane nigdy nie przyjda, wiec szkielet ma zniknac od razu. */
    end() {
      if (count === 0) return;
      count -= 1;
      emit();
    },
    /** Przyszly swieze dane: cokolwiek bylo w drodze, juz jest na ekranie. */
    clear() {
      if (count === 0) return;
      count = 0;
      emit();
    },
    useCount(): number {
      return useSyncExternalStore(
        subscribe,
        () => count,
        () => 0
      );
    },
  };
}

/** Nowe wpisy w drodze do tabeli. */
export const pendingRows = createPendingSignal();

/** Przeliczenie kwot w karcie podsumowania — po zmianie stanu poczatkowego albo limitu. */
export const pendingSummary = createPendingSignal();

/**
 * Przeliczenie kafelkow budzetow. Osobno od karty, bo stan poczatkowy nie rusza limitow:
 * wygaszanie przy tej okazji calej listy budzetow bylo by halasem bez powodu.
 */
export const pendingBudgets = createPendingSignal();
