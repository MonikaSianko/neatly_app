"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  setCategoryBudget,
  deleteCategoryBudget,
  copyBudgetsFromPreviousMonth,
} from "@/lib/actions/budgets";
import { money } from "@/lib/format";
import type { YearMonth } from "@/lib/month";
import { useLocale } from "@/components/locale-provider";
import { categoryDisplayName } from "@/lib/i18n";
import { CategoryCombobox } from "@/components/category-combobox";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";

type Category = { id: string; name: string; name_en: string | null; emoji: string; color: string };
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
  const { locale, t } = useLocale();
  const [edit, setEdit] = useState<Draft | null>(null);
  const { pending, busy, error, run } = useAction();

  const budgetedIds = new Set(rows.map((r) => r.categoryId));
  const available = categories.filter((c) => !budgetedIds.has(c.id) || c.id === edit?.categoryId);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const amountCents = Math.round(parseFloat(edit.amount.replace(/\s/g, "").replace(",", ".") || "0") * 100);
    run(() => setCategoryBudget(householdId, walletId, edit.categoryId, ym, amountCents), {
      onSuccess: () => setEdit(null),
    });
  }

  function remove(id: string) {
    run(() => deleteCategoryBudget(id), { key: "delete", onSuccess: () => setEdit(null) });
  }

  function copyPrev() {
    run(() => copyBudgetsFromPreviousMonth(householdId, walletId, ym), { key: "copy" });
  }

  return (
    <section className="rounded-[14px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-medium">{t.budgets}</h2>
        <button
          type="button"
          onClick={() => setEdit({ id: null, categoryId: "", amount: "" })}
          className="rounded-[10px] border border-border px-2.5 py-1 text-sm font-medium hover:bg-muted"
        >
          {t.setBudget}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t.budgetsEmpty}</p>
          <button
            type="button"
            onClick={copyPrev}
            disabled={pending}
            className="flex w-fit items-center gap-2 text-sm font-medium disabled:opacity-50"
            style={{ color: "var(--neatly-primary-dark)" }}
          >
            {busy("copy") && <Spinner className="h-3.5 w-3.5" />}
            {t.copyPrev}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const cat = categoryById.get(row.categoryId);
            // Zwroty potrafia zbic wydatki kategorii ponizej zera — pasek zatrzymuje sie na pustym.
            const pct = Math.max(0, Math.min(100, Math.round((row.spentCents / row.limitCents) * 100)));
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
                <div className="flex items-center justify-between gap-2 text-base">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium">
                    <span aria-hidden className="shrink-0">{cat?.emoji}</span>
                    <span className="truncate">{cat ? categoryDisplayName(cat.name, locale, cat.name_en) : ""}</span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm text-muted-foreground">
                    {money(row.spentCents, locale)} / {money(row.limitCents, locale)}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full" style={{ background: "var(--neatly-primary-soft)" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${pct}%`, background: over ? "var(--destructive)" : cat?.color }}
                  />
                </div>
                <div className="mt-1 text-xs" style={{ color: over ? "var(--destructive)" : "var(--muted-foreground)" }}>
                  {over
                    ? `${t.over} ${money(row.spentCents - row.limitCents, locale)}`
                    : `${t.left} ${money(row.limitCents - row.spentCents, locale)}`}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{edit?.id ? t.editBudget : t.newBudget}</SheetTitle>
          </SheetHeader>
          {edit && (
            <form onSubmit={submit} className="flex flex-col gap-4 px-4 pb-4">
              <div>
                <label className="mb-1.5 block text-base font-medium">{t.category}</label>
                <CategoryCombobox
                  options={available.map((c) => ({
                    id: c.id,
                    label: categoryDisplayName(c.name, locale, c.name_en),
                    emoji: c.emoji,
                  }))}
                  value={edit.categoryId}
                  disabled={!!edit.id}
                  onChange={(categoryId) => setEdit({ ...edit, categoryId })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-base font-medium">{t.limitMonth}</label>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={edit.amount}
                  onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                  placeholder="2500,00"
                  className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
                />
              </div>
              <p className="text-sm text-muted-foreground">{t.budgetHint}</p>
              {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !edit.categoryId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {pending && !busy("delete") && <Spinner />}
                  {t.save}
                </button>
                {edit.id && (
                  <button
                    type="button"
                    onClick={() => remove(edit.id!)}
                    disabled={pending}
                    className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium disabled:opacity-50"
                    style={{ background: "var(--neatly-danger-soft)", color: "var(--destructive)" }}
                  >
                    {busy("delete") && <Spinner />}
                    {t.del}
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
