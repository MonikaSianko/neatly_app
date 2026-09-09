import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";

export const LOCALE_COOKIE = "neatly-locale";
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "pl" || value === "en";
}

/**
 * Kolejnosc: ciasteczko (ustawiane przez ?lang= albo wybor w menu), potem ustawienie profilu.
 * Dzieki temu link z ?lang=en otwiera aplikacje po angielsku takze przed zalogowaniem.
 */
export async function resolveLocale(profileLocale?: string | null): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return isLocale(profileLocale) ? profileLocale : "pl";
}
