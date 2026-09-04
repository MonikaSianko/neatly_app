"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical, Pencil, ArrowRightCircle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionForm, type EditingTransaction, type EditingRule } from "@/components/transaction-form";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { deleteTransaction, moveTransactionToNextMonth } from "@/lib/actions/transactions";
import { deleteRecurringEntry } from "@/lib/actions/recurring";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { categoryDisplayName } from "@/lib/i18n";

export type TxRow = {
  id: string;
  title: string;
  amount_cents: number;
  date: string;
  is_paid: boolean;
  category_id: string;
  recurring_rule_id: string | null;
};

export type TxGroup = {
  category: { id: string; name: string; emoji: string; color: string } | null;
  items: TxRow[];
  sum: number;
};

type Category = { id: string; name: string; emoji: string; kind: "expense" | "income" };

export function TransactionGroupList({
  groups,
  kind,
  householdId,
  walletId,
  categories,
  rules,
  today,
  defaultDate,
}: {
  groups: TxGroup[];
  kind: "expense" | "income";
  householdId: string;
  walletId: string;
  categories: Category[];
  rules: Record<string, EditingRule>;
  today: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TxRow | null>(null);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function togglePaid(row: TxRow) {
    const next = !(overrides[row.id] ?? row.is_paid);
    setOverrides((prev) => ({ ...prev, [row.id]: next }));
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq("id", row.id);
    if (error) {
      setOverrides((prev) => ({ ...prev, [row.id]: row.is_paid }));
      return;
    }
    router.refresh();
  }

  function startMoveNext(id: string, date: string) {
    moveTransactionToNextMonth(id, date).then(() => router.refresh());
  }

  function requestDelete(row: TxRow) {
    if (row.recurring_rule_id) {
      setDeleteTarget(row);
    } else {
      deleteTransaction(row.id).then(() => router.refresh());
    }
  }

  function pickDeleteScope(scope: Scope) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    deleteRecurringEntry(id, scope).then(() => router.refresh());
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {t.emptyList}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const key = group.category?.id ?? "none";
          const isOpen = expanded.has(key);
          return (
            <div key={key} className="rounded-[14px] border border-border bg-card">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <span aria-hidden>{group.category?.emoji}</span>
                <span className="flex-1 truncate text-sm font-medium">
                  {group.category ? categoryDisplayName(group.category.name, locale) : "—"}
                </span>
                <span className="text-xs text-muted-foreground">{group.items.length} {t.rows}</span>
                <span className="tabular text-sm font-medium">{money(group.sum, locale)}</span>
                <ChevronDown
                  className="h-4 w-4 text-muted-foreground transition-transform"
                  style={{ transform: isOpen ? "rotate(180deg)" : undefined }}
                />
              </button>
              {isOpen && (
                <div className="border-t border-border">
                  {group.items.map((row, i) => {
                    const paid = overrides[row.id] ?? row.is_paid;
                    const overdue = !paid && row.date < today;
                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-2 px-4 py-2 ${i > 0 ? "border-t border-border" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={() => togglePaid(row)}
                          className="h-4 w-4 rounded-[6px]"
                          aria-label={kind === "income" ? t.received : t.paid}
                        />
                        <span className="flex-1 truncate text-sm">
                          {row.title}
                          {row.recurring_rule_id && <span className="ml-1">🔁</span>}
                        </span>
                        <span className="text-xs" style={{ color: overdue ? "var(--destructive)" : "var(--muted-foreground)" }}>
                          {shortDate(row.date, locale)}
                          {overdue && ` ${t.overdue}`}
                        </span>
                        <span className="tabular text-sm font-medium">{money(row.amount_cents, locale)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="p-1 text-muted-foreground" aria-label="Menu pozycji">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setEditing({
                                  id: row.id,
                                  kind,
                                  title: row.title,
                                  amountCents: row.amount_cents,
                                  categoryId: row.category_id,
                                  date: row.date,
                                  isPaid: paid,
                                  recurringRuleId: row.recurring_rule_id,
                                  rule: row.recurring_rule_id ? rules[row.recurring_rule_id] ?? null : null,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" /> {t.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => startMoveNext(row.id, row.date)}>
                              <ArrowRightCircle className="h-4 w-4" /> {t.moveNext}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(row)}>
                              <Trash2 className="h-4 w-4" /> {t.del}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TransactionForm
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        householdId={householdId}
        walletId={walletId}
        categories={categories}
        defaultDate={defaultDate}
        editing={editing}
      />

      <ScopeDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.scopeDelTitle}
        onPick={pickDeleteScope}
      />
    </>
  );
}
