"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureMonthMaterialized } from "@/lib/materialize";
import { parseMonthParam } from "@/lib/month";
import type { RecurrencePattern } from "@/lib/actions/recurring";

export type DraftRowInput = {
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
  pattern: RecurrencePattern | null;
};

export async function saveDraftRows(householdId: string, walletId: string, rows: DraftRowInput[]) {
  if (rows.length === 0) return { error: null, count: 0 };

  const supabase = await createClient();
  const plain = rows.filter((r) => !r.pattern);
  const recurring = rows.filter((r) => r.pattern);

  if (plain.length) {
    const { error } = await supabase.from("transactions").insert(
      plain.map((r) => ({
        household_id: householdId,
        wallet_id: walletId,
        kind: r.kind,
        title: r.title.trim(),
        amount_cents: r.amountCents,
        category_id: r.categoryId,
        date: r.date,
        is_paid: r.isPaid,
        paid_at: r.isPaid ? new Date().toISOString() : null,
      }))
    );
    if (error) return { error: error.message, count: 0 };
  }

  for (const r of recurring) {
    const pattern = r.pattern!;
    const { data: rule, error: ruleError } = await supabase
      .from("recurring_rules")
      .insert({
        household_id: householdId,
        wallet_id: walletId,
        kind: r.kind,
        title: r.title.trim(),
        amount_cents: r.amountCents,
        category_id: r.categoryId,
        freq: pattern.freq,
        interval: pattern.interval,
        weekdays: pattern.freq === "week" && pattern.weekdays.length ? pattern.weekdays : null,
        start_date: r.date,
        until_date: pattern.untilDate,
      })
      .select("id")
      .single();
    if (ruleError || !rule) return { error: ruleError?.message ?? "Nie udało się utworzyć reguły.", count: 0 };

    await ensureMonthMaterialized(supabase, householdId, walletId, parseMonthParam(r.date.slice(0, 7)));

    if (r.isPaid) {
      await supabase
        .from("transactions")
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq("recurring_rule_id", rule.id)
        .eq("date", r.date);
    }
  }

  revalidatePath("/");
  return { error: null, count: rows.length };
}
