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
  income: number;
  expenses: number;
  balance: number;
  paidIn: number;
  paidOut: number;
  actual: number;
  opening: number;
  closing: number;
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
  const expenses = [...expenseCategoryIds].reduce(
    (sum, categoryId) => sum + categoryContribution(transactions, budgets, categoryId),
    0
  );

  const balance = income - expenses;

  const paidIn = transactions
    .filter((t) => t.kind === "income" && t.is_paid)
    .reduce((s, t) => s + t.amount_cents, 0);
  const paidOut = transactions
    .filter((t) => t.kind === "expense" && t.is_paid)
    .reduce((s, t) => s + t.amount_cents, 0);
  const actual = paidIn - paidOut;

  return {
    income,
    expenses,
    balance,
    paidIn,
    paidOut,
    actual,
    opening: openingCents,
    closing: openingCents + actual,
  };
}
