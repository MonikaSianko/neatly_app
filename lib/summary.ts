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
