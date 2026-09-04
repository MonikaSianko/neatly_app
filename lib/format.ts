/** Grosze -> "1 234,56 zł" (pl-PL). */
export function money(amountCents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

/** "2026-09-05" -> "5 wrz" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
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
