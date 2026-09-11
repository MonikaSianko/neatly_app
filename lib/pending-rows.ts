"use client";

import { useSyncExternalStore } from "react";

/**
 * Ile nowych wpisow czeka na pojawienie sie w tabeli.
 *
 * Przycisk dodawania stoi poza drzewem tabel (jest obok <Suspense> z trescia miesiaca),
 * wiec sygnal nie ma jak przejsc propsami. Zwykly magazyn zewnetrzny zamiast kontekstu,
 * bo zerowanie musi dziac sie w efekcie tabeli — a tam setState jest zakazane i slusznie.
 */
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

export function startPendingRow() {
  count += 1;
  emit();
}

/** Nieudany zapis — wiersz nigdy nie przyjdzie, wiec szkielet ma zniknac od razu. */
export function endPendingRow() {
  if (count === 0) return;
  count -= 1;
  emit();
}

/** Przyszly swieze dane: cokolwiek bylo w drodze, juz jest na ekranie. */
export function clearPendingRows() {
  if (count === 0) return;
  count = 0;
  emit();
}

export function usePendingRows(): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0
  );
}
