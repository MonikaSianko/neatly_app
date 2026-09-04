"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  setCategoryBudget,
  deleteCategoryBudget,
  copyBudgetsFromPreviousMonth,
} from "@/lib/actions/budgets";
import { money } from "@/lib/format";
import type { YearMonth } from "@/lib/month";

type Category = { id: string; name: string; emoji: string; color: string };
export type BudgetRow = { id: string; categoryId: string; limitCents: number; spentCents: number };

type Draft = { id: string | null; categoryId: string; amount: string };

export function BudgetTiles({
  householdId,
  walletId,
  ym,
  categories,
  rows,
}: {
  householdId: string;
  walletId: string;
  ym: YearMonth;
  categories: Category[];
  rows: BudgetRow[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const budgetedIds = new Set(rows.map((r) => r.categoryId));
  const available = categories.filter((c) => !budgetedIds.has(c.id) || c.id === edit?.categoryId);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const amountCents = Math.round(parseFloat(edit.amount.replace(/\s/g, "").replace(",", ".") || "0") * 100);
    startTransition(async () => {
      const result = await setCategoryBudget(householdId, walletId, edit.categoryId, ym, amountCents);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEdit(null);
      setError(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCategoryBudget(id);
      setEdit(null);
      router.refresh();
    });
  }

  function copyPrev() {
    startTransition(async () => {
      await copyBudgetsFromPreviousMonth(householdId, walletId, ym);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[14px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Budżety wydatków</h2>
        <button
          type="button"
          onClick={() => setEdit({ id: null, categoryId: "", amount: "" })}
          className="rounded-[10px] border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Ustaw budżet
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Przypisz miesięczny limit do kategorii, żeby zarezerwować na nią pieniądze w tym portfelu.
          </p>
          <button
            type="button"
            onClick={copyPrev}
            disabled={pending}
            className="w-fit text-xs font-medium disabled:opacity-50"
            style={{ color: "var(--neatly-primary-dark)" }}
          >
            Skopiuj budżety z poprzedniego miesiąca
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const cat = categoryById.get(row.categoryId);
            const pct = Math.min(100, Math.round((row.spentCents / row.limitCents) * 100));
            const over = row.spentCents > row.limitCents;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  setEdit({
                    id: row.id,
                    categoryId: row.categoryId,
                    amount: (row.limitCents / 100).toFixed(2).replace(".", ","),
                  })
                }
                className="rounded-[10px] border border-border p-3 text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span aria-hidden>{cat?.emoji}</span>
                    {cat?.name}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {money(row.spentCents)} / {money(row.limitCents)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full" style={{ background: "var(--neatly-primary-soft)" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${pct}%`, background: over ? "var(--destructive)" : cat?.color }}
                  />
                </div>
                <div className="mt-1 text-[11px]" style={{ color: over ? "var(--destructive)" : "var(--muted-foreground)" }}>
                  {over
                    ? `Przekroczono o ${money(row.spentCents - row.limitCents)}`
                    : `Zostało ${money(row.limitCents - row.spentCents)}`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{edit?.id ? "Edytuj budżet" : "Nowy budżet wydatków"}</SheetTitle>
          </SheetHeader>
          {edit && (
            <form onSubmit={submit} className="flex flex-col gap-4 px-4 pb-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Kategoria</label>
                <select
                  value={edit.categoryId}
                  disabled={!!edit.id}
                  onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}
                  className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">—</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Limit na miesiąc (PLN)</label>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={edit.amount}
                  onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                  placeholder="2500,00"
                  className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Limit rezerwuje pieniądze w wydatkach miesiąca. Dopóki wydasz mniej, do sumy wchodzi cała kwota
                limitu; po przekroczeniu — rzeczywista suma pozycji.
              </p>
              {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !edit.categoryId}
                  className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  Zapisz
                </button>
                {edit.id && (
                  <button
                    type="button"
                    onClick={() => remove(edit.id!)}
                    disabled={pending}
                    className="rounded-[10px] px-4 py-2.5 text-sm font-medium"
                    style={{ background: "var(--neatly-danger-soft)", color: "var(--destructive)" }}
                  >
                    Usuń
                  </button>
                )}
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
