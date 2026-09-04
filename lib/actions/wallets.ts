"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createWallet(householdId: string, name: string, emoji: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Podaj nazwę portfela.", wallet: null };

  const supabase = await createClient();
  const { count } = await supabase
    .from("wallets")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  const { data, error } = await supabase
    .from("wallets")
    .insert({ household_id: householdId, name: trimmed, emoji, position: count ?? 0 })
    .select("id, name, emoji")
    .single();

  if (error) return { error: error.message, wallet: null };

  revalidatePath("/");
  return { error: null, wallet: data };
}
