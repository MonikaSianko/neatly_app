import { CategoryDonut, type DonutSlice } from "@/components/category-donut";
import { createClient } from "@/lib/supabase/server";
import { monthRange, isoToday, type YearMonth } from "@/lib/month";
import { computeSummary, sumSummaries, categoryTotals, incomeByCategory } from "@/lib/summary";
import { ensureMonthMaterialized, settleAutomaticPayments } from "@/lib/materialize";
import { money } from "@/lib/format";
import { t as translate, categoryDisplayName, type Locale, type Dict } from "@/lib/i18n";

type Category = { id: string; name: string; name_en: string | null; emoji: string; color: string };
type Wallet = { id: string; name: string; emoji: string | null };

/** Wiersz listy kategorii — wspolny ksztalt dla wydatkow i przychodow. */
type CategoryRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  amount: number;
  /** Suma limitow ze wszystkich portfeli; 0 = kategoria bez budzetu (przychody nie maja go nigdy). */
  budget: number;
};

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

  const toRow = (categoryId: string, amount: number, budget: number): CategoryRow | null => {
    const cat = categoryById.get(categoryId);
    if (!cat) return null;
    return {
      id: cat.id,
      name: categoryDisplayName(cat.name, locale, cat.name_en),
      emoji: cat.emoji,
      color: cat.color,
      amount,
      budget,
    };
  };

  const expenseRows = categoryTotals(monthTx, monthBudgets)
    .map((row) => toRow(row.categoryId, row.spent, row.budget))
    .filter((row): row is CategoryRow => row !== null);

  const incomeRows = incomeByCategory(monthTx)
    .map((row) => toRow(row.categoryId, row.amount, 0))
    .filter((row): row is CategoryRow => row !== null);

  if (monthTx.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-8 text-center text-base text-muted-foreground">
        {t.summaryEmpty}
      </div>
    );
  }

  // Pasek postepu porownuje oplacone z tym, co naprawde wpisano — nie z planem, bo plan
  // zawiera jeszcze nietkniete limity budzetow i nigdy nie doszedlby do stu procent.
  const paidShare = total.actualExpenses > 0 ? Math.min(100, (total.paidOut / total.actualExpenses) * 100) : 0;

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

          {/* Tylko fakty: pozycje, ktore juz przeszly przez konto. Plan miesiaca stoi
              przy kategoriach, gdzie porownuje sie go z limitami. */}
          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-1">
            <Amount label={t.income} hint={t.receivedHint} value={money(total.paidIn, locale)} tone="success" />
            <Amount label={t.expenses} hint={t.paidItemsHint} value={money(total.paidOut, locale)} />
            <Amount
              label={t.balanceNow}
              hint={t.flowHint}
              value={money(total.paidIn - total.paidOut, locale)}
              tone={total.paidIn - total.paidOut < 0 ? "danger" : "success"}
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
              {money(total.paidOut, locale)} / {money(total.actualExpenses, locale)}
            </div>
          </div>
        </section>
      </aside>

      <div className="order-2 flex flex-col gap-4 xl:order-1">
        <CategorySection
          title={t.expensesByCategory}
          centerLabel={t.expenses}
          rows={expenseRows}
          locale={locale}
          t={t}
          withBudgets
        />

        {incomeRows.length > 0 && (
          <CategorySection
            title={t.incomeByCategory}
            centerLabel={t.income}
            rows={incomeRows}
            locale={locale}
            t={t}
          />
        )}

        {wallets.length > 1 && (
          <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-4 text-base font-medium">{t.walletBreakdown}</h2>

            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-border pb-2.5 text-xs text-muted-foreground sm:grid">
              <span>{t.wallet}</span>
              <span className="text-right">{t.expenses}</span>
              <span className="text-right">{t.income}</span>
              <span className="text-right">{t.balanceNow}</span>
            </div>

            {perWallet.map(({ wallet, summary }) => {
              const flow = summary.paidIn - summary.paidOut;
              return (
                <div
                  key={wallet.id}
                  className="flex flex-col gap-1 border-b border-border py-3 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center sm:gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-base font-medium">
                    <span aria-hidden className="shrink-0">
                      {wallet.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{wallet.name}</span>
                    <Balance value={flow} locale={locale} className="tabular shrink-0 sm:hidden" />
                  </span>

                  {/* Na telefonie obie kwoty mieszcza sie w jednej linii pod nazwa portfela. */}
                  <span className="tabular text-sm text-muted-foreground sm:hidden">
                    {t.expenses}: {money(summary.paidOut, locale)} · {t.income}: {money(summary.paidIn, locale)}
                  </span>

                  <span className="tabular hidden text-right text-base sm:block">
                    {money(summary.paidOut, locale)}
                  </span>
                  <span className="tabular hidden text-right text-base sm:block">
                    {money(summary.paidIn, locale)}
                  </span>
                  <Balance value={flow} locale={locale} className="tabular hidden text-right text-base font-medium sm:block" />
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <span className="text-base font-semibold">{t.grandTotal}</span>
              <span className="tabular hidden text-right text-base font-semibold sm:block">
                {money(total.paidOut, locale)}
              </span>
              <span className="tabular hidden text-right text-base font-semibold sm:block">
                {money(total.paidIn, locale)}
              </span>
              <Balance
                value={total.paidIn - total.paidOut}
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

/**
 * Pierscien i pelna lista kategorii. Wszystkie kategorie z pozycjami wchodza na liste
 * w calosci — zamiast wiersza zbiorczego lista ma wlasne przewijanie, zeby dwadziescia
 * kategorii nie rozpychalo strony.
 */
function CategorySection({
  title,
  centerLabel,
  rows,
  locale,
  t,
  withBudgets = false,
}: {
  title: string;
  centerLabel: string;
  rows: CategoryRow[];
  locale: Locale;
  t: Dict;
  withBudgets?: boolean;
}) {
  // Kategoria na minusie (zwroty wieksze od wydatkow) nie ma wycinka, ale zostaje na liscie
  // ze swoja prawdziwa kwota — udzial liczymy z tego, co naprawde wyszlo z domu.
  const chartTotal = rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const slices: DonutSlice[] = rows
    .filter((row) => row.amount > 0)
    .map((row) => ({ id: row.id, label: row.name, value: row.amount, color: row.color }));

  const percent = (value: number) => {
    const share = chartTotal > 0 ? (Math.max(0, value) / chartTotal) * 100 : 0;
    return `${share.toFixed(1).replace(".", ",")}%`;
  };

  return (
    <section className="rounded-[14px] border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-base font-medium">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {rows.length} {t.categoriesOf}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
        <CategoryDonut
          slices={slices}
          label={`${title}: ${slices.map((s) => `${s.label} ${money(s.value, locale)}`).join(", ")}`}
          centerLabel={centerLabel}
          centerValue={money(chartTotal, locale)}
          centerHint={`${rows.length} ${t.categoriesOf}`}
        />

        <ul className="flex max-h-80 w-full min-w-0 flex-col gap-3.5 overflow-y-auto overscroll-contain pr-1">
          {rows.map((row) => {
            const over = row.budget > 0 && row.amount > row.budget;
            const used = row.budget > 0 ? Math.max(0, Math.min(100, (row.amount / row.budget) * 100)) : 0;
            return (
              <li key={row.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="w-5 shrink-0 text-center">
                    {row.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-medium">{row.name}</span>
                  <span className="tabular shrink-0 text-base font-medium">{money(row.amount, locale)}</span>
                  <span className="tabular w-14 shrink-0 text-right text-sm text-muted-foreground">
                    {percent(row.amount)}
                  </span>
                </div>

                {withBudgets && (
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0" />
                    <div className="h-1.5 min-w-0 flex-1 rounded-full bg-muted">
                      {row.budget > 0 && (
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${used}%`, background: over ? "var(--destructive)" : row.color }}
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
                          ? `${t.overByShort} ${money(row.amount - row.budget, locale)}`
                          : `${money(row.amount, locale)} / ${money(row.budget, locale)}`}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
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
