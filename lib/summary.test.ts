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
    expect(under.expenses).toBe(250000);

    const over = computeSummary(
      [{ kind: "expense", amount_cents: 270000, is_paid: false, category_id: groceries }],
      budgets,
      0
    );
    expect(over.expenses).toBe(270000);
  });

  it("checking 'paid' changes the actual balance and closing, never the planned balance", () => {
    const tx = [
      { kind: "income" as const, amount_cents: 100000, is_paid: false, category_id: salary },
      { kind: "expense" as const, amount_cents: 40000, is_paid: false, category_id: groceries },
    ];
    const before = computeSummary(tx, [], 0);
    expect(before.balance).toBe(60000);
    expect(before.actual).toBe(0);

    const paidTx = tx.map((t) => ({ ...t, is_paid: true }));
    const after = computeSummary(paidTx, [], 0);
    expect(after.balance).toBe(60000);
    expect(after.actual).toBe(60000);
    expect(after.closing).toBe(60000);
  });

  it("closing balance = opening + actual balance", () => {
    const tx = [{ kind: "income" as const, amount_cents: 50000, is_paid: true, category_id: salary }];
    const summary = computeSummary(tx, [], 100000);
    expect(summary.closing).toBe(150000);
  });

  it("a surplus in one month never leaks into another (opening defaults to 0)", () => {
    const septemberLeftover = computeSummary(
      [{ kind: "income", amount_cents: 500000, is_paid: true, category_id: salary }],
      [],
      0
    );
    expect(septemberLeftover.closing).toBe(500000);

    const october = computeSummary([], [], 0);
    expect(october.closing).toBe(0);
  });
});
