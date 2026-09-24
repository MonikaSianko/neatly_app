/**
 * Jedno miejsce liczace podsumowanie miesiaca. Wywolywane z karty
 * podsumowania i z kafelkow budzetow — musi dawac ten sam wynik.
 *
 * Model wydatkow (specyfikacja.md #4): dla kazdej kategorii wydatkowej
 * wkladC = max(budzetC, transakcjeC); Wydatki = suma wkladow.
 * Budzet i transakcje z tej samej kategorii nigdy sie nie sumuja.
 *
 * Zwrot (is_refund) liczy sie wszedzie jako ujemny wydatek swojej kategorii,
 * a nie jako przychod — inaczej te same 147,00 zl raz podniosloby przychody,
 * a raz obnizylo wydatki i balans wyszedlby dwa razy.
 */

export type SummaryTransaction = {
  kind: "expense" | "income";
  amount_cents: number;
  is_paid: boolean;
  category_id: string;
  /** Przychod zwracajacy konkretny wydatek. Brak pola = zwykla pozycja. */
  is_refund?: boolean;
};

export type SummaryBudget = {
  category_id: string;
  amount_cents: number;
};

export type Summary = {
  /** Wszystkie przychody miesiaca, oplacone czy nie. Bez zwrotow — te siedza w wydatkach. */
  income: number;
  /** Plan wydatkow: per kategoria wieksza z dwoch wartosci — budzet albo realne pozycje. */
  plannedExpenses: number;
  /** Realne pozycje wydatkowe pomniejszone o zwroty, bez rezerwacji budzetowych. */
  actualExpenses: number;
  paidIn: number;
  paidOut: number;
  opening: number;
  /** Ile faktycznie jest na koncie: stan poczatkowy + to, co juz wplynelo i wyszlo. */
  accountBalance: number;
  /** Balans planu miesiaca — z rezerwacjami budzetowymi. */
  balanceWithBudgets: number;
  /** Balans na teraz: przychody minus wszystkie pozycje wydatkowe, bez roznicy budzetowej. */
  balanceNow: number;
};

const isRefund = (t: SummaryTransaction) => t.is_refund === true;
const isPlainIncome = (t: SummaryTransaction) => t.kind === "income" && !isRefund(t);
const sum = (list: SummaryTransaction[]) => list.reduce((s, t) => s + t.amount_cents, 0);

/** Ile naprawde poszlo na kategorie: wydatki minus zwroty do nich. Moze wyjsc ujemnie. */
export function categorySpent(transactions: SummaryTransaction[], categoryId: string): number {
  const inCategory = transactions.filter((t) => t.category_id === categoryId);
  return sum(inCategory.filter((t) => t.kind === "expense")) - sum(inCategory.filter(isRefund));
}

export function categoryContribution(
  transactions: SummaryTransaction[],
  budgets: SummaryBudget[],
  categoryId: string
): number {
  const spent = categorySpent(transactions, categoryId);
  const budget = budgets.find((b) => b.category_id === categoryId)?.amount_cents ?? 0;
  // Bez budzetu liczy sie sama roznica — rowniez ujemna, gdy zwroty przewyzszyly wydatki.
  return budget > 0 ? Math.max(budget, spent) : spent;
}

export function computeSummary(
  transactions: SummaryTransaction[],
  budgets: SummaryBudget[],
  openingCents: number
): Summary {
  const income = sum(transactions.filter(isPlainIncome));
  const refunds = sum(transactions.filter(isRefund));

  const expenseCategoryIds = new Set<string>([
    ...transactions.filter((t) => t.kind === "expense" || isRefund(t)).map((t) => t.category_id),
    ...budgets.map((b) => b.category_id),
  ]);
  const plannedExpenses = [...expenseCategoryIds].reduce(
    (total, categoryId) => total + categoryContribution(transactions, budgets, categoryId),
    0
  );

  const actualExpenses = sum(transactions.filter((t) => t.kind === "expense")) - refunds;

  const paidIn = sum(transactions.filter((t) => isPlainIncome(t) && t.is_paid));
  // Zwrot, ktory juz wplynal, oddaje czesc tego, co z konta zeszlo.
  const paidOut =
    sum(transactions.filter((t) => t.kind === "expense" && t.is_paid)) -
    sum(transactions.filter((t) => isRefund(t) && t.is_paid));

  return {
    income,
    plannedExpenses,
    actualExpenses,
    paidIn,
    paidOut,
    opening: openingCents,
    accountBalance: openingCents + paidIn - paidOut,
    balanceWithBudgets: income - plannedExpenses,
    balanceNow: income - actualExpenses,
  };
}

/**
 * Podsumowanie wielu portfeli. Kazda pozycja Summary jest addytywna, wiec calosc liczymy
 * jako sume podsumowan poszczegolnych portfeli — nie przez wrzucenie wszystkich transakcji
 * do jednego worka. To roznica, ktora widac w liczbach: wklad kategorii to max(budzet, wydatki),
 * a ta reguła obowiazuje w obrebie portfela. Dzieki sumowaniu ekran zbiorczy zawsze zgadza sie
 * z suma ekranow pojedynczych portfeli, a to pierwsze, co ktokolwiek sprawdzi.
 */
export function sumSummaries(parts: Summary[]): Summary {
  return parts.reduce<Summary>(
    (total, part) => ({
      income: total.income + part.income,
      plannedExpenses: total.plannedExpenses + part.plannedExpenses,
      actualExpenses: total.actualExpenses + part.actualExpenses,
      paidIn: total.paidIn + part.paidIn,
      paidOut: total.paidOut + part.paidOut,
      opening: total.opening + part.opening,
      accountBalance: total.accountBalance + part.accountBalance,
      balanceWithBudgets: total.balanceWithBudgets + part.balanceWithBudgets,
      balanceNow: total.balanceNow + part.balanceNow,
    }),
    { income: 0, plannedExpenses: 0, actualExpenses: 0, paidIn: 0, paidOut: 0, opening: 0, accountBalance: 0, balanceWithBudgets: 0, balanceNow: 0 }
  );
}

export type CategoryTotal = {
  categoryId: string;
  /** Wydatki pomniejszone o zwroty — suma ze wszystkich portfeli. */
  spent: number;
  /** Suma limitow z wszystkich portfeli; 0 = kategoria bez budzetu. */
  budget: number;
};

/**
 * Ile poszlo na kazda kategorie w calym gospodarstwie. Wydatki i limity sa addytywne miedzy
 * portfelami, wiec tu wystarczy plaska lista. Posortowane malejaco — wykres i lista czytaja
 * sie od najwiekszej pozycji.
 */
export function categoryTotals(transactions: SummaryTransaction[], budgets: SummaryBudget[]): CategoryTotal[] {
  const ids = new Set<string>([
    ...transactions.filter((t) => t.kind === "expense" || t.is_refund).map((t) => t.category_id),
    ...budgets.map((b) => b.category_id),
  ]);

  return [...ids]
    .map((categoryId) => ({
      categoryId,
      spent: categorySpent(transactions, categoryId),
      budget: budgets.filter((b) => b.category_id === categoryId).reduce((sum, b) => sum + b.amount_cents, 0),
    }))
    .filter((row) => row.spent !== 0 || row.budget > 0)
    .sort((a, b) => b.spent - a.spent);
}
