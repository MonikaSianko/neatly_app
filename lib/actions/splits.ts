"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SplitPart = {
  /** Istniejacy wiersz przy edycji; brak = nowa czesc. */
  id?: string;
  categoryId: string;
  amountCents: number;
  label: string | null;
};

export type SplitInput = {
  kind: "expense" | "income";
  title: string;
  date: string;
  isPaid: boolean;
  paymentUrl: string | null;
  graceDays: number;
  note: string | null;
  isAutomatic: boolean;
  parts: SplitPart[];
};

function validate(input: SplitInput) {
  if (!input.title.trim()) return "Podaj tytuł.";
  if (input.parts.length < 2) return "Podziel płatność na co najmniej dwie kategorie.";
  if (input.parts.some((p) => !p.categoryId)) return "Wybierz kategorię dla każdej części.";
  if (input.parts.some((p) => !p.amountCents || p.amountCents <= 0)) return "Podaj kwotę każdej części.";
  return null;
}

/** Pola wspolne dla calej platnosci — czesci roznia sie tylko kategoria, kwota i doprecyzowaniem. */
function sharedFields(input: SplitInput, paidAt: string | null) {
  return {
    kind: input.kind,
    title: input.title.trim(),
    date: input.date,
    is_paid: input.isPaid,
    paid_at: paidAt,
    payment_url: input.paymentUrl,
    grace_days: input.graceDays,
    note: input.note,
    is_automatic: input.isAutomatic,
    recurring_rule_id: null,
    is_exception: false,
  };
}

export async function createSplitTransaction(householdId: string, walletId: string, input: SplitInput) {
  const error = validate(input);
  if (error) return { error };

  const supabase = await createClient();
  const groupId = crypto.randomUUID();
  const shared = sharedFields(input, input.isPaid ? new Date().toISOString() : null);

  const { error: insertError } = await supabase.from("transactions").insert(
    input.parts.map((part) => ({
      household_id: householdId,
      wallet_id: walletId,
      ...shared,
      category_id: part.categoryId,
      amount_cents: part.amountCents,
      split_group_id: groupId,
      split_label: part.label?.trim() || null,
    }))
  );

  if (insertError) return { error: insertError.message };
  revalidatePath("/");
  return { error: null };
}

/**
 * Edycja calej platnosci. Istniejace czesci aktualizujemy w miejscu, zeby nie gubic daty dodania;
 * usuniete znikaja, dopisane dochodza.
 */
export async function updateSplitTransaction(groupId: string, input: SplitInput) {
  const error = validate(input);
  if (error) return { error };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("transactions")
    .select("id, household_id, wallet_id, paid_at")
    .eq("split_group_id", groupId);

  if (!existing || existing.length === 0) return { error: "Nie znaleziono płatności." };

  const { household_id: householdId, wallet_id: walletId } = existing[0];
  const keptPaidAt = existing.find((row) => row.paid_at)?.paid_at ?? null;
  const shared = sharedFields(input, input.isPaid ? keptPaidAt ?? new Date().toISOString() : null);

  const keptIds = input.parts.map((p) => p.id).filter((id): id is string => !!id);
  const removed = existing.filter((row) => !keptIds.includes(row.id)).map((row) => row.id);
  if (removed.length > 0) {
    const { error: deleteError } = await supabase.from("transactions").delete().in("id", removed);
    if (deleteError) return { error: deleteError.message };
  }

  for (const part of input.parts) {
    const row = {
      ...shared,
      category_id: part.categoryId,
      amount_cents: part.amountCents,
      split_label: part.label?.trim() || null,
    };
    const { error: writeError } = part.id
      ? await supabase.from("transactions").update(row).eq("id", part.id)
      : await supabase
          .from("transactions")
          .insert({ ...row, household_id: householdId, wallet_id: walletId, split_group_id: groupId });
    if (writeError) return { error: writeError.message };
  }

  revalidatePath("/");
  return { error: null };
}

/**
 * Zwykla pozycja staje sie platnoscia dzielona. Istniejacy wiersz przejmuje pierwsza czesc,
 * zamiast zostac obok jako osobny wpis — edycja ma zmieniac pozycje, nie dokladac nowej.
 */
export async function convertToSplit(transactionId: string, input: SplitInput) {
  const error = validate(input);
  if (error) return { error };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("transactions")
    .select("id, household_id, wallet_id, paid_at")
    .eq("id", transactionId)
    .single();

  if (!current) return { error: "Nie znaleziono pozycji." };

  const groupId = crypto.randomUUID();
  const shared = sharedFields(input, input.isPaid ? current.paid_at ?? new Date().toISOString() : null);
  const [first, ...rest] = input.parts;

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      ...shared,
      category_id: first.categoryId,
      amount_cents: first.amountCents,
      split_group_id: groupId,
      split_label: first.label?.trim() || null,
    })
    .eq("id", transactionId);
  if (updateError) return { error: updateError.message };

  const { error: insertError } = await supabase.from("transactions").insert(
    rest.map((part) => ({
      household_id: current.household_id,
      wallet_id: current.wallet_id,
      ...shared,
      category_id: part.categoryId,
      amount_cents: part.amountCents,
      split_group_id: groupId,
      split_label: part.label?.trim() || null,
    }))
  );
  if (insertError) return { error: insertError.message };

  revalidatePath("/");
  return { error: null };
}

/** Platnosc dzielona wraca do jednej pozycji: zostaje pierwszy wiersz, reszta czesci znika. */
export async function mergeSplitToSingle(
  groupId: string,
  input: {
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
  }
) {
  if (!input.title.trim()) return { error: "Podaj tytuł." };
  if (!input.amountCents || input.amountCents <= 0) return { error: "Podaj kwotę." };
  if (!input.categoryId) return { error: "Wybierz kategorię." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, paid_at, created_at")
    .eq("split_group_id", groupId)
    .order("created_at", { ascending: true });

  if (!existing || existing.length === 0) return { error: "Nie znaleziono płatności." };

  const [kept, ...rest] = existing;
  if (rest.length > 0) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .in("id", rest.map((row) => row.id));
    if (deleteError) return { error: deleteError.message };
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      title: input.title.trim(),
      amount_cents: input.amountCents,
      category_id: input.categoryId,
      date: input.date,
      is_paid: input.isPaid,
      paid_at: input.isPaid ? kept.paid_at ?? new Date().toISOString() : null,
      payment_url: input.paymentUrl,
      grace_days: input.graceDays,
      note: input.note,
      is_automatic: input.isAutomatic,
      split_group_id: null,
      split_label: null,
    })
    .eq("id", kept.id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/");
  return { error: null };
}

/** Platnosc dzielona znika w calosci — pojedyncza czesc bez reszty nie zgadzalaby sie z wyciagiem. */
export async function deleteSplitTransaction(groupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("split_group_id", groupId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

/** Odhaczenie dotyczy calej platnosci, nie pojedynczej czesci. */
export async function setSplitPaid(groupId: string, isPaid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq("split_group_id", groupId);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}
