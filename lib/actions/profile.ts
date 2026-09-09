"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, LOCALE_MAX_AGE } from "@/lib/locale";
import type { Locale } from "@/lib/i18n";

export async function setLocale(locale: Locale) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Musisz być zalogowana." };

  const { error } = await supabase.from("profiles").update({ locale }).eq("user_id", user.id);
  if (error) return { error: error.message };

  // Ciasteczko ma pierwszenstwo przy renderze, wiec musi isc w parze z profilem.
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: LOCALE_MAX_AGE, sameSite: "lax" });

  revalidatePath("/");
  return { error: null };
}
