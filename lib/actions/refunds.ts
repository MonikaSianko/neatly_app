"use server";

import { createClient } from "@/lib/supabase/server";

export type RefundTarget = {
  id: string;
  title: string;
  amountCents: number;
  date: string;
  categoryId: string;
  /** Doprecyzowanie czesci platnosci dzielonej, zeby dalo sie odroznic dwie pozycje o tym tytule. */
  splitLabel: string | null;
};

/** Ile miesiecy wstecz szukamy platnosci do zwrotu. Zwrot potrafi przyjsc dlugo po zakupie. */
const MONTHS_BACK = 12;
const LIMIT = 300;

function selectTargets(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase
    .from("transactions")
    .select("id, title, amount_cents, date, category_id, split_label")
    .eq("kind", "expense")
    .eq("is_refund", false);
}

const toTarget = (row: {
  id: string;
  title: string;
  amount_cents: number;
  date: string;
  category_id: string;
  split_label: string | null;
}): RefundTarget => ({
  id: row.id,
  title: row.title,
  amountCents: row.amount_cents,
  date: row.date,
  categoryId: row.category_id,
  splitLabel: row.split_label,
});

/**
 * Platnosci, do ktorych mozna dopiac zwrot: wydatki z tego portfela z ostatniego roku.
 * Wczytywane dopiero po zaznaczeniu "Zwrot" — lista transakcji nie musi jechac
 * z serwera przy kazdym otwarciu formularza.
 *
 * includeId dokleja edytowana platnosc, gdy wypadla poza okno — inaczej edycja starego
 * zwrotu pokazywalaby puste pole i cicho zrywala powiazanie.
 */
export async function listRefundTargets(
  householdId: string,
  walletId: string,
  includeId?: string | null
): Promise<{ targets: RefundTarget[]; error: string | null }> {
  const supabase = await createClient();

  const from = new Date();
  from.setMonth(from.getMonth() - MONTHS_BACK);
  const fromIso = from.toISOString().slice(0, 10);

  const { data, error } = await selectTargets(supabase)
    .eq("household_id", householdId)
    .eq("wallet_id", walletId)
    .gte("date", fromIso)
    .order("date", { ascending: false })
    .limit(LIMIT);

  if (error) return { targets: [], error: error.message };

  const targets = (data ?? []).map(toTarget);
  if (!includeId || targets.some((t) => t.id === includeId)) return { targets, error: null };

  const { data: extra } = await selectTargets(supabase).eq("id", includeId).maybeSingle();
  return { targets: extra ? [toTarget(extra), ...targets] : targets, error: null };
}
