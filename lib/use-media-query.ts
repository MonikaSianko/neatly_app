"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Na serwerze zwraca false (desktop) — menu startuje zamkniete, wiec nic nie mruga po hydracji. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
