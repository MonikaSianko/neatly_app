import type { CSSProperties } from "react";
import type { Locale } from "./i18n";
import type { PaymentStatus } from "./month";

const INTL_LOCALE: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };

/** "spozywcze" ma trafiac w "spożywcze" — bez tego szukanie po polsku wymaga ogonkow. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Grosze -> "1 234,56" bez waluty — tak, jak kwote wpisuje sie w wyszukiwarce. */
export function amountText(amountCents: number): string {
  return (amountCents / 100).toFixed(2).replace(".", ",");
}

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

/** Kolory przycisku PayNOW wg statusu: upcoming (neutralny), due (zielony), overdue (czerwony). */
export function payNowStyle(status: PaymentStatus): CSSProperties {
  if (status === "due") return { background: "var(--neatly-success)", color: "white" };
  if (status === "overdue") return { background: "var(--neatly-danger-soft)", color: "var(--destructive)" };
  return { border: "1px solid var(--border)", color: "var(--muted-foreground)" };
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
