"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

export async function setLocale(locale: Locale) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowana." };

  const { error } = await supabase.from("profiles").update({ locale }).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null };
}
