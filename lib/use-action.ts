"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePendingCounter } from "@/components/pending-provider";

type ActionResult = { error: string | null } | void;

type RunOptions = {
  /** Klucz wiersza albo przycisku, gdy na ekranie trzeba pokazac, ktory element czeka. */
  key?: string;
  onSuccess?: () => void;
  /** Domyslnie po udanej akcji odswiezamy dane serwerowe. */
  refresh?: boolean;
};

/**
 * Jedno miejsce na "klik → czekam → odswiezone".
 *
 * router.refresh() leci wewnatrz transition, wiec pending gasnie dopiero wtedy, gdy serwer
 * odeslal nowa tresc — inaczej spinner znikalby w polowie drogi i przez chwile widac byloby
 * stare dane. Ta sama akcja podbija licznik globalny, zeby pasek u gory wiedzial, ze cos trwa.
 */
export function useAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const { start, finish } = usePendingCounter();

  function run(action: () => Promise<ActionResult>, options: RunOptions = {}) {
    const { key, onSuccess, refresh = true } = options;
    setError(null);
    if (key) setBusyKeys((prev) => [...prev, key]);
    start();

    startTransition(async () => {
      try {
        const result = await action();
        if (result && result.error) {
          setError(result.error);
          return;
        }
        onSuccess?.();
        if (refresh) router.refresh();
      } finally {
        finish();
        // Jeden klucz moze czekac w kilku akcjach naraz, wiec zdejmujemy tylko jedno wystapienie.
        if (key) setBusyKeys((prev) => prev.filter((_, i) => i !== prev.indexOf(key)));
      }
    });
  }

  return {
    /** Jakakolwiek akcja tego komponentu trwa. */
    pending: isPending,
    /** Czy czeka konkretny wiersz albo przycisk. */
    busy: (key: string) => busyKeys.includes(key),
    error,
    setError,
    run,
  };
}
