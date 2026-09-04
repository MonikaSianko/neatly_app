import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange, type YearMonth } from "./month";
import { occurrences } from "./recurrence";

/**
 * Leniwa materializacja: przy otwarciu miesiaca dolicza brakujace
 * wystapienia regul cyklicznych jako wiersze w transactions.
 *
 * Kolejnosc obrony przed duplikatami (najpierw logika, potem indeks):
 * 1. Sprawdzamy, ktore daty juz istnieja dla danej reguly w tym miesiacu.
 * 2. Wstawiamy tylko brakujace.
 * 3. Unikalny indeks (recurring_rule_id, date) chroni na wypadek wyscigu.
 */
export async function ensureMonthMaterialized(
  supabase: SupabaseClient,
  householdId: string,
  walletId: string,
  ym: YearMonth
): Promise<void> {
  const range = monthRange(ym);

  const { data: rules } = await supabase
    .from("recurring_rules")
    .select("id, kind, title, amount_cents, category_id, freq, interval, weekdays, start_date, until_date")
    .eq("household_id", householdId)
    .eq("wallet_id", walletId)
    .lte("start_date", range.to);

  if (!rules || rules.length === 0) return;

  const ruleIds = rules.map((r) => r.id);
  const { data: existing } = await supabase
    .from("transactions")
    .select("recurring_rule_id, date")
    .eq("wallet_id", walletId)
    .in("recurring_rule_id", ruleIds)
    .gte("date", range.from)
    .lte("date", range.to);

  const existingKeys = new Set((existing ?? []).map((t) => `${t.recurring_rule_id}:${t.date}`));

  const rows = rules.flatMap((rule) => {
    const dates = occurrences(
      {
        freq: rule.freq as "day" | "week" | "month" | "year",
        interval: rule.interval,
        weekdays: rule.weekdays,
        startDate: rule.start_date,
        untilDate: rule.until_date,
      },
      range.from,
      range.to
    );
    return dates
      .filter((date) => !existingKeys.has(`${rule.id}:${date}`))
      .map((date) => ({
        household_id: householdId,
        wallet_id: walletId,
        kind: rule.kind,
        title: rule.title,
        amount_cents: rule.amount_cents,
        category_id: rule.category_id,
        date,
        is_paid: false,
        recurring_rule_id: rule.id,
        is_exception: false,
      }));
  });

  if (rows.length === 0) return;

  // Ostatnia linia obrony: unikalny indeks (recurring_rule_id, date)
  // odrzuci ewentualny wyscig; blad wtedy jest nieszkodliwy.
  await supabase.from("transactions").insert(rows);
}
