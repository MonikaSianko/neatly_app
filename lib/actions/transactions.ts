"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TransactionInput = {
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
  /** Zwrot ksieguje sie w kategorii zwracanej platnosci i pomniejsza jej wydatki. */
  isRefund?: boolean;
  refundOfId?: string | null;
};

/** Zwrot bez wskazanej platnosci nie ma czego pomniejszac — reszta reguly pilnuje baza. */
function validate(input: TransactionInput) {
  if (!input.title.trim()) return "Podaj tytuł.";
  if (!input.amountCents || input.amountCents <= 0) return "Podaj kwotę.";
  if (!input.categoryId) return "Wybierz kategorię.";
  if (input.isRefund && !input.refundOfId) return "Wskaż płatność, której dotyczy zwrot.";
  return null;
}

/** Pola zwrotu zawsze w parze: odznaczenie zwrotu musi wyczyscic tez link do platnosci. */
function refundFields(input: TransactionInput) {
  return {
    is_refund: input.isRefund ?? false,
    refund_of_id: input.isRefund ? (input.refundOfId ?? null) : null,
  };
}

export async function createTransaction(householdId: string, walletId: string, input: TransactionInput) {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  const trimmed = input.title.trim();

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
    payment_url: input.paymentUrl,
    grace_days: input.graceDays,
    note: input.note,
    is_automatic: input.isAutomatic,
    ...refundFields(input),
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  const trimmed = input.title.trim();

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
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
      ...refundFields(input),
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

