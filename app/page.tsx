import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { SwipeMonth } from "@/components/swipe-month";
import { TransactionGroupList, type TxGroup, type TxRow } from "@/components/transaction-group-list";
import { FabAddButton } from "@/components/fab-add-button";
import { createClient } from "@/lib/supabase/server";
import { parseMonthParam, monthRange, isoToday } from "@/lib/month";
import { money } from "@/lib/format";

const TABS = [
  { key: "upcoming", label: "Nadchodzące" },
  { key: "expense", label: "Wydatki" },
  { key: "income", label: "Przychody" },
] as const;

const BUDGET_TILES = [
  { emoji: "🛒", name: "Zakupy spożywcze", color: "var(--neatly-cat-01)", spent: 1240, limit: 2500 },
  { emoji: "🚗", name: "Samochód", color: "var(--neatly-cat-16)", spent: 640, limit: 500 },
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
  const activeTab = (["upcoming", "expense", "income"] as const).includes(params.tab as never)
    ? (params.tab as "upcoming" | "expense" | "income")
    : "expense";

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, kind, title, amount_cents, category_id, date, is_paid, recurring_rule_id")
    .eq("household_id", householdId)
    .eq("wallet_id", activeWalletId)
    .gte("date", range.from)
    .lte("date", range.to);

  const monthTx = transactions ?? [];
  const income = monthTx.filter((x) => x.kind === "income").reduce((s, x) => s + x.amount_cents, 0);
  const expenses = monthTx.filter((x) => x.kind === "expense").reduce((s, x) => s + x.amount_cents, 0);
  const balance = income - expenses;
  const paidIn = monthTx.filter((x) => x.kind === "income" && x.is_paid).reduce((s, x) => s + x.amount_cents, 0);
  const paidOut = monthTx.filter((x) => x.kind === "expense" && x.is_paid).reduce((s, x) => s + x.amount_cents, 0);
  const actual = paidIn - paidOut;

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
                <span className="text-muted-foreground">Stan początkowy</span>
                <span className="tabular font-medium">{money(0)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">Przychody</div>
                  <div className="tabular text-[18px] font-semibold">{money(income)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Wydatki</div>
                  <div className="tabular text-[18px] font-semibold">{money(expenses)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Balans miesiąca</div>
                  <div className="tabular text-[18px] font-semibold" style={{ color: "var(--neatly-primary-dark)" }}>
                    {money(balance)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Faktyczny balans</div>
                  <div className="tabular text-[18px] font-semibold">{money(actual)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Stan konta na koniec miesiąca</span>
                <span className="tabular font-semibold">{money(actual)}</span>
              </div>
            </section>

            <section className="rounded-[14px] border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Budżety wydatków</h2>
                <button type="button" className="rounded-[10px] border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                  Ustaw budżet
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {BUDGET_TILES.map((tile) => {
                  const pct = Math.min(100, Math.round((tile.spent / tile.limit) * 100));
                  const over = tile.spent > tile.limit;
                  return (
                    <div key={tile.name} className="rounded-[10px] border border-border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span aria-hidden>{tile.emoji}</span>
                          {tile.name}
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {tile.spent.toLocaleString("pl-PL")} / {tile.limit.toLocaleString("pl-PL")} zł
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full" style={{ background: "var(--neatly-primary-soft)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: tile.color }} />
                      </div>
                      <div className="mt-1 text-[11px]" style={{ color: over ? "var(--destructive)" : "var(--muted-foreground)" }}>
                        {over
                          ? `Przekroczono o ${(tile.spent - tile.limit).toLocaleString("pl-PL")} zł`
                          : `Zostało ${(tile.limit - tile.spent).toLocaleString("pl-PL")} zł`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
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
