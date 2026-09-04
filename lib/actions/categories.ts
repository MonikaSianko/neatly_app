"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CategoryKind = "expense" | "income";

export type CategoryInput = {
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
};

export async function createCategory(householdId: string, position: number, input: CategoryInput) {
  const trimmed = input.name.trim();
  if (!trimmed) return { error: "Podaj nazwę kategorii." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    household_id: householdId,
    name: trimmed,
    emoji: input.emoji,
    color: input.color,
    kind: input.kind,
    position,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function updateCategory(id: string, input: Pick<CategoryInput, "name" | "emoji" | "color">) {
  const trimmed = input.name.trim();
  if (!trimmed) return { error: "Podaj nazwę kategorii." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: trimmed, emoji: input.emoji, color: input.color })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

export async function reorderCategory(
  householdId: string,
  kind: CategoryKind,
  id: string,
  direction: -1 | 1
) {
  const supabase = await createClient();
  const { data: list, error: listError } = await supabase
    .from("categories")
    .select("id, position")
    .eq("household_id", householdId)
    .eq("kind", kind)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  if (listError || !list) return { error: listError?.message ?? "Nie udało się pobrać kategorii." };

  const i = list.findIndex((c) => c.id === id);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= list.length) return { error: null };

  const a = list[i];
  const b = list[j];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("categories").update({ position: b.position }).eq("id", a.id),
    supabase.from("categories").update({ position: a.position }).eq("id", b.id),
  ]);

  if (e1 || e2) return { error: (e1 ?? e2)?.message ?? "Błąd zapisu kolejności." };
  revalidatePath("/");
  return { error: null };
}

export async function restoreCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_archived: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

/** Usuwa kategorię na trwałe, jeśli jest nieużywana; w przeciwnym razie archiwizuje. */
export async function deleteOrArchiveCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      const { error: archiveError } = await supabase
        .from("categories")
        .update({ is_archived: true })
        .eq("id", id);
      if (archiveError) return { error: archiveError.message, archived: false };
      revalidatePath("/");
      return { error: null, archived: true };
    }
    return { error: error.message, archived: false };
  }

  revalidatePath("/");
  return { error: null, archived: false };
}
