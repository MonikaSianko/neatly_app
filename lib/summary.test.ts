import { describe, expect, it } from "vitest";
import { computeSummary, categoryContribution } from "./summary";

const groceries = "cat-groceries";
const car = "cat-car";
const salary = "cat-salary";

describe("categoryContribution", () => {
  it("uses the budget when spending is under it", () => {
    const tx = [{ kind: "expense" as const, amount_cents: 30000, is_paid: false, category_id: groceries }];
    const budgets = [{ category_id: groceries, amount_cents: 250000 }];
    expect(categoryContribution(tx, budgets, groceries)).toBe(250000);
  });

  it("uses actual spend when it exceeds the budget", () => {
    const tx = [{ kind: "expense" as const, amount_cents: 270000, is_paid: false, category_id: car }];
    const budgets = [{ category_id: car, amount_cents: 50000 }];
    expect(categoryContribution(tx, budgets, car)).toBe(270000);
  });

  it("falls back to plain spend with no budget set", () => {
    const tx = [{ kind: "expense" as const, amount_cents: 5000, is_paid: false, category_id: groceries }];
    expect(categoryContribution(tx, [], groceries)).toBe(5000);
  });

  it("never sums budget and spend for the same category", () => {
    const tx = [{ kind: "expense" as const, amount_cents: 30000, is_paid: false, category_id: groceries }];
    const budgets = [{ category_id: groceries, amount_cents: 250000 }];
    const contribution = categoryContribution(tx, budgets, groceries);
    expect(contribution).not.toBe(30000 + 250000);
  });
});

describe("computeSummary", () => {
  it("matches spec acceptance criteria 3 and 4", () => {
    const budgets = [{ category_id: groceries, amount_cents: 250000 }];

    const under = computeSummary(
      [{ kind: "expense", amount_cents: 30000, is_paid: false, category_id: groceries }],
      budgets,
      0
    );
    expect(under.plannedExpenses).toBe(250000);

    const over = computeSummary(
      [{ kind: "expense", amount_cents: 270000, is_paid: false, category_id: groceries }],
      budgets,
      0
    );
    expect(over.plannedExpenses).toBe(270000);
  });

  it("checking 'paid' changes the account balance, never the planned balance", () => {
    const tx = [
      { kind: "income" as const, amount_cents: 100000, is_paid: false, category_id: salary },
      { kind: "expense" as const, amount_cents: 40000, is_paid: false, category_id: groceries },
    ];
    const before = computeSummary(tx, [], 0);
    expect(before.balanceWithBudgets).toBe(60000);
    expect(before.accountBalance).toBe(0);

    const paidTx = tx.map((t) => ({ ...t, is_paid: true }));
    const after = computeSummary(paidTx, [], 0);
    expect(after.balanceWithBudgets).toBe(60000);
    expect(after.accountBalance).toBe(60000);
  });

  it("account balance = opening + what actually moved", () => {
    const tx = [{ kind: "income" as const, amount_cents: 50000, is_paid: true, category_id: salary }];
    const summary = computeSummary(tx, [], 100000);
    expect(summary.accountBalance).toBe(150000);
  });

  it("a surplus in one month never leaks into another (opening defaults to 0)", () => {
    const septemberLeftover = computeSummary(
      [{ kind: "income", amount_cents: 500000, is_paid: true, category_id: salary }],
      [],
      0
    );
    expect(septemberLeftover.accountBalance).toBe(500000);

    const october = computeSummary([], [], 0);
    expect(october.accountBalance).toBe(0);
  });

  it("balanceNow ignores the budget reservation, balanceWithBudgets keeps it", () => {
    const tx = [
      { kind: "income" as const, amount_cents: 300000, is_paid: true, category_id: salary },
      { kind: "expense" as const, amount_cents: 30000, is_paid: true, category_id: groceries },
      { kind: "expense" as const, amount_cents: 20000, is_paid: false, category_id: car },
    ];
    const budgets = [{ category_id: groceries, amount_cents: 250000 }];
    const summary = computeSummary(tx, budgets, 0);

    // Plan rezerwuje caly budzet na zakupy: 250000 + 20000 na auto.
    expect(summary.plannedExpenses).toBe(270000);
    expect(summary.balanceWithBudgets).toBe(30000);

    // Na teraz licza sie tylko realne pozycje: 30000 + 20000.
    expect(summary.actualExpenses).toBe(50000);
    expect(summary.balanceNow).toBe(250000);

    // Stan konta widzi wylacznie to, co juz zaplacone.
    expect(summary.accountBalance).toBe(270000);
  });
});
