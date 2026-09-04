import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { SwipeMonth } from "@/components/swipe-month";
import { TransactionGroupList, type TxGroup, type TxRow } from "@/components/transaction-group-list";
import type { EditingRule } from "@/components/transaction-form";
import { FabAddButton } from "@/components/fab-add-button";
import { BudgetTiles, type BudgetRow } from "@/components/budget-tiles";
import { OpeningBalance } from "@/components/opening-balance";
import { createClient } from "@/lib/supabase/server";
import { parseMonthParam, monthRange, isoToday } from "@/lib/month";
import { computeSummary, categorySpent } from "@/lib/summary";
import { money } from "@/lib/format";
import { ensureMonthMaterialized } from "@/lib/materialize";

const TABS = [
  { key: "upcoming", label: "Nadchodzące" },
  { key: "expense", label: "Wydatki" },
  { key: "income", label: "Przychody" },
] as const;

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
    .select("active_household_id")
    .eq("user_id", user.id)
    .single();

  const householdId = profile?.active_household_id;
  if (!householdId) redirect("/household");

  const [{ data: wallets }, { data: categories }] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, name, emoji")
      .eq("household_id", householdId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, emoji, color, kind, position, is_archived")
      .eq("household_id", householdId)
      .order("position", { ascending: true }),
  ]);

  const params = await searchParams;
  const activeWalletId =
    (params.wallet && wallets?.some((w) => w.id === params.wallet) ? params.wallet : wallets?.[0]?.id) ?? "";
  const ym = parseMonthParam(params.month);
  const range = monthRange(ym);
  const monthDate = `${range.from.slice(0, 7)}-01`;
  const activeTab = (["upcoming", "expense", "income"] as const).includes(params.tab as never)
    ? (params.tab as "upcoming" | "expense" | "income")
    : "expense";

  if (activeWalletId) {
    await ensureMonthMaterialized(supabase, householdId, activeWalletId, ym);
  }

  const [{ data: transactions }, { data: budgets }, { data: opening }, { data: recurringRules }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, kind, title, amount_cents, category_id, date, is_paid, recurring_rule_id")
      .eq("household_id", householdId)
      .eq("wallet_id", activeWalletId)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("category_budgets")
      .select("id, category_id, amount_cents")
      .eq("household_id", householdId)
      .eq("wallet_id", activeWalletId)
      .eq("month", monthDate),
    supabase
      .from("month_openings")
      .select("amount_cents")
      .eq("household_id", householdId)
      .eq("wallet_id", activeWalletId)
      .eq("month", monthDate)
      .maybeSingle(),
    supabase
      .from("recurring_rules")
      .select("id, freq, interval, weekdays, until_date")
      .eq("household_id", householdId)
      .eq("wallet_id", activeWalletId),
  ]);

  const monthTx = transactions ?? [];
  const monthBudgets = budgets ?? [];
  const openingCents = opening?.amount_cents ?? 0;
  const rulesMap: Record<string, EditingRule> = Object.fromEntries(
    (recurringRules ?? []).map((r) => [
      r.id,
      { freq: r.freq as EditingRule["freq"], interval: r.interval, weekdays: r.weekdays, untilDate: r.until_date },
    ])
  );

  const summary = computeSummary(
    monthTx.map((t) => ({ kind: t.kind, amount_cents: t.amount_cents, is_paid: t.is_paid, category_id: t.category_id })),
    monthBudgets.map((b) => ({ category_id: b.category_id, amount_cents: b.amount_cents })),
    openingCents
  );

  const budgetRows: BudgetRow[] = monthBudgets.map((b) => ({
    id: b.id,
    categoryId: b.category_id,
    limitCents: b.amount_cents,
    spentCents: categorySpent(monthTx, b.category_id),
  }));

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const groupsFor = (kind: "expense" | "income"): TxGroup[] => {
    const map = new Map<string, TxRow[]>();
    monthTx
      .filter((x) => x.kind === kind)
      .forEach((x) => {
        const list = map.get(x.category_id) ?? [];
        list.push(x);
        map.set(x.category_id, list);
      });
    return [...map.entries()]
      .map(([categoryId, items]) => {
        const cat = categoryById.get(categoryId);
        return {
          category: cat ? { id: cat.id, name: cat.name, emoji: cat.emoji, color: cat.color } : null,
          items: items.sort((a, b) => a.date.localeCompare(b.date)),
          sum: items.reduce((s, x) => s + x.amount_cents, 0),
        };
      })
      .sort((a, b) => (categoryById.get(a.category?.id ?? "")?.position ?? 0) - (categoryById.get(b.category?.id ?? "")?.position ?? 0));
  };

  const today = isoToday();
  const defaultDate = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7)) ? today : range.from;

  const tabsQuery = (tab: string) => {
    const p = new URLSearchParams();
    if (activeWalletId) p.set("wallet", activeWalletId);
    if (params.month) p.set("month", params.month);
    p.set("tab", tab);
    return `/?${p.toString()}`;
  };

  const expenseCategories = (categories ?? []).filter((c) => c.kind === "expense" && !c.is_archived);

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

      <SwipeMonth ym={ym}>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-6 md:p-6">
          {/* Prawa kolumna na mobile jest u góry */}
          <aside className="order-1 flex flex-col gap-4 md:order-2">
            <section className="rounded-[14px] border border-border bg-card p-4">
              <div className="flex items-center justify-between text-sm">
                <OpeningBalance householdId={householdId} walletId={activeWalletId} ym={ym} openingCents={openingCents} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">Przychody</div>
                  <div className="tabular text-[18px] font-semibold">{money(summary.income)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Wydatki</div>
                  <div className="tabular text-[18px] font-semibold">{money(summary.expenses)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Balans miesiąca</div>
                  <div className="tabular text-[18px] font-semibold" style={{ color: "var(--neatly-primary-dark)" }}>
                    {money(summary.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Faktyczny balans</div>
                  <div className="tabular text-[18px] font-semibold">{money(summary.actual)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Stan konta na koniec miesiąca</span>
                <span className="tabular font-semibold">{money(summary.closing)}</span>
              </div>
            </section>

            <BudgetTiles
              householdId={householdId}
              walletId={activeWalletId}
              ym={ym}
              categories={expenseCategories}
              rows={budgetRows}
            />
          </aside>

          {/* Lewa kolumna: zakładki */}
          <section className="order-2 flex flex-col gap-3 md:order-1">
            <div className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={tabsQuery(tab.key)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium"
                  style={
                    activeTab === tab.key
                      ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            {activeTab === "upcoming" ? (
              <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Zakładka „Nadchodzące&rdquo; pojawi się w kolejnym etapie.
              </div>
            ) : (
              <TransactionGroupList
                groups={groupsFor(activeTab)}
                kind={activeTab}
                householdId={householdId}
                walletId={activeWalletId}
                categories={categories ?? []}
                rules={rulesMap}
                today={today}
                defaultDate={defaultDate}
              />
            )}
          </section>
        </main>
      </SwipeMonth>

      <FabAddButton
        householdId={householdId}
        walletId={activeWalletId}
        categories={categories ?? []}
        defaultDate={defaultDate}
      />
    </>
  );
}
