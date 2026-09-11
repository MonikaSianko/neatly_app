"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePendingCounter } from "@/components/pending-provider";

type ActionResult = { error: string | null } | void;

type RunOptions = {
  /** Klucz wiersza albo przycisku, gdy na ekranie trzeba pokazac, ktory element czeka. */
  key?: string;
  onSuccess?: () => void;
  /** Nieudana akcja — miejsce na cofniecie tego, co zapowiedzielismy przed jej startem. */
  onError?: () => void;
  /** Domyslnie po udanej akcji odswiezamy dane serwerowe. */
  refresh?: boolean;
};

/**
 * Jedno miejsce na "klik → czekam → odswiezone", w dwoch fazach.
 *
 * Sam zapis idzie poza transition, zeby onSuccess trafil na ekran natychmiast: zamkniecie
 * arkusza w transition React odklada az do konca odswiezenia, wiec okno wisialo na wierzchu
 * i zaslanialo szkielet, a potem wszystko wskakiwalo naraz.
 *
 * Dopiero odswiezenie jest transition — jego pending trwa, dopoki serwer nie odesle nowej
 * tresci, wiec szkielet wiersza gasnie razem z pojawieniem sie danych, a nie wczesniej.
 */
export function useAction() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const { start, finish } = usePendingCounter();

  function run(action: () => Promise<ActionResult>, options: RunOptions = {}) {
    const { key, onSuccess, onError, refresh = true } = options;
    setError(null);
    setWorking(true);
    if (key) setBusyKeys((prev) => [...prev, key]);
    start();

    void (async () => {
      try {
        const result = await action();
        if (result && result.error) {
          setError(result.error);
          onError?.();
          return;
        }
        onSuccess?.();
        if (refresh) startTransition(() => router.refresh());
      } finally {
        setWorking(false);
        finish();
        // Jeden klucz moze czekac w kilku akcjach naraz, wiec zdejmujemy tylko jedno wystapienie.
        if (key) setBusyKeys((prev) => prev.filter((_, i) => i !== prev.indexOf(key)));
      }
    })();
  }

  return {
    /** Jakakolwiek akcja tego komponentu trwa — razem z czekaniem na swieze dane. */
    pending: working || refreshing,
    /** Czy czeka konkretny wiersz albo przycisk. */
    busy: (key: string) => busyKeys.includes(key),
    error,
    setError,
    run,
  };
}
