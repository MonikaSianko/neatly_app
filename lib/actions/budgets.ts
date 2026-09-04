"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monthRange, shiftMonth, monthKey, type YearMonth } from "@/lib/month";

const toMonthDate = (ym: YearMonth) => `${monthKey(ym)}-01`;

export async function setCategoryBudget(
  householdId: string,
  walletId: string,
  categoryId: string,
  ym: YearMonth,
  amountCents: number
) {
  if (!categoryId) return { error: "Wybierz kategorię." };
  if (!amountCents || amountCents <= 0) return { error: "Podaj kwotę." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("category_budgets")
    .upsert(
      {
        household_id: householdId,
        wallet_id: walletId,
        category_id: categoryId,
        month: toMonthDate(ym),
        amount_cents: amountCents,
      },
      { onConflict: "wallet_id,category_id,month" }
    );

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function deleteCategoryBudget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("category_budgets").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function copyBudgetsFromPreviousMonth(householdId: string, walletId: string, ym: YearMonth) {
  const supabase = await createClient();
  const prev = shiftMonth(ym, -1);

  const { data: prevBudgets } = await supabase
    .from("category_budgets")
    .select("category_id, amount_cents")
    .eq("wallet_id", walletId)
    .eq("month", toMonthDate(prev));

  if (!prevBudgets || prevBudgets.length === 0) {
    return { error: null, copied: 0 };
  }

  const { error } = await supabase.from("category_budgets").upsert(
    prevBudgets.map((b) => ({
      household_id: householdId,
      wallet_id: walletId,
      category_id: b.category_id,
      month: toMonthDate(ym),
      amount_cents: b.amount_cents,
    })),
    { onConflict: "wallet_id,category_id,month", ignoreDuplicates: true }
  );

  if (error) return { error: error.message, copied: 0 };
  revalidatePath("/");
  return { error: null, copied: prevBudgets.length };
}

export async function setMonthOpening(householdId: string, walletId: string, ym: YearMonth, amountCents: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("month_openings")
    .upsert(
      { household_id: householdId, wallet_id: walletId, month: toMonthDate(ym), amount_cents: amountCents },
      { onConflict: "wallet_id,month" }
    );

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function carryOverOpening(householdId: string, walletId: string, ym: YearMonth) {
  const supabase = await createClient();
  const prev = shiftMonth(ym, -1);
  const prevRange = monthRange(prev);

  const [{ data: prevOpening }, { data: prevTx }] = await Promise.all([
    supabase
      .from("month_openings")
      .select("amount_cents")
      .eq("wallet_id", walletId)
      .eq("month", toMonthDate(prev))
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("kind, amount_cents, is_paid")
      .eq("wallet_id", walletId)
      .eq("is_paid", true)
      .gte("date", prevRange.from)
      .lte("date", prevRange.to),
  ]);

  const opening = prevOpening?.amount_cents ?? 0;
  const actual = (prevTx ?? []).reduce(
    (sum, t) => sum + (t.kind === "income" ? t.amount_cents : -t.amount_cents),
    0
  );
  const carried = opening + actual;

  const result = await setMonthOpening(householdId, walletId, ym, carried);
  if (result.error) return { error: result.error, amountCents: null };
  return { error: null, amountCents: carried };
}
