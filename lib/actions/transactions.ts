"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addMonthsClamped } from "@/lib/month";

export type TransactionInput = {
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
};

export async function createTransaction(householdId: string, walletId: string, input: TransactionInput) {
  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Podaj tytuł." };
  if (!input.amountCents || input.amountCents <= 0) return { error: "Podaj kwotę." };
  if (!input.categoryId) return { error: "Wybierz kategorię." };

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    wallet_id: walletId,
    kind: input.kind,
    title: trimmed,
    amount_cents: input.amountCents,
    category_id: input.categoryId,
    date: input.date,
    is_paid: input.isPaid,
    paid_at: input.isPaid ? new Date().toISOString() : null,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const trimmed = input.title.trim();
  if (!trimmed) return { error: "Podaj tytuł." };
  if (!input.amountCents || input.amountCents <= 0) return { error: "Podaj kwotę." };
  if (!input.categoryId) return { error: "Wybierz kategorię." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      title: trimmed,
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      date: input.date,
      is_paid: input.isPaid,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function moveTransactionToNextMonth(id: string, currentDate: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ date: addMonthsClamped(currentDate, 1) })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}
