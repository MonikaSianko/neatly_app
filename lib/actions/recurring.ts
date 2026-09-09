"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, diffDays, isoOf, parseMonthParam, toDate, type YearMonth } from "@/lib/month";
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
  paymentUrl: string | null;
  graceDays: number;
  note: string | null;
  isAutomatic: boolean;
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
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
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

/**
 * Jednorazowa pozycja staje sie cykliczna. Istniejacy wiersz zostaje pierwszym wystapieniem nowej reguly,
 * zamiast zostac skasowany i wstawiony od nowa — edycja ma zmieniac pozycje, nie tworzyc nowej.
 */
export async function convertToRecurring(
  transactionId: string,
  householdId: string,
  walletId: string,
  input: RecurringEntryInput
) {
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
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
    })
    .select("id")
    .single();

  if (ruleError || !rule) return { error: ruleError?.message ?? "Nie udało się utworzyć reguły." };

  // Podpiecie istniejacego wiersza przed materializacja: dzieki temu ta data jest juz zajeta
  // i nie powstanie drugie wystapienie obok.
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      date: input.date,
      is_paid: input.isPaid,
      paid_at: input.isPaid ? new Date().toISOString() : null,
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
      recurring_rule_id: rule.id,
      is_exception: false,
    })
    .eq("id", transactionId);
  if (updateError) return { error: updateError.message };

  await ensureMonthMaterialized(supabase, householdId, walletId, ymFromDate(input.date));

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
    .select("id, household_id, wallet_id, date, recurring_rule_id, paid_at")
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
        paid_at: input.isPaid ? current.paid_at ?? new Date().toISOString() : null,
        is_exception: !!ruleId,
        payment_url: input.paymentUrl,
        grace_days: input.graceDays,
        note: input.note,
        is_automatic: input.isAutomatic,
      })
      .eq("id", transactionId);
    if (error) return { error: error.message };
    revalidatePath("/");
    return { error: null };
  }

  if (scope === "future") {
    const newWeekdays =
      input.pattern.freq === "week" && input.pattern.weekdays.length ? input.pattern.weekdays : null;

    const { data: oldRule } = await supabase
      .from("recurring_rules")
      .select("freq, interval, weekdays")
      .eq("id", ruleId)
      .single();

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
        weekdays: newWeekdays,
        start_date: input.date,
        until_date: input.pattern.untilDate,
        payment_url: input.paymentUrl,
        grace_days: input.graceDays,
        note: input.note,
        is_automatic: input.isAutomatic,
      })
      .select("id")
      .single();
    if (newRuleError || !newRule) return { error: newRuleError?.message ?? "Nie udało się utworzyć reguły." };

    // Jesli wzorzec i kotwica sie nie zmienily, pozniejsze raty wypadaja w tych samych dniach —
    // przepinamy je pod nowa regule, zeby zachowaly daty i znacznik oplacenia.
    const datesUnchanged =
      !!oldRule &&
      oldRule.freq === input.pattern.freq &&
      oldRule.interval === input.pattern.interval &&
      JSON.stringify(oldRule.weekdays ?? null) === JSON.stringify(newWeekdays) &&
      input.date === current.date;

    const { error: laterError } = datesUnchanged
      ? await supabase
          .from("transactions")
          .update({
            kind: input.kind,
            title: trimmed,
            amount_cents: input.amountCents,
            category_id: input.categoryId,
            recurring_rule_id: newRule.id,
            payment_url: input.paymentUrl,
            grace_days: input.graceDays,
            note: input.note,
            is_automatic: input.isAutomatic,
          })
          .eq("recurring_rule_id", ruleId)
          .eq("is_exception", false)
          .gt("date", current.date)
      : await supabase
          .from("transactions")
          .delete()
          .eq("recurring_rule_id", ruleId)
          .eq("is_exception", false)
          .gt("date", current.date);
    if (laterError) return { error: laterError.message };

    // Klikniete wystapienie edytujemy w miejscu — inaczej powstalby duplikat obok starego wiersza.
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        kind: input.kind,
        title: trimmed,
        amount_cents: input.amountCents,
        category_id: input.categoryId,
        date: input.date,
        is_paid: input.isPaid,
        paid_at: input.isPaid ? current.paid_at ?? new Date().toISOString() : null,
        recurring_rule_id: newRule.id,
        is_exception: false,
        payment_url: input.paymentUrl,
        grace_days: input.graceDays,
        note: input.note,
        is_automatic: input.isAutomatic,
      })
      .eq("id", transactionId);
    if (updateError) return { error: updateError.message };

    // Przepiete raty moga wykraczac poza nowa date konca serii.
    if (input.pattern.untilDate) {
      const { error: trimError } = await supabase
        .from("transactions")
        .delete()
        .eq("recurring_rule_id", newRule.id)
        .gt("date", input.pattern.untilDate);
      if (trimError) return { error: trimError.message };
    }

    await ensureMonthMaterialized(supabase, householdId, walletId, ymFromDate(input.date));

    revalidatePath("/");
    return { error: null };
  }

  // scope === "all"
  const { data: rule } = await supabase.from("recurring_rules").select("start_date").eq("id", ruleId).single();

  // Zmiana daty w zakresie "wszystkie" przesuwa cala serie o te sama roznice dni,
  // dzieki czemu kolejne raty wypadaja w nowym dniu, a nie w starym.
  const shiftDays = diffDays(toDate(input.date), toDate(current.date));
  const newStartDate = rule?.start_date ? isoOf(addDays(toDate(rule.start_date), shiftDays)) : input.date;

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
      start_date: newStartDate,
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
    })
    .eq("id", ruleId);
  if (ruleUpdateError) return { error: ruleUpdateError.message };

  // Nieoplacone raty odtwarzamy z reguly, zeby poszly za nowym wzorcem dat.
  // Edytowany wiersz zostaje — zajmuje sie nim krok nizej.
  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", ruleId)
    .eq("is_paid", false)
    .eq("is_exception", false)
    .neq("id", transactionId);
  if (deleteError) return { error: deleteError.message };

  // Edytowana rata zmienia sie zawsze, takze jej data — niezaleznie od wybranego zakresu.
  const { error: currentError } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      date: input.date,
      is_paid: input.isPaid,
      paid_at: input.isPaid ? current.paid_at ?? new Date().toISOString() : null,
      is_exception: false,
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
    })
    .eq("id", transactionId);
  if (currentError) return { error: currentError.message };

  // Pozostale raty: tresc idzie za regula, ale daty oplaconych zostaja — to juz historia.
  const { error: occurrencesError } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
    })
    .eq("recurring_rule_id", ruleId)
    .eq("is_exception", false)
    .neq("id", transactionId);
  if (occurrencesError) return { error: occurrencesError.message };

  await ensureMonthMaterialized(supabase, householdId, walletId, ymFromDate(input.date));

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

    // Takze klikniete wystapienie — bez tego oplacona pozycja zostawala na ekranie.
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("recurring_rule_id", ruleId)
      .gte("date", current.date);
    if (deleteError) return { error: deleteError.message };

    revalidatePath("/");
    return { error: null };
  }

  // scope === "all": cala seria znika razem z regula.
  // Wczesniej zostawaly tu oplacone raty, wiec usuniecie reguly tylko odpinalo je (ON DELETE SET NULL)
  // i wiersz zostawal na ekranie bez ikony powtarzania.
  const { error: deleteOccurrencesError } = await supabase
    .from("transactions")
    .delete()
    .eq("recurring_rule_id", ruleId);
  if (deleteOccurrencesError) return { error: deleteOccurrencesError.message };

  const { error: deleteRuleError } = await supabase.from("recurring_rules").delete().eq("id", ruleId);
  if (deleteRuleError) return { error: deleteRuleError.message };

  revalidatePath("/");
  return { error: null };
}
