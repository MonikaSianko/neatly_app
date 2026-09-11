"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Repeat,
  Undo2,
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
import { deleteTransaction } from "@/lib/actions/transactions";
import { deleteSplitTransaction, setSplitPaid } from "@/lib/actions/splits";
import { deleteRecurringEntry } from "@/lib/actions/recurring";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate, payNowStyle } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";
import { clearPendingRows, usePendingRows } from "@/lib/pending-rows";
import { categoryDisplayName } from "@/lib/i18n";

export type TxRow = {
  id: string;
  kind: "expense" | "income";
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
  /** Zwrot pokazuje sie w kategorii wydatku, ktory pomniejsza — ze znakiem minus. */
  is_refund: boolean;
  refund_of_id: string | null;
};

export type TxGroup = {
  category: { id: string; name: string; name_en: string | null; emoji: string; color: string } | null;
  items: TxRow[];
  sum: number;
};

type Category = { id: string; name: string; name_en: string | null; emoji: string; kind: "expense" | "income" };

export function TransactionGroupList({
  groups,
  refundParents,
  householdId,
  walletId,
  categories,
  rules,
  splitGroups,
  today,
  defaultDate,
}: {
  groups: TxGroup[];
  /** Tytuly zwracanych platnosci po id — zwrot sam z siebie nie mowi, czego dotyczy. */
  refundParents: Record<string, string>;
  householdId: string;
  walletId: string;
  categories: Category[];
  rules: Record<string, EditingRule>;
  splitGroups: Record<string, { total: number; parts: EditingSplitPart[] }>;
  today: string;
  defaultDate: string;
}) {
  const { locale, t } = useLocale();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  // Klucz edytowanego wiersza przezywa zamkniecie arkusza, bo zapis konczy sie juz po nim.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Wiersze, ktorych dane sa juz nieaktualne (zapisane albo usuwane) — do czasu odpowiedzi
  // serwera stoi w ich miejscu szkielet, bo stara kwota myli bardziej niz jej brak.
  const [staleKeys, setStaleKeys] = useState<string[]>([]);
  const [lastGroups, setLastGroups] = useState(groups);
  const pendingNewRows = usePendingRows();
  const [deleteTarget, setDeleteTarget] = useState<TxRow | null>(null);
  const { busy, error, run } = useAction();

  // Nowa tablica grup = serwer odeslal swieze dane, wiec nie ma juz na co czekac. Korekta
  // w trakcie renderu zamiast w efekcie: React powtarza render od razu, bez migniecia szkieletu.
  if (groups !== lastGroups) {
    setLastGroups(groups);
    setStaleKeys([]);
  }

  // Nowy wpis dojechal razem z ta tablica — zapowiedz mozna zdjac.
  useEffect(() => {
    clearPendingRows();
  }, [groups]);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePaid(row: TxRow) {
    const next = !(overrides[row.id] ?? row.is_paid);
    setOverrides((prev) => ({ ...prev, [row.id]: next }));

    run(
      async () => {
        // Czesci jednej platnosci schodza z konta razem, wiec odhaczamy cala grupe.
        const failed = row.split_group_id
          ? (await setSplitPaid(row.split_group_id, next)).error
          : await (async () => {
              const supabase = createClient();
              const { error: dbError } = await supabase
                .from("transactions")
                .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
                .eq("id", row.id);
              return dbError?.message ?? null;
            })();

        // Odhaczenie zmienia wiersz od razu, wiec nieudany zapis trzeba cofnac na ekranie.
        if (failed) setOverrides((prev) => ({ ...prev, [row.id]: row.is_paid }));
        return { error: failed };
      },
      { key: row.id }
    );
  }

  /** Usuwany wiersz od razu idzie w szkielet — zniknie z nim dopiero, gdy przyjda nowe dane. */
  function markStale(key: string) {
    setStaleKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function dropStale(key: string) {
    setStaleKeys((prev) => prev.filter((x) => x !== key));
  }

  function requestDelete(row: TxRow) {
    if (row.recurring_rule_id && !row.split_group_id) {
      setDeleteTarget(row);
      return;
    }
    markStale(row.id);
    run(
      // Pojedyncza czesc bez reszty nie zgadzalaby sie z wyciagiem — znika cala platnosc.
      () => (row.split_group_id ? deleteSplitTransaction(row.split_group_id) : deleteTransaction(row.id)),
      { onError: () => dropStale(row.id) }
    );
  }

  /** Data i tytul naleza do calej platnosci, wiec edycja czesci otwiera platnosc w calosci. */
  function editRow(row: TxRow, paid: boolean) {
    const split = row.split_group_id ? splitGroups[row.split_group_id] : null;
    setEditingKey(row.id);
    setEditing({
      id: row.id,
      // Zwrot lezy w grupie wydatkow, ale sam jest przychodem — formularz musi dostac jego wlasny rodzaj.
      kind: row.kind,
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
      isRefund: row.is_refund,
      refundOfId: row.refund_of_id,
    });
  }

  /**
   * Tytul zwrotu z nazwa zwracanej platnosci z przodu. Doklejana czesc ma kolor marki,
   * zeby bylo widac, ze to nie jest czesc wpisanej nazwy.
   */
  function rowTitle(row: TxRow) {
    const parent = row.is_refund && row.refund_of_id ? refundParents[row.refund_of_id] : null;
    return (
      <>
        {parent && <span style={{ color: "var(--neatly-primary-dark)" }}>{parent} — </span>}
        {row.title}
        {row.split_label && <span className="text-muted-foreground"> — {row.split_label}</span>}
      </>
    );
  }

  function pickDeleteScope(scope: Scope) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    markStale(id);
    run(() => deleteRecurringEntry(id, scope), { onError: () => dropStale(id) });
  }

  // Pusty miesiac, ale wpis wlasnie leci na serwer — wtedy zamiast komunikatu czeka szkielet.
  if (groups.length === 0 && pendingNewRows === 0) {
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
                    // Po zapisie wiersz ma stare wartosci az do odpowiedzi serwera — lepiej
                    // pokazac szkielet niz kwote, ktorej juz nie ma.
                    if (staleKeys.includes(row.id)) {
                      return <RowSkeleton key={row.id} withBorder={i > 0} />;
                    }
                    // Wiersz czekajacy na baze przygasa i nie przyjmuje kolejnych klikniec.
                    const waiting = busy(row.id);
                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-2 px-4 py-2 ${i > 0 ? "border-t border-border" : ""}`}
                        style={waiting ? { opacity: 0.55, pointerEvents: "none" } : undefined}
                        aria-busy={waiting || undefined}
                      >
                        <label className="tap-target flex h-6 w-6 shrink-0 items-center justify-center">
                          {waiting ? (
                            <Spinner className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={paid}
                              onChange={() => togglePaid(row)}
                              className="h-4 w-4 rounded-[6px]"
                              aria-label={row.kind === "income" ? t.received : t.paid}
                            />
                          )}
                        </label>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base">
                          <span className="truncate">{rowTitle(row)}</span>
                          {row.is_refund && (
                            <Undo2
                              className="h-3.5 w-3.5 shrink-0"
                              style={{ color: "var(--neatly-primary-dark)" }}
                              aria-label={t.refundOne}
                            />
                          )}
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
                            aria-label={t.payNow}
                            className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium sm:h-auto sm:w-auto sm:gap-1 sm:px-2.5 sm:py-1"
                            style={payNowStyle(paymentStatus(row.date, row.grace_days, today))}
                          >
                            <ExternalLink className="h-4 w-4 sm:h-3 sm:w-3" />
                            <span className="hidden sm:inline">{t.payNow}</span>
                          </a>
                        )}
                        <span
                          className="tabular text-base font-medium"
                          style={row.is_refund ? { color: "var(--neatly-primary-dark)" } : undefined}
                        >
                          {money(row.is_refund ? -row.amount_cents : row.amount_cents, locale)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                              aria-label={t.rowMenu}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => editRow(row, paid)}>
                              <Pencil className="h-4 w-4" /> {t.edit}
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

        {/* Nowy wpis nie zna jeszcze swojej kategorii, wiec czeka pod lista, a nie w grupie. */}
        {pendingNewRows > 0 && (
          <div className="rounded-[14px] border border-border bg-card">
            {Array.from({ length: pendingNewRows }, (_, i) => (
              <RowSkeleton key={`new-${i}`} withBorder={i > 0} />
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

      <TransactionForm
        onSavingChange={(saving) => {
          if (saving && editingKey) markStale(editingKey);
          else if (editingKey) dropStale(editingKey);
        }}
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

/** Wiersz w oczekiwaniu na dane po zapisie — te same proporcje, zeby lista nie skakala. */
function RowSkeleton({ withBorder }: { withBorder: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 ${withBorder ? "border-t border-border" : ""}`}
      aria-busy
    >
      <div className="h-4 w-4 shrink-0 animate-pulse rounded-[6px] bg-muted" />
      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
      <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-muted" />
      <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
