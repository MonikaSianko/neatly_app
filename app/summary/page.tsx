import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { SummaryContent } from "@/components/summary-content";
import { MonthSkeleton } from "@/components/month-skeleton";
import { createClient } from "@/lib/supabase/server";
import { parseMonthParam, monthKey } from "@/lib/month";
import { resolveLocale } from "@/lib/locale";
import { t as translate } from "@/lib/i18n";

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
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
  const locale = await resolveLocale(profile?.locale);
  const t = translate(locale);

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
  const ym = parseMonthParam(params.month);

  return (
    <>
      {/* Ekran stoi ponad portfelami, wiec przelacznik portfela jest tu wylaczony. */}
      <Header
        wallets={wallets ?? []}
        activeWalletId=""
        householdId={householdId}
        categories={categories ?? []}
        email={user.email ?? null}
        ym={ym}
        showWalletSwitcher={false}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-2 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-4 md:pt-5 xl:grid xl:grid-cols-[1fr_320px] xl:items-start xl:gap-5">
        <div className="xl:col-span-2">
          <h1 className="text-xl font-semibold tracking-tight">{t.monthSummary}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.allWallets} · {wallets?.length ?? 0} {t.walletsCount}
          </p>
        </div>

        {/* Klucz przelacza granice przy zmianie miesiaca, wiec szkielet pojawia sie od razu. */}
        <Suspense key={monthKey(ym)} fallback={<MonthSkeleton />}>
          <SummaryContent
            householdId={householdId}
            wallets={wallets ?? []}
            categories={(categories ?? []).filter((c) => c.kind === "expense")}
            ym={ym}
            locale={locale}
          />
        </Suspense>
      </main>
    </>
  );
}
