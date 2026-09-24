import { CategoryDonut, type DonutSlice } from "@/components/category-donut";
import { createClient } from "@/lib/supabase/server";
import { monthRange, isoToday, type YearMonth } from "@/lib/month";
import { computeSummary, sumSummaries, categoryTotals } from "@/lib/summary";
import { ensureMonthMaterialized, settleAutomaticPayments } from "@/lib/materialize";
import { money } from "@/lib/format";
import { t as translate, categoryDisplayName, type Locale } from "@/lib/i18n";

type Category = { id: string; name: string; name_en: string | null; emoji: string; color: string };
type Wallet = { id: string; name: string; emoji: string | null };

/** Ile kategorii pokazuje wykres, zanim reszta zejdzie do jednego wiersza "Pozostałe". */
const TOP_CATEGORIES = 8;
const REST_COLOR = "var(--muted-foreground)";

/**
 * Podsumowanie miesiaca ponad portfelami. Osobny komponent, zeby strona mogla owinac go
 * w <Suspense> — tak samo jak tresc pojedynczego miesiaca.
 */
export async function SummaryContent({
  householdId,
  wallets,
  categories,
  ym,
  locale,
}: {
  householdId: string;
  wallets: Wallet[];
  categories: Category[];
  ym: YearMonth;
  locale: Locale;
}) {
  const supabase = await createClient();
  const t = translate(locale);
  const range = monthRange(ym);
  const monthDate = `${range.from.slice(0, 7)}-01`;
  const today = isoToday();

  // Raty cykliczne dolicza sie per portfel przy wejsciu na jego miesiac. Tutaj patrzymy na
  // wszystkie naraz, wiec materializujemy kazdy — inaczej portfel, ktorego nikt w tym miesiacu
  // nie otworzyl, pokazalby za malo.
  await Promise.all(wallets.map((w) => ensureMonthMaterialized(supabase, householdId, w.id, ym)));
  await settleAutomaticPayments(supabase, householdId, today);

  const walletIds = wallets.map((w) => w.id);
  const [{ data: transactions }, { data: budgets }, { data: openings }] = await Promise.all([
    supabase
      .from("transactions")
      .select("wallet_id, kind, amount_cents, category_id, is_paid, is_refund")
      .eq("household_id", householdId)
      .in("wallet_id", walletIds)
      .gte("date", range.from)
      .lte("date", range.to),
    supabase
      .from("category_budgets")
      .select("wallet_id, category_id, amount_cents")
      .eq("household_id", householdId)
      .in("wallet_id", walletIds)
      .eq("month", monthDate),
    supabase
      .from("month_openings")
      .select("wallet_id, amount_cents")
      .eq("household_id", householdId)
      .in("wallet_id", walletIds)
      .eq("month", monthDate),
  ]);

  const monthTx = transactions ?? [];
  const monthBudgets = budgets ?? [];

  const perWallet = wallets.map((wallet) => ({
    wallet,
    summary: computeSummary(
      monthTx.filter((x) => x.wallet_id === wallet.id),
      monthBudgets.filter((b) => b.wallet_id === wallet.id),
      openings?.find((o) => o.wallet_id === wallet.id)?.amount_cents ?? 0
    ),
  }));

  const total = sumSummaries(perWallet.map((p) => p.summary));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const totals = categoryTotals(monthTx, monthBudgets).filter((row) => categoryById.has(row.categoryId));
  const top = totals.slice(0, TOP_CATEGORIES);
  const rest = totals.slice(TOP_CATEGORIES);
  const restSpent = rest.reduce((sum, row) => sum + row.spent, 0);
  // Kategoria na minusie (zwroty wieksze od wydatkow) nie ma wycinka, ale zostaje na liscie
  // ze swoja prawdziwa kwota — udzial liczymy z tego, co naprawde wyszlo z domu.
  const chartTotal = totals.reduce((sum, row) => sum + Math.max(0, row.spent), 0);

  const nameOf = (id: string) => {
    const cat = categoryById.get(id);
    return cat ? categoryDisplayName(cat.name, locale, cat.name_en) : "";
  };
  const percent = (value: number) => {
    const share = chartTotal > 0 ? (Math.max(0, value) / chartTotal) * 100 : 0;
    return `${share.toFixed(1).replace(".", ",")}%`;
  };

  const slices: DonutSlice[] = [
    ...top
      .filter((row) => row.spent > 0)
      .map((row) => ({
        id: row.categoryId,
        label: nameOf(row.categoryId),
        value: row.spent,
        color: categoryById.get(row.categoryId)?.color ?? REST_COLOR,
      })),
    ...(restSpent > 0 ? [{ id: "rest", label: t.otherCategories, value: restSpent, color: REST_COLOR }] : []),
  ];

  if (monthTx.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-8 text-center text-base text-muted-foreground">
        {t.summaryEmpty}
      </div>
    );
  }

  const paidShare = total.plannedExpenses > 0 ? Math.min(100, (total.paidOut / total.plannedExpenses) * 100) : 0;

  return (
    <>
      {/* Na telefonie kwoty ida na gore, na szerokim ekranie w prawa kolumne — jak w budzecie portfela. */}
      <aside className="order-1 xl:order-2">
        <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-base font-medium">{t.monthAmounts}</h2>

          <div className="rounded-[10px] p-4" style={{ background: "var(--neatly-primary-soft)" }}>
            <div className="text-xs" style={{ color: "var(--neatly-primary-dark)" }}>
              {t.accountBalance}
            </div>
            <div className="tabular text-3xl font-semibold tracking-tight">{money(total.accountBalance, locale)}</div>
            <div className="tabular mt-1 text-xs" style={{ color: "var(--neatly-primary-dark)" }}>
              {money(total.opening, locale)} {t.openingShort} · {money(total.paidIn - total.paidOut, locale)}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-1">
            <Amount label={t.income} hint={t.incomePlanned} value={money(total.income, locale)} tone="success" />
            <Amount label={t.plannedExpenses} hint={t.withBudgetLimits} value={money(total.plannedExpenses, locale)} />
            <Amount
              label={t.balanceWithBudgets}
              hint={t.incomeMinusExpenses}
              value={money(total.balanceWithBudgets, locale)}
              tone={total.balanceWithBudgets < 0 ? "danger" : "success"}
            />
            <Amount
              label={t.balanceNow}
              hint={t.paidOnly}
              value={money(total.balanceNow, locale)}
              tone={total.balanceNow < 0 ? "danger" : "success"}
            />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex-1 text-xs text-muted-foreground">{t.paidThisMonth}</span>
              <span className="tabular text-xs font-medium">{Math.round(paidShare)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-1.5 rounded-full" style={{ width: `${paidShare}%`, background: "var(--primary)" }} />
            </div>
            <div className="tabular mt-2 text-xs text-muted-foreground">
              {money(total.paidOut, locale)} / {money(total.plannedExpenses, locale)}
            </div>
          </div>
        </section>
      </aside>

      <div className="order-2 flex flex-col gap-4 xl:order-1">
        <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="text-base font-medium">{t.expensesByCategory}</h2>
            {rest.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {t.topOf} {totals.length} {t.categoriesOf}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
            <CategoryDonut
              slices={slices}
              label={`${t.expensesByCategory}: ${slices
                .map((s) => `${s.label} ${money(s.value, locale)}`)
                .join(", ")}`}
              centerLabel={t.plannedExpenses}
              centerValue={money(total.plannedExpenses, locale)}
              centerHint={`${totals.length} ${t.categoriesOf}`}
            />

            <ul className="flex w-full min-w-0 flex-col gap-3.5">
              {top.map((row) => {
                const cat = categoryById.get(row.categoryId);
                const over = row.budget > 0 && row.spent > row.budget;
                const used = row.budget > 0 ? Math.max(0, Math.min(100, (row.spent / row.budget) * 100)) : 0;
                return (
                  <li key={row.categoryId} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden className="w-5 shrink-0 text-center">
                        {cat?.emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-base font-medium">{nameOf(row.categoryId)}</span>
                      <span className="tabular shrink-0 text-base font-medium">{money(row.spent, locale)}</span>
                      <span className="tabular w-14 shrink-0 text-right text-sm text-muted-foreground">
                        {percent(row.spent)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="w-5 shrink-0" />
                      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-muted">
                        {row.budget > 0 && (
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${used}%`, background: over ? "var(--destructive)" : cat?.color }}
                          />
                        )}
                      </div>
                      <span
                        className="tabular shrink-0 text-xs"
                        style={{ color: over ? "var(--destructive)" : "var(--muted-foreground)" }}
                      >
                        {row.budget === 0
                          ? t.noLimit
                          : over
                            ? `${t.overByShort} ${money(row.spent - row.budget, locale)}`
                            : `${money(row.spent, locale)} / ${money(row.budget, locale)}`}
                      </span>
                    </div>
                  </li>
                );
              })}

              {rest.length > 0 && (
                <li className="flex flex-col gap-1.5 border-t border-border pt-3">
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="flex w-5 shrink-0 justify-center">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: REST_COLOR }} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-muted-foreground">
                      {t.otherCategories} ({rest.length})
                    </span>
                    <span className="tabular shrink-0 text-base font-medium text-muted-foreground">
                      {money(restSpent, locale)}
                    </span>
                    <span className="tabular w-14 shrink-0 text-right text-sm text-muted-foreground">
                      {percent(restSpent)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {rest.map((row) => nameOf(row.categoryId)).join(", ")}
                    </span>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </section>

        {wallets.length > 1 && (
          <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-4 text-base font-medium">{t.walletBreakdown}</h2>

            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-border pb-2.5 text-xs text-muted-foreground sm:grid">
              <span>{t.wallet}</span>
              <span className="text-right">{t.expenses}</span>
              <span className="text-right">{t.income}</span>
              <span className="text-right">{t.balanceNow}</span>
            </div>

            {perWallet.map(({ wallet, summary }) => (
              <div
                key={wallet.id}
                className="flex flex-col gap-1 border-b border-border py-3 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2 text-base font-medium">
                  <span aria-hidden className="shrink-0">
                    {wallet.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{wallet.name}</span>
                  <Balance value={summary.balanceNow} locale={locale} className="tabular shrink-0 sm:hidden" />
                </span>

                {/* Na telefonie obie kwoty mieszcza sie w jednej linii pod nazwa portfela. */}
                <span className="tabular text-sm text-muted-foreground sm:hidden">
                  {t.expenses}: {money(summary.actualExpenses, locale)} · {t.income}:{" "}
                  {money(summary.income, locale)}
                </span>

                <span className="tabular hidden text-right text-base sm:block">
                  {money(summary.actualExpenses, locale)}
                </span>
                <span className="tabular hidden text-right text-base sm:block">{money(summary.income, locale)}</span>
                <Balance
                  value={summary.balanceNow}
                  locale={locale}
                  className="tabular hidden text-right text-base font-medium sm:block"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <span className="text-base font-semibold">{t.grandTotal}</span>
              <span className="tabular hidden text-right text-base font-semibold sm:block">
                {money(total.actualExpenses, locale)}
              </span>
              <span className="tabular hidden text-right text-base font-semibold sm:block">
                {money(total.income, locale)}
              </span>
              <Balance
                value={total.balanceNow}
                locale={locale}
                className="tabular text-right text-base font-semibold"
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** Kwota z podpisem i drobnym wyjasnieniem — na telefonie w siatce, w kolumnie bocznej w rzedzie. */
function Amount({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const color = tone === "success" ? "var(--neatly-success)" : tone === "danger" ? "var(--destructive)" : undefined;
  return (
    <div className="xl:flex xl:items-baseline xl:gap-3">
      <div className="min-w-0 xl:flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground opacity-70">{hint}</div>
      </div>
      <div className="tabular text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Balance({ value, locale, className }: { value: number; locale: Locale; className: string }) {
  return (
    <span className={className} style={{ color: value < 0 ? "var(--destructive)" : "var(--neatly-success)" }}>
      {money(value, locale)}
    </span>
  );
}
