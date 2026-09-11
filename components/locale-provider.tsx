"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePendingSignal } from "@/components/pending-provider";
import { STR, type Locale, type Dict } from "@/lib/i18n";
import { setLocale as setLocaleAction } from "@/lib/actions/profile";

type LocaleContextValue = {
  locale: Locale;
  t: Dict;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Jezyk przelacza sie od razu w przegladarce, ale teksty z serwera dochodza po odswiezeniu —
  // pasek u gory pokazuje, ze reszta strony wciaz sie przestawia.
  usePendingSignal(pending);

  function setLocale(next: Locale) {
    setLocaleState(next);
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return <LocaleContext.Provider value={{ locale, t: STR[locale], setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
