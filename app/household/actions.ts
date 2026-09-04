"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function renameHousehold(householdId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Podaj nazwę gospodarstwa." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ name: trimmed })
    .eq("id", householdId);

  if (error) return { error: error.message };

  revalidatePath("/household");
  return { error: null };
}

export async function createHouseholdInvite(householdId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowana." };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("household_invites")
    .insert({ household_id: householdId, created_by: user.id, expires_at: expiresAt })
    .select("code, expires_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/household");
  return { error: null, invite: data };
}
