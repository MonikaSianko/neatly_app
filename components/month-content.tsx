import { MonthTabs } from "@/components/month-tabs";
import { TransactionGroupList, type TxGroup, type TxRow } from "@/components/transaction-group-list";
import type { EditingRule, EditingSplitPart } from "@/components/transaction-form";
import { UpcomingTable } from "@/components/upcoming-table";
import { BudgetTiles, type BudgetRow } from "@/components/budget-tiles";
import { OpeningBalance } from "@/components/opening-balance";
import { SummaryCard } from "@/components/summary-card";
import { createClient } from "@/lib/supabase/server";
import { monthRange, isoToday, type YearMonth } from "@/lib/month";
import { computeSummary, categorySpent } from "@/lib/summary";
import { ensureMonthMaterialized, settleAutomaticPayments } from "@/lib/materialize";
import { t as translate, type Locale } from "@/lib/i18n";

type Category = {
  id: string;
  name: string;
  name_en: string | null;
  emoji: string;
  color: string;
  kind: "expense" | "income";
  position: number;
  is_archived: boolean;
};

/**
 * Wszystko, co zalezy od wybranego portfela i miesiaca. Trzymane w osobnym komponencie,
 * zeby strona mogla owinac je w <Suspense> — naglowek zostaje na ekranie, a tresc
 * pokazuje szkielet zamiast blokowac nawigacje do czasu odpowiedzi bazy.
 */
export async function MonthContent({
  householdId,
  walletId,
  ym,
  locale,
  categories,
  activeTab,
}: {
  householdId: string;
  walletId: string;
  ym: YearMonth;
  locale: Locale;
  categories: Category[];
  activeTab: "upcoming" | "expense" | "income";
}) {
  const supabase = await createClient();
  const dict = translate(locale);
  const range = monthRange(ym);
  const monthDate = `${range.from.slice(0, 7)}-01`;
  const today = isoToday();

  if (walletId) {
    await ensureMonthMaterialized(supabase, householdId, walletId, ym);
  }
  // Po materializacji, zeby swiezo utworzone wystapienia tez sie rozliczyly.
  await settleAutomaticPayments(supabase, householdId, today);

  const [{ data: transactions }, { data: budgets }, { data: opening }, { data: recurringRules }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, kind, title, amount_cents, category_id, date, is_paid, created_at, recurring_rule_id, payment_url, grace_days, note, is_automatic, split_group_id, split_label, is_refund, refund_of_id"
      )
      .eq("household_id", householdId)
      .eq("wallet_id", walletId)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("category_budgets")
      .select("id, category_id, amount_cents")
      .eq("household_id", householdId)
      .eq("wallet_id", walletId)
      .eq("month", monthDate),
    supabase
      .from("month_openings")
      .select("amount_cents")
      .eq("household_id", householdId)
      .eq("wallet_id", walletId)
      .eq("month", monthDate)
      .maybeSingle(),
    supabase
      .from("recurring_rules")
      .select("id, freq, interval, weekdays, until_date")
      .eq("household_id", householdId)
      .eq("wallet_id", walletId),
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
    monthTx.map((t) => ({
      kind: t.kind,
      amount_cents: t.amount_cents,
      is_paid: t.is_paid,
      category_id: t.category_id,
      is_refund: t.is_refund,
    })),
    monthBudgets.map((b) => ({ category_id: b.category_id, amount_cents: b.amount_cents })),
    openingCents
  );

  const budgetRows: BudgetRow[] = monthBudgets.map((b) => ({
    id: b.id,
    categoryId: b.category_id,
    limitCents: b.amount_cents,
    spentCents: categorySpent(monthTx, b.category_id),
  }));

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  /**
   * Zwrot siedzi w kategorii wydatku, wiec pokazuje sie przy nim — w Wydatkach, nie w Przychodach,
   * i to ze znakiem minus, zeby suma kategorii byla tym, co naprawde na nia poszlo.
   */
  const belongsTo = (x: { kind: string; is_refund: boolean }, kind: "expense" | "income") =>
    kind === "expense" ? x.kind === "expense" || x.is_refund : x.kind === "income" && !x.is_refund;
  const signedAmount = (x: { amount_cents: number; is_refund: boolean }) =>
    x.is_refund ? -x.amount_cents : x.amount_cents;

  const groupsFor = (kind: "expense" | "income"): TxGroup[] => {
    const map = new Map<string, TxRow[]>();
    monthTx
      .filter((x) => belongsTo(x, kind))
      .forEach((x) => {
        const list = map.get(x.category_id) ?? [];
        list.push(x);
        map.set(x.category_id, list);
      });
    return [...map.entries()]
      .map(([categoryId, items]) => {
        const cat = categoryById.get(categoryId);
        return {
          category: cat
            ? { id: cat.id, name: cat.name, name_en: cat.name_en, emoji: cat.emoji, color: cat.color }
            : null,
          items: items.sort((a, b) => a.date.localeCompare(b.date)),
          sum: items.reduce((s, x) => s + signedAmount(x), 0),
        };
      })
      .sort(
        (a, b) =>
          (categoryById.get(a.category?.id ?? "")?.position ?? 0) -
          (categoryById.get(b.category?.id ?? "")?.position ?? 0)
      );
  };

  /**
   * Tytuly zwracanych platnosci, zeby zwrot mowil, czego dotyczy ("Ramenownia — Asia zwrot").
   * Zwrot czesto przychodzi w innym miesiacu niz zakup, wiec brakujace tytuly dociagamy po id.
   */
  const refundParents: Record<string, string> = {};
  const parentIds = [...new Set(monthTx.map((x) => x.refund_of_id).filter((id): id is string => !!id))];
  if (parentIds.length > 0) {
    const inMonth = new Map(monthTx.map((x) => [x.id, x.title]));
    const missing = parentIds.filter((id) => !inMonth.has(id));
    const { data: parents } = missing.length
      ? await supabase.from("transactions").select("id, title").in("id", missing)
      : { data: [] };
    for (const id of parentIds) {
      const title = inMonth.get(id) ?? parents?.find((x) => x.id === id)?.title;
      if (title) refundParents[id] = title;
    }
  }

  const defaultDate = ym.y === Number(today.slice(0, 4)) && ym.m === Number(today.slice(5, 7)) ? today : range.from;
  const expenseCategories = categories.filter((c) => c.kind === "expense" && !c.is_archived);
  // Zakladka Platnosci pokazuje caly miesiac; podzial na oplacone/nieoplacone i sortowanie robi klient.
  const paymentRows = monthTx;

  // Czesci platnosci dzielonych, zeby edycja z widoku kategorii otwierala cala platnosc.
  const splitGroups: Record<string, { total: number; parts: EditingSplitPart[] }> = {};
  for (const tx of monthTx) {
    if (!tx.split_group_id) continue;
    const group = (splitGroups[tx.split_group_id] ??= { total: 0, parts: [] });
    group.total += tx.amount_cents;
    group.parts.push({
      id: tx.id,
      categoryId: tx.category_id,
      amountCents: tx.amount_cents,
      label: tx.split_label,
    });
  }

  return (
    <>
      {/* Prawa kolumna na mobile jest u góry */}
      <aside className="order-1 flex flex-col gap-4 xl:order-2">
        <SummaryCard
          summary={summary}
          opening={
            <OpeningBalance householdId={householdId} walletId={walletId} ym={ym} openingCents={openingCents} />
          }
        />

        <BudgetTiles
          householdId={householdId}
          walletId={walletId}
          ym={ym}
          categories={expenseCategories}
          rows={budgetRows}
        />
      </aside>

      {/* Lewa kolumna: zakładki */}
      <section className="order-2 flex flex-col gap-3 xl:order-1">
        <MonthTabs
          initialTab={activeTab}
          labels={{ upcoming: dict.upcoming, expense: dict.expenses, income: dict.income }}
          panels={{
            upcoming: (
              <UpcomingTable
                rows={paymentRows}
                refundParents={refundParents}
                categories={categories}
                householdId={householdId}
                walletId={walletId}
                rules={rulesMap}
                today={today}
                defaultDate={defaultDate}
              />
            ),
            expense: (
              <TransactionGroupList
                groups={groupsFor("expense")}
                refundParents={refundParents}
                householdId={householdId}
                walletId={walletId}
                categories={categories}
                rules={rulesMap}
                splitGroups={splitGroups}
                today={today}
                defaultDate={defaultDate}
              />
            ),
            income: (
              <TransactionGroupList
                groups={groupsFor("income")}
                refundParents={refundParents}
                householdId={householdId}
                walletId={walletId}
                categories={categories}
                rules={rulesMap}
                splitGroups={splitGroups}
                today={today}
                defaultDate={defaultDate}
              />
            ),
          }}
        />
      </section>
    </>
  );
}
