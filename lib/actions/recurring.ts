"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, isoOf, parseMonthParam, toDate, type YearMonth } from "@/lib/month";
import { ensureMonthMaterialized } from "@/lib/materialize";

export type RecurrencePattern = {
  freq: "day" | "week" | "month" | "year";
  interval: number;
  weekdays: number[];
  untilDate: string | null;
};

export type RecurringEntryInput = {
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
  pattern: RecurrencePattern;
};

const dayBefore = (iso: string) => isoOf(addDays(toDate(iso), -1));

function ymFromDate(date: string): YearMonth {
  return parseMonthParam(date.slice(0, 7));
}

export async function createRecurringEntry(householdId: string, walletId: string, input: RecurringEntryInput) {
  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Podaj tytuł." };
  if (!input.amountCents || input.amountCents <= 0) return { error: "Podaj kwotę." };
  if (!input.categoryId) return { error: "Wybierz kategorię." };

  const supabase = await createClient();

  const { data: rule, error: ruleError } = await supabase
    .from("recurring_rules")
    .insert({
      household_id: householdId,
      wallet_id: walletId,
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      freq: input.pattern.freq,
      interval: input.pattern.interval,
      weekdays: input.pattern.freq === "week" && input.pattern.weekdays.length ? input.pattern.weekdays : null,
      start_date: input.date,
      until_date: input.pattern.untilDate,
    })
    .select("id")
    .single();

  if (ruleError || !rule) return { error: ruleError?.message ?? "Nie udało się utworzyć reguły." };

  await ensureMonthMaterialized(supabase, householdId, walletId, ymFromDate(input.date));

  if (input.isPaid) {
    await supabase
      .from("transactions")
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq("recurring_rule_id", rule.id)
      .eq("date", input.date);
  }

  revalidatePath("/");
  return { error: null };
}

/** Edycja pozycji cyklicznej w jednym z trzech zakresow. */
export async function updateRecurringEntry(
  transactionId: string,
  scope: "this" | "future" | "all",
  input: RecurringEntryInput
) {
  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Podaj tytuł." };
  if (!input.amountCents || input.amountCents <= 0) return { error: "Podaj kwotę." };
  if (!input.categoryId) return { error: "Wybierz kategorię." };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("transactions")
    .select("id, household_id, wallet_id, date, recurring_rule_id")
    .eq("id", transactionId)
    .single();

  if (!current) return { error: "Nie znaleziono pozycji." };
  const { household_id: householdId, wallet_id: walletId, recurring_rule_id: ruleId } = current;

  if (scope === "this" || !ruleId) {
    const { error } = await supabase
      .from("transactions")
      .update({
        kind: input.kind,
        title: trimmed,
        amount_cents: input.amountCents,
        category_id: input.categoryId,
        date: input.date,
        is_paid: input.isPaid,
        is_exception: !!ruleId,
      })
      .eq("id", transactionId);
    if (error) return { error: error.message };
    revalidatePath("/");
    return { error: null };
  }

  if (scope === "future") {
    const { error: closeError } = await supabase
      .from("recurring_rules")
      .update({ until_date: dayBefore(current.date) })
      .eq("id", ruleId);
    if (closeError) return { error: closeError.message };

    const { data: newRule, error: newRuleError } = await supabase
      .from("recurring_rules")
      .insert({
        household_id: householdId,
        wallet_id: walletId,
        kind: input.kind,
        title: trimmed,
        amount_cents: input.amountCents,
        category_id: input.categoryId,
        freq: input.pattern.freq,
        interval: input.pattern.interval,
        weekdays: input.pattern.freq === "week" && input.pattern.weekdays.length ? input.pattern.weekdays : null,
        start_date: input.date,
        until_date: input.pattern.untilDate,
      })
      .select("id")
      .single();
    if (newRuleError || !newRule) return { error: newRuleError?.message ?? "Nie udało się utworzyć reguły." };

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("recurring_rule_id", ruleId)
      .eq("is_paid", false)
      .eq("is_exception", false)
      .gte("date", current.date);
    if (deleteError) return { error: deleteError.message };

    const { error: insertError } = await supabase.from("transactions").insert({
      household_id: householdId,
      wallet_id: walletId,
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      date: input.date,
      is_paid: input.isPaid,
      paid_at: input.isPaid ? new Date().toISOString() : null,
      recurring_rule_id: newRule.id,
      is_exception: false,
    });
    if (insertError) return { error: insertError.message };

    revalidatePath("/");
    return { error: null };
  }

  // scope === "all"
  const { data: rule } = await supabase.from("recurring_rules").select("start_date").eq("id", ruleId).single();
  const { error: ruleUpdateError } = await supabase
    .from("recurring_rules")
    .update({
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      freq: input.pattern.freq,
      interval: input.pattern.interval,
      weekdays: input.pattern.freq === "week" && input.pattern.weekdays.length ? input.pattern.weekdays : null,
      until_date: input.pattern.untilDate,
      start_date: rule?.start_date,
    })
    .eq("id", ruleId);
  if (ruleUpdateError) return { error: ruleUpdateError.message };

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", ruleId)
    .eq("is_paid", false)
    .eq("is_exception", false);
  if (deleteError) return { error: deleteError.message };

  await ensureMonthMaterialized(supabase, householdId, walletId, ymFromDate(current.date));

  revalidatePath("/");
  return { error: null };
}

export async function deleteRecurringEntry(transactionId: string, scope: "this" | "future" | "all") {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("transactions")
    .select("id, date, recurring_rule_id")
    .eq("id", transactionId)
    .single();

  if (!current) return { error: "Nie znaleziono pozycji." };
  const ruleId = current.recurring_rule_id;

  if (scope === "this" || !ruleId) {
    const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
    if (error) return { error: error.message };
    revalidatePath("/");
    return { error: null };
  }

  if (scope === "future") {
    const { error: closeError } = await supabase
      .from("recurring_rules")
      .update({ until_date: dayBefore(current.date) })
      .eq("id", ruleId);
    if (closeError) return { error: closeError.message };

    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("recurring_rule_id", ruleId)
      .eq("is_paid", false)
      .gte("date", current.date);
    if (deleteError) return { error: deleteError.message };

    revalidatePath("/");
    return { error: null };
  }

  // scope === "all": usun nieoplacone/niewyjatkowe wystapienia, reguly usuniecie odlaczy reszte (ON DELETE SET NULL)
  const { error: deleteOccurrencesError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", ruleId)
    .eq("is_paid", false)
    .eq("is_exception", false);
  if (deleteOccurrencesError) return { error: deleteOccurrencesError.message };

  const { error: deleteRuleError } = await supabase.from("recurring_rules").delete().eq("id", ruleId);
  if (deleteRuleError) return { error: deleteRuleError.message };

  revalidatePath("/");
  return { error: null };
}
