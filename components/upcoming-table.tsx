"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  MoreVertical,
  X,
  Repeat,
  Check,
  ChevronDown,
  ExternalLink,
  Zap,
  Pencil,
  Trash2,
} from "lucide-react";
import { DraftRecurrenceDialog } from "@/components/draft-recurrence-dialog";
import { NotePopover } from "@/components/note-popover";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionForm, type EditingTransaction, type EditingRule } from "@/components/transaction-form";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { deleteTransaction } from "@/lib/actions/transactions";
import { deleteSplitTransaction, setSplitPaid } from "@/lib/actions/splits";
import { deleteRecurringEntry } from "@/lib/actions/recurring";
import { saveDraftRows, type DraftRowInput } from "@/lib/actions/drafts";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate, parseAmountToCents, payNowStyle } from "@/lib/format";
import { paymentStatus } from "@/lib/month";
import type { RecurrencePattern } from "@/lib/actions/recurring";
import { useLocale } from "@/components/locale-provider";
import { categoryDisplayName } from "@/lib/i18n";

type Category = {
  id: string;
  name: string;
  name_en: string | null;
  emoji: string;
  color: string;
  kind: "expense" | "income";
};

export type UpcomingRow = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amount_cents: number;
  category_id: string;
  date: string;
  is_paid: boolean;
  created_at: string;
  recurring_rule_id: string | null;
  payment_url: string | null;
  grace_days: number;
  note: string | null;
  is_automatic: boolean;
  split_group_id: string | null;
  split_label: string | null;
};

/** Platnosc widziana tak, jak w banku: pojedyncza pozycja albo grupa czesci z suma kwot. */
type PaymentGroup = {
  key: string;
  head: UpcomingRow;
  parts: UpcomingRow[];
  total: number;
};

/** Data platnosci to termin, data dodania to moment wpisania pozycji — to dwie rozne rzeczy. */
type SortKey = "date" | "created";

/**
 * Jedna siatka dla naglowka, wierszy danych i wierszy roboczych — inaczej kolumny sie rozjezdzaja.
 * Szerokosci dobrane tak, zeby tabela zmiescila sie bez przewijania w poziomie od lg w gore:
 * przy lg (jedna kolumna) dostepne ~990px, przy xl (z panelem bocznym) ~910px.
 */
const GRID = "grid grid-cols-[28px_1.5fr_1.1fr_96px_92px_116px_120px_32px_32px]";

type DraftRow = {
  key: string;
  kind: "expense" | "income";
  title: string;
  categoryId: string;
  date: string;
  amount: string;
  isPaid: boolean;
  pattern: RecurrencePattern | null;
};

let keySeq = 0;
const nextKey = () => `draft-${++keySeq}-${Date.now()}`;

function mkRow(kind: "expense" | "income", categoryId: string, date: string, patch: Partial<DraftRow> = {}): DraftRow {
  return { key: nextKey(), kind, title: "", categoryId, date, amount: "", isPaid: false, pattern: null, ...patch };
}

export function UpcomingTable({
  rows,
  categories,
  householdId,
  walletId,
  rules,
  today,
  defaultDate,
}: {
  rows: UpcomingRow[];
  categories: Category[];
  householdId: string;
  walletId: string;
  rules: Record<string, EditingRule>;
  today: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [recIdx, setRecIdx] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [showPaid, setShowPaid] = useState(false);
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UpcomingRow | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastInputRef = useRef<HTMLInputElement | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const catsOf = (kind: "expense" | "income") => categories.filter((c) => c.kind === kind);

  function addRow() {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      const next = mkRow(last?.kind ?? "expense", last?.categoryId ?? catsOf("expense")[0]?.id ?? "", last?.date ?? defaultDate);
      setTimeout(() => lastInputRef.current?.focus(), 30);
      return [...prev, next];
    });
  }

  function update(i: number, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setDrafts((prev) => prev.filter((_, k) => k !== i));
  }

  function onKeyDown(e: React.KeyboardEvent, i: number, isLast: boolean) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isLast) addRow();
    else setTimeout(() => lastInputRef.current?.focus(), 30);
  }

  function onPaste(e: React.ClipboardEvent, i: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();

    const parsed = text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const parts = line
          .split(/\t|;/)
          .map((x) => x.trim())
          .filter(Boolean);
        const last = parts[parts.length - 1] ?? "";
        const cents = parseAmountToCents(last);
        const titleParts = cents != null ? parts.slice(0, -1) : parts;
        return {
          title: titleParts.join(" ").slice(0, 60),
          amount: cents != null ? (cents / 100).toFixed(2).replace(".", ",") : "",
        };
      });

    setDrafts((prev) => {
      const base = prev[i];
      const made = parsed.map((p) => mkRow(base?.kind ?? "expense", base?.categoryId ?? catsOf("expense")[0]?.id ?? "", base?.date ?? defaultDate, p));
      return [...prev.slice(0, i), ...made, ...prev.slice(i + 1)];
    });
  }

  const isPaid = (row: UpcomingRow) => overrides[row.id] ?? row.is_paid;

  function toggleSplit(key: string) {
    setExpandedSplits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Odhaczenie dotyczy calej platnosci — czesci jednego zakupu schodza z konta razem. */
  async function togglePaid(group: PaymentGroup) {
    const next = !isPaid(group.head);
    const affected = group.parts.length > 0 ? group.parts : [group.head];
    setOverrides((prev) => ({ ...prev, ...Object.fromEntries(affected.map((r) => [r.id, next])) }));

    const result = group.parts.length
      ? await setSplitPaid(group.key, next)
      : await (async () => {
          const supabase = createClient();
          const { error } = await supabase
            .from("transactions")
            .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
            .eq("id", group.head.id);
          return { error: error?.message ?? null };
        })();

    if (result.error) {
      setOverrides((prev) => ({ ...prev, ...Object.fromEntries(affected.map((r) => [r.id, r.is_paid])) }));
      return;
    }
    router.refresh();
  }

  function requestDelete(group: PaymentGroup) {
    if (group.parts.length > 0) {
      deleteSplitTransaction(group.key).then(() => router.refresh());
    } else if (group.head.recurring_rule_id) {
      setDeleteTarget(group.head);
    } else {
      deleteTransaction(group.head.id).then(() => router.refresh());
    }
  }

  function pickDeleteScope(scope: Scope) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    deleteRecurringEntry(id, scope).then(() => router.refresh());
  }

  /** Czesci jednej platnosci schodza sie w jeden wiersz z suma — taka kwota widnieje na wyciagu. */
  function toGroups(list: UpcomingRow[]): PaymentGroup[] {
    const splits = new Map<string, UpcomingRow[]>();
    const groups: PaymentGroup[] = [];

    for (const row of list) {
      if (!row.split_group_id) {
        groups.push({ key: row.id, head: row, parts: [], total: row.amount_cents });
        continue;
      }
      const found = splits.get(row.split_group_id);
      if (found) found.push(row);
      else splits.set(row.split_group_id, [row]);
    }
    for (const [key, parts] of splits) {
      groups.push({ key, head: parts[0], parts, total: parts.reduce((s, p) => s + p.amount_cents, 0) });
    }

    return groups.sort((a, b) =>
      sortKey === "created"
        ? b.head.created_at.localeCompare(a.head.created_at)
        : a.head.date.localeCompare(b.head.date) || a.head.title.localeCompare(b.head.title)
    );
  }

  const filled = drafts.filter((r) => r.title.trim() && (parseAmountToCents(r.amount) ?? 0) > 0);
  const draftTotal = filled.reduce((sum, r) => sum + (parseAmountToCents(r.amount) ?? 0), 0);
  const openGroups = toGroups(rows.filter((r) => !isPaid(r)));
  const paidGroups = toGroups(rows.filter(isPaid));
  const sumOf = (groups: PaymentGroup[]) =>
    groups.reduce((sum, g) => sum + (g.head.kind === "income" ? g.total : -g.total), 0);
  const netTotal = sumOf(openGroups);
  const paidTotal = sumOf(paidGroups);

  async function saveAll() {
    if (filled.length === 0) return;
    setSaving(true);
    setError(null);
    const input: DraftRowInput[] = filled.map((r) => ({
      kind: r.kind,
      title: r.title,
      amountCents: parseAmountToCents(r.amount) ?? 0,
      categoryId: r.categoryId,
      date: r.date,
      isPaid: r.isPaid,
      pattern: r.pattern,
    }));
    const result = await saveDraftRows(householdId, walletId, input);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDrafts([]);
    router.refresh();
  }

  /** Edycje otwiera menu (...) — i na telefonie, i na desktopie, z jednego zrodla danych. */
  function openEdit(group: PaymentGroup) {
    const row = group.head;
    const split = group.parts.length > 0;
    setEditing({
      id: row.id,
      kind: row.kind,
      title: row.title,
      amountCents: group.total,
      categoryId: row.category_id,
      date: row.date,
      isPaid: isPaid(row),
      paymentUrl: row.payment_url,
      graceDays: row.grace_days,
      note: row.note,
      isAutomatic: row.is_automatic,
      recurringRuleId: row.recurring_rule_id,
      rule: row.recurring_rule_id ? rules[row.recurring_rule_id] ?? null : null,
      splitGroupId: split ? group.key : null,
      splitParts: split
        ? group.parts.map((p) => ({
            id: p.id,
            categoryId: p.category_id,
            amountCents: p.amount_cents,
            label: p.split_label,
          }))
        : undefined,
    });
  }

  /** Jedna siatka dla pozycji oplaconych i nieoplaconych, zeby kolumny wszedzie sie pokrywaly. */
  function renderGroup(group: PaymentGroup, withBorder: boolean) {
    const row = group.head;
    const split = group.parts.length > 0;
    const cat = categoryById.get(row.category_id);
    const paid = isPaid(row);
    const late = !paid && row.date < today;
    const expanded = expandedSplits.has(group.key);

    const categoryNames = split
      ? group.parts
          .map((p) => {
            const c = categoryById.get(p.category_id);
            return c ? categoryDisplayName(c.name, locale, c.name_en) : "";
          })
          .filter(Boolean)
          .join(", ")
      : cat
        ? categoryDisplayName(cat.name, locale, cat.name_en)
        : "";

    return (
      <div key={group.key} className={withBorder ? "border-t border-border" : ""}>
      {/* Telefon: dwie linie zamiast dziewieciu kolumn. Akcje siedza w menu (...),
          zeby przypadkowe dotkniecie wiersza nie otwieralo edycji. */}
      <div className={`flex items-center gap-2 px-3 py-2.5 lg:hidden ${paid ? "text-muted-foreground" : ""}`}>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {split ? (
              <span className="flex shrink-0 items-center">
                {group.parts.slice(0, 3).map((part) => (
                  <span
                    key={part.id}
                    className="-mr-1 h-2.5 w-2.5 rounded-full ring-2 ring-card"
                    style={{ background: categoryById.get(part.category_id)?.color }}
                  />
                ))}
              </span>
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
            )}
            <span className="truncate text-base font-medium">{row.title}</span>
            {row.recurring_rule_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {row.is_automatic && <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--neatly-primary-dark)" }} />}
          </span>
          <span
            className="mt-0.5 flex items-center gap-1.5 truncate text-sm"
            style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}
          >
            <span className="truncate">{categoryNames}</span>
            <span className="shrink-0 opacity-50">·</span>
            <span className="shrink-0">
              {shortDate(row.date, locale)}
              {late && ` ${t.overdue}`}
            </span>
          </span>
        </div>

        <span className="tabular shrink-0 text-base font-semibold">{money(group.total, locale)}</span>

        {split && (
          <button
            type="button"
            onClick={() => toggleSplit(group.key)}
            aria-expanded={expanded}
            aria-label={t.splitOne}
            className="tap-target flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
          >
            <ChevronDown
              className="h-5 w-5 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        )}

        <button
          type="button"
          onClick={() => togglePaid(group)}
          className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border"
          style={{
            borderColor: paid ? "var(--primary)" : "var(--border)",
            background: paid ? "var(--primary)" : "transparent",
          }}
          aria-label={row.kind === "income" ? t.received : t.paid}
        >
          {paid && <Check className="h-4 w-4 text-primary-foreground" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
              aria-label={t.rowMenu}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(group)}>
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(group)}>
              <Trash2 className="h-4 w-4" /> {t.del}
            </DropdownMenuItem>
            {!paid && row.payment_url && (
              <DropdownMenuItem asChild>
                <a href={row.payment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> {t.payNow}
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={`${GRID} hidden items-center gap-1 px-2 py-2 text-base lg:grid ${paid ? "text-muted-foreground" : ""}`}
      >
        <span
          className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
          style={{ color: row.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
          aria-label={row.kind === "expense" ? t.expense : t.incomeOne}
        >
          {row.kind === "expense" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{row.title}</span>
          {row.recurring_rule_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t.repeat} />}
          {row.is_automatic && (
            <Zap
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--neatly-primary-dark)" }}
              aria-label={t.automatic}
            />
          )}
          {row.note && <NotePopover note={row.note} />}
        </span>
        {split ? (
          <button
            type="button"
            onClick={() => toggleSplit(group.key)}
            className="flex min-w-0 items-center gap-1.5 text-left text-muted-foreground"
            aria-expanded={expanded}
          >
            <span className="flex shrink-0 -space-x-1">
              {group.parts.slice(0, 3).map((part) => (
                <span
                  key={part.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-card"
                  style={{ background: categoryById.get(part.category_id)?.color }}
                />
              ))}
            </span>
            <span className="truncate text-sm">
              {group.parts.length} {t.splitCategories}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
            {cat ? categoryDisplayName(cat.name, locale, cat.name_en) : ""}
          </span>
        )}
        <span className="text-sm" style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}>
          {shortDate(row.date, locale)}
          {late && ` ${t.overdue}`}
        </span>
        <span className="text-sm text-muted-foreground">{shortDate(row.created_at.slice(0, 10), locale)}</span>
        <span className="tabular text-right font-medium">{money(group.total, locale)}</span>
        <span className="flex justify-end">
          {!paid && row.payment_url && (
            <a
              href={row.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-2 text-sm font-medium sm:py-1"
              style={payNowStyle(paymentStatus(row.date, row.grace_days, today))}
            >
              <ExternalLink className="h-3 w-3 shrink-0" /> {t.payNow}
            </a>
          )}
        </span>
        <button
          type="button"
          onClick={() => togglePaid(group)}
          className="tap-target mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border"
          style={{
            borderColor: paid ? "var(--primary)" : "var(--border)",
            background: paid ? "var(--primary)" : "transparent",
          }}
          aria-label={row.kind === "income" ? t.received : t.paid}
        >
          {paid && <Check className="h-3 w-3 text-primary-foreground" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="tap-target mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label={t.edit}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(group)}>
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(group)}>
              <Trash2 className="h-4 w-4" /> {t.del}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {split && expanded && (
        <div className="bg-muted/40 pb-1">
          {group.parts.map((part) => {
            const partCat = categoryById.get(part.category_id);
            return (
              <div key={part.id}>
                <div className="flex items-center gap-2 py-1.5 pr-3 pl-8 text-sm text-muted-foreground lg:hidden">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partCat?.color }} />
                  <span className="min-w-0 flex-1 truncate">
                    {part.split_label || (partCat ? categoryDisplayName(partCat.name, locale, partCat.name_en) : "")}
                  </span>
                  <span className="tabular shrink-0">{money(part.amount_cents, locale)}</span>
                </div>

                <div className={`${GRID} hidden items-center gap-1 px-2 py-1.5 text-sm lg:grid`}>
                  <span />
                  <span className="truncate pl-4 text-muted-foreground">{part.split_label || "—"}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partCat?.color }} />
                    {partCat ? categoryDisplayName(partCat.name, locale, partCat.name_en) : ""}
                  </span>
                  <span />
                  <span />
                  <span className="tabular text-right">{money(part.amount_cents, locale)}</span>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-base">
        <span className="text-muted-foreground">{t.sortBy}</span>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {(
            [
              ["date", t.sortByDate],
              ["created", t.sortByAdded],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className="min-h-9 rounded-full px-3 text-sm font-medium sm:min-h-7"
              style={
                sortKey === key
                  ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        {/* Szerokosc minimalna dopiero od lg, gdzie tabela ma sie gdzie zmiescic. Nizej
            wchodzi uklad dwuwierszowy, wiec przewijanie w poziomie nigdy nie jest potrzebne. */}
        <div className="lg:min-w-[812px]">
          {rows.length === 0 && drafts.length === 0 && (
            <div className="px-4 py-10 text-center text-base text-muted-foreground">{t.noUpcoming}</div>
          )}

          {(rows.length > 0 || drafts.length > 0) && (
            <div
              className={`${GRID} hidden items-center gap-1 border-b border-border bg-muted/50 px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid`}
            >
              <span />
              <span>{t.title}</span>
              <span>{t.category}</span>
              <span>{t.dueDate}</span>
              <span>{t.addedDate}</span>
              <span className="text-right">{t.amount}</span>
              <span />
              <span />
              <span />
            </div>
          )}

          {paidGroups.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPaid(!showPaid)}
                className="flex w-full items-center gap-2 px-2 py-2.5 text-base text-muted-foreground hover:bg-muted/50"
                aria-expanded={showPaid}
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showPaid ? "rotate(180deg)" : undefined }}
                />
                <span className="font-medium">
                  {t.paidSection} ({paidGroups.length})
                </span>
                <span className="tabular ml-auto">{money(paidTotal, locale)}</span>
              </button>
              {showPaid && paidGroups.map((group) => renderGroup(group, true))}
            </>
          )}

          {openGroups.map((group, i) => renderGroup(group, i > 0 || paidGroups.length > 0))}

          {/* Wiersze robocze tylko od sm — na telefonie dodaje sie przez przycisk +. */}
          {drafts.map((r, i) => {
            const isLast = i === drafts.length - 1;
            const cat = categoryById.get(r.categoryId);
            const cyclic = !!r.pattern;
            return (
              <div
                key={r.key}
                className={`${GRID} hidden items-center gap-1 border-t border-border bg-muted/40 px-2 py-1.5 text-base lg:grid`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const k = r.kind === "expense" ? "income" : "expense";
                    update(i, { kind: k, categoryId: catsOf(k)[0]?.id ?? "" });
                  }}
                  className="tap-target mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
                  style={{ color: r.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
                  aria-label={r.kind === "expense" ? t.expense : t.incomeOne}
                >
                  {r.kind === "expense" ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  )}
                </button>

                <div className="flex min-w-0 items-center gap-1">
                  <input
                    ref={isLast ? lastInputRef : null}
                    value={r.title}
                    placeholder="—"
                    onPaste={(e) => onPaste(e, i)}
                    onChange={(e) => update(i, { title: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, isLast)}
                    className="w-full min-w-0 rounded-sm bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {cyclic && <Repeat className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>

                <div className="flex min-w-0 items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
                  <CategoryCombobox
                    variant="inline"
                    options={catsOf(r.kind).map((c) => ({
                      id: c.id,
                      label: categoryDisplayName(c.name, locale, c.name_en),
                      emoji: c.emoji,
                    }))}
                    value={r.categoryId}
                    onChange={(categoryId) => update(i, { categoryId })}
                  />
                </div>

                <input
                  type="date"
                  value={r.date}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="w-full rounded-sm bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                {/* Kolumna "Dodano" — nowy wiersz dostanie te date dopiero przy zapisie. */}
                <span className="text-sm text-muted-foreground">—</span>

                <input
                  value={r.amount}
                  placeholder="0,00"
                  inputMode="decimal"
                  onChange={(e) => update(i, { amount: e.target.value })}
                  onKeyDown={(e) => onKeyDown(e, i, isLast)}
                  className="tabular w-full rounded-sm bg-transparent text-right text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setRecIdx(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-md sm:h-7 sm:w-7"
                    style={cyclic ? { color: "var(--primary)", background: "var(--neatly-primary-soft)" } : { color: "var(--muted-foreground)" }}
                    aria-label={t.recurrence}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground sm:h-7 sm:w-7"
                    aria-label={t.clearRow}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => update(i, { isPaid: !r.isPaid })}
                  className="tap-target mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: r.isPaid ? "var(--primary)" : "var(--border)",
                    background: r.isPaid ? "var(--primary)" : "transparent",
                  }}
                >
                  {r.isPaid && <Check className="h-3 w-3 text-primary-foreground" />}
                </button>

                <span />
              </div>
            );
          })}

          {rows.length > 0 && drafts.length === 0 && (
            <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2.5 text-base">
              <span className="font-medium">{openGroups.length} {t.rows}</span>
              <span className="tabular font-medium">{t.netTotal} {money(netTotal, locale)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 hidden flex-wrap items-center gap-3 lg:flex">
        <button
          type="button"
          onClick={addRow}
          className="flex min-h-11 items-center gap-1.5 text-base sm:min-h-0"
          style={{ color: "var(--neatly-primary-dark)" }}
        >
          <Plus className="h-3.5 w-3.5" /> {t.addRow}
        </button>
        {drafts.length > 0 && (
          <>
            <div className="flex-1" />
            <span className="text-base text-muted-foreground">
              {filled.length} {t.rows} · <span className="tabular text-foreground">{money(draftTotal, locale)}</span>
            </span>
            <button
              type="button"
              onClick={() => setDrafts([])}
              className="rounded-[10px] border border-border px-3 py-1.5 text-base font-medium hover:bg-muted"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || filled.length === 0}
              className="rounded-[10px] px-4 py-1.5 text-base font-medium text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {t.saveAll}
            </button>
          </>
        )}
      </div>
      {drafts.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{t.quickHint}</p>}
      {error && <p className="mt-2 text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

      {recIdx !== null && drafts[recIdx] && (
        <DraftRecurrenceDialog
          open
          onOpenChange={(open) => !open && setRecIdx(null)}
          initialPattern={drafts[recIdx].pattern}
          onApply={(pattern) => {
            update(recIdx, { pattern });
            setRecIdx(null);
          }}
        />
      )}

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
