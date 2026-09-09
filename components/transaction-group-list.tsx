"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  MoreVertical,
  Pencil,
  ArrowRightCircle,
  Trash2,
  ExternalLink,
  Repeat,
  Zap,
  Split,
} from "lucide-react";
import { paymentStatus } from "@/lib/month";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TransactionForm,
  type EditingTransaction,
  type EditingRule,
  type EditingSplitPart,
} from "@/components/transaction-form";
import { NotePopover } from "@/components/note-popover";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { deleteTransaction, moveTransactionToNextMonth } from "@/lib/actions/transactions";
import { deleteSplitTransaction, setSplitPaid } from "@/lib/actions/splits";
import { deleteRecurringEntry } from "@/lib/actions/recurring";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate, payNowStyle } from "@/lib/format";
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
  payment_url: string | null;
  grace_days: number;
  note: string | null;
  is_automatic: boolean;
  split_group_id: string | null;
  split_label: string | null;
};

export type TxGroup = {
  category: { id: string; name: string; name_en: string | null; emoji: string; color: string } | null;
  items: TxRow[];
  sum: number;
};

type Category = { id: string; name: string; name_en: string | null; emoji: string; kind: "expense" | "income" };

export function TransactionGroupList({
  groups,
  kind,
  householdId,
  walletId,
  categories,
  rules,
  splitGroups,
  today,
  defaultDate,
}: {
  groups: TxGroup[];
  kind: "expense" | "income";
  householdId: string;
  walletId: string;
  categories: Category[];
  rules: Record<string, EditingRule>;
  splitGroups: Record<string, { total: number; parts: EditingSplitPart[] }>;
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

    // Czesci jednej platnosci schodza z konta razem, wiec odhaczamy cala grupe.
    const failed = row.split_group_id
      ? (await setSplitPaid(row.split_group_id, next)).error
      : await (async () => {
          const supabase = createClient();
          const { error } = await supabase
            .from("transactions")
            .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
            .eq("id", row.id);
          return error?.message ?? null;
        })();

    if (failed) {
      setOverrides((prev) => ({ ...prev, [row.id]: row.is_paid }));
      return;
    }
    router.refresh();
  }

  function startMoveNext(id: string, date: string) {
    moveTransactionToNextMonth(id, date).then(() => router.refresh());
  }

  function requestDelete(row: TxRow) {
    if (row.split_group_id) {
      // Pojedyncza czesc bez reszty nie zgadzalaby sie z wyciagiem — znika cala platnosc.
      deleteSplitTransaction(row.split_group_id).then(() => router.refresh());
    } else if (row.recurring_rule_id) {
      setDeleteTarget(row);
    } else {
      deleteTransaction(row.id).then(() => router.refresh());
    }
  }

  /** Data i tytul naleza do calej platnosci, wiec edycja czesci otwiera platnosc w calosci. */
  function editRow(row: TxRow, paid: boolean) {
    const split = row.split_group_id ? splitGroups[row.split_group_id] : null;
    setEditing({
      id: row.id,
      kind,
      title: row.title,
      amountCents: split ? split.total : row.amount_cents,
      categoryId: row.category_id,
      date: row.date,
      isPaid: paid,
      paymentUrl: row.payment_url,
      graceDays: row.grace_days,
      note: row.note,
      isAutomatic: row.is_automatic,
      recurringRuleId: row.recurring_rule_id,
      rule: row.recurring_rule_id ? rules[row.recurring_rule_id] ?? null : null,
      splitGroupId: row.split_group_id,
      splitParts: split?.parts,
    });
  }

  function pickDeleteScope(scope: Scope) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    deleteRecurringEntry(id, scope).then(() => router.refresh());
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-6 text-center text-base text-muted-foreground">
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
                <span className="flex-1 truncate text-base font-medium">
                  {group.category ? categoryDisplayName(group.category.name, locale, group.category.name_en) : "—"}
                </span>
                <span className="text-sm text-muted-foreground">{group.items.length} {t.rows}</span>
                <span className="tabular text-base font-medium">{money(group.sum, locale)}</span>
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
                        <label className="tap-target flex h-6 w-6 shrink-0 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={paid}
                            onChange={() => togglePaid(row)}
                            className="h-4 w-4 rounded-[6px]"
                            aria-label={kind === "income" ? t.received : t.paid}
                          />
                        </label>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base">
                          <span className="truncate">
                            {row.title}
                            {row.split_label && (
                              <span className="text-muted-foreground"> — {row.split_label}</span>
                            )}
                          </span>
                          {row.split_group_id && (
                            <Split
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-label={t.splitOne}
                            />
                          )}
                          {row.recurring_rule_id && (
                            <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t.repeat} />
                          )}
                          {row.is_automatic && (
                            <Zap
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: "var(--neatly-primary-dark)" }}
                              aria-label={t.automatic}
                            />
                          )}
                          {row.note && <NotePopover note={row.note} />}
                        </span>
                        <span className="text-sm" style={{ color: overdue ? "var(--destructive)" : "var(--muted-foreground)" }}>
                          {shortDate(row.date, locale)}
                          {overdue && ` ${t.overdue}`}
                        </span>
                        {!paid && row.payment_url && (
                          <a
                            href={row.payment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-2 text-sm font-medium sm:py-1"
                            style={payNowStyle(paymentStatus(row.date, row.grace_days, today))}
                          >
                            <ExternalLink className="h-3 w-3" /> {t.payNow}
                          </a>
                        )}
                        <span className="tabular text-base font-medium">{money(row.amount_cents, locale)}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                              aria-label="Menu pozycji"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => editRow(row, paid)}>
                              <Pencil className="h-4 w-4" /> {t.edit}
                            </DropdownMenuItem>
                            {!row.split_group_id && (
                              <DropdownMenuItem onClick={() => startMoveNext(row.id, row.date)}>
                                <ArrowRightCircle className="h-4 w-4" /> {t.moveNext}
                              </DropdownMenuItem>
                            )}
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
        mode="delete"
        onPick={pickDeleteScope}
      />
    </>
  );
}
