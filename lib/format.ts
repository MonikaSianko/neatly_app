import type { Locale } from "./i18n";

const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };

/** Grosze -> "1 234,56 zł" (wg locale, waluta zawsze PLN). */
export function money(amountCents: number, locale: Locale = "pl"): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

/** "2026-09-05" -> "5 wrz" / "5 Sep" */
export function shortDate(iso: string, locale: Locale = "pl"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

/** Parsuje wpisana kwote ("1 234,56" / "1234.56") na grosze. */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input
    .replace(/[^\d,.\-]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}
