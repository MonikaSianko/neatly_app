import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { MonthContent } from "@/components/month-content";
import { MonthSkeleton } from "@/components/month-skeleton";
import { FabAddButton } from "@/components/fab-add-button";
import { createClient } from "@/lib/supabase/server";
import { parseMonthParam, monthKey, monthRange, isoToday } from "@/lib/month";
import { type Locale } from "@/lib/i18n";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string; month?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_household_id, locale")
    .eq("user_id", user.id)
    .single();

  const householdId = profile?.active_household_id;
  if (!householdId) redirect("/household");
  const locale: Locale = profile?.locale === "en" ? "en" : "pl";

  const [{ data: wallets }, { data: categories }] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, name, emoji")
      .eq("household_id", householdId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, name_en, emoji, color, kind, position, is_archived")
      .eq("household_id", householdId)
      .order("position", { ascending: true }),
  ]);

  const params = await searchParams;
  const activeWalletId =
    (params.wallet && wallets?.some((w) => w.id === params.wallet) ? params.wallet : wallets?.[0]?.id) ?? "";
  const ym = parseMonthParam(params.month);
  const activeTab = (["upcoming", "expense", "income"] as const).includes(params.tab as never)
    ? (params.tab as "upcoming" | "expense" | "income")
    : "upcoming";

  const today = isoToday();
  const range = monthRange(ym);
  const defaultDate = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7)) ? today : range.from;

  return (
    <>
      <Header
        wallets={wallets ?? []}
        activeWalletId={activeWalletId}
        householdId={householdId}
        categories={categories ?? []}
        email={user.email ?? null}
        ym={ym}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-2 py-4 md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-5 md:px-4 md:py-5">
        {/* Klucz przelacza granice przy zmianie portfela/miesiaca, wiec szkielet pojawia sie od razu. */}
        <Suspense key={`${activeWalletId}-${monthKey(ym)}`} fallback={<MonthSkeleton />}>
          <MonthContent
            householdId={householdId}
            walletId={activeWalletId}
            ym={ym}
            locale={locale}
            categories={categories ?? []}
            activeTab={activeTab}
          />
        </Suspense>
      </main>

      <FabAddButton
        householdId={householdId}
        walletId={activeWalletId}
        categories={categories ?? []}
        defaultDate={defaultDate}
      />
    </>
  );
}
