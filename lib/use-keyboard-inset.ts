"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Ponizej tej wysokosci "zjedzony" pasek to chowajacy sie pasek adresu, nie klawiatura. */
const KEYBOARD_MIN_PX = 80;

function measure(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = window.innerHeight - vv.height - vv.offsetTop;
  return covered > KEYBOARD_MIN_PX ? Math.round(covered) : 0;
}

/**
 * Wysokosc klawiatury ekranowej w px, liczona wzgledem elementu `position: fixed`.
 *
 * Na iOS klawiatura nie zmniejsza okna (`innerHeight`) — zmienia tylko `visualViewport`,
 * wiec modal rozpiety na `inset-0` konczy sie pod klawiatura i dolna czesc formularza
 * jest nieosiagalna. Zwrocona wartosc dokladamy jako padding-bottom obszaru przewijania.
 *
 * `enabled` wylacza nasluch tam, gdzie nic nie zaslania (desktop, zwiniety ekran kategorii).
 * Na serwerze zwraca 0 — brak klawiatury to bezpieczny stan startowy.
 */
export function useKeyboardInset(enabled = true): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = window.visualViewport;
      if (!enabled || !vv) return () => {};
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
      };
    },
    [enabled]
  );

  return useSyncExternalStore(
    subscribe,
    () => (enabled ? measure() : 0),
    () => 0
  );
}
