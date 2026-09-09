/**
 * Jedno miejsce liczace podsumowanie miesiaca. Wywolywane z karty
 * podsumowania i z kafelkow budzetow — musi dawac ten sam wynik.
 *
 * Model wydatkow (specyfikacja.md #4): dla kazdej kategorii wydatkowej
 * wkladC = max(budzetC, transakcjeC); Wydatki = suma wkladow.
 * Budzet i transakcje z tej samej kategorii nigdy sie nie sumuja.
 */

export type SummaryTransaction = {
  kind: "expense" | "income";
  amount_cents: number;
  is_paid: boolean;
  category_id: string;
};

export type SummaryBudget = {
  category_id: string;
  amount_cents: number;
};

export type Summary = {
  /** Wszystkie przychody miesiaca, oplacone czy nie. */
  income: number;
  /** Plan wydatkow: per kategoria wieksza z dwoch wartosci — budzet albo realne pozycje. */
  plannedExpenses: number;
  /** Realne pozycje wydatkowe, bez rezerwacji budzetowych. */
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

export function categorySpent(transactions: SummaryTransaction[], categoryId: string): number {
  return transactions
    .filter((t) => t.kind === "expense" && t.category_id === categoryId)
    .reduce((sum, t) => sum + t.amount_cents, 0);
}

export function categoryContribution(
  transactions: SummaryTransaction[],
  budgets: SummaryBudget[],
  categoryId: string
): number {
  const spent = categorySpent(transactions, categoryId);
  const budget = budgets.find((b) => b.category_id === categoryId)?.amount_cents ?? 0;
  return Math.max(budget, spent);
}

export function computeSummary(
  transactions: SummaryTransaction[],
  budgets: SummaryBudget[],
  openingCents: number
): Summary {
  const income = transactions.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount_cents, 0);

  const expenseCategoryIds = new Set<string>([
    ...transactions.filter((t) => t.kind === "expense").map((t) => t.category_id),
    ...budgets.map((b) => b.category_id),
  ]);
  const plannedExpenses = [...expenseCategoryIds].reduce(
    (sum, categoryId) => sum + categoryContribution(transactions, budgets, categoryId),
    0
  );

  const actualExpenses = transactions
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + t.amount_cents, 0);

  const paidIn = transactions
    .filter((t) => t.kind === "income" && t.is_paid)
    .reduce((s, t) => s + t.amount_cents, 0);
  const paidOut = transactions
    .filter((t) => t.kind === "expense" && t.is_paid)
    .reduce((s, t) => s + t.amount_cents, 0);

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
