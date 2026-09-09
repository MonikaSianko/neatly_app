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
  ArrowRightCircle,
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
import { deleteTransaction, moveTransactionToNextMonth } from "@/lib/actions/transactions";
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
};

/** Data platnosci to termin, data dodania to moment wpisania pozycji — to dwie rozne rzeczy. */
type SortKey = "date" | "created";

/** Jedna siatka dla naglowka, wierszy danych i wierszy roboczych — inaczej kolumny sie rozjezdzaja. */
const GRID = "grid grid-cols-[32px_1.6fr_1.2fr_120px_105px_125px_140px_36px_36px]";

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

  async function togglePaid(row: UpcomingRow) {
    const next = !isPaid(row);
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

  function requestDelete(row: UpcomingRow) {
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

  const sorted = (list: UpcomingRow[]) =>
    [...list].sort((a, b) =>
      sortKey === "created"
        ? b.created_at.localeCompare(a.created_at)
        : a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
    );

  const filled = drafts.filter((r) => r.title.trim() && (parseAmountToCents(r.amount) ?? 0) > 0);
  const draftTotal = filled.reduce((sum, r) => sum + (parseAmountToCents(r.amount) ?? 0), 0);
  const openRows = sorted(rows.filter((r) => !isPaid(r)));
  const paidRows = sorted(rows.filter(isPaid));
  const netTotal = openRows.reduce((sum, r) => sum + (r.kind === "income" ? r.amount_cents : -r.amount_cents), 0);
  const paidTotal = paidRows.reduce((sum, r) => sum + (r.kind === "income" ? r.amount_cents : -r.amount_cents), 0);

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

  /** Jedna siatka dla pozycji oplaconych i nieoplaconych, zeby kolumny wszedzie sie pokrywaly. */
  function renderRow(row: UpcomingRow, withBorder: boolean) {
    const cat = categoryById.get(row.category_id);
    const paid = isPaid(row);
    const late = !paid && row.date < today;

    return (
      <div
        key={row.id}
        className={`${GRID} items-center gap-1 px-2 py-2 text-base ${
          withBorder ? "border-t border-border" : ""
        } ${paid ? "text-muted-foreground" : ""}`}
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
        <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
          {cat ? categoryDisplayName(cat.name, locale, cat.name_en) : ""}
        </span>
        <span className="text-sm" style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}>
          {shortDate(row.date, locale)}
          {late && ` ${t.overdue}`}
        </span>
        <span className="text-sm text-muted-foreground">{shortDate(row.created_at.slice(0, 10), locale)}</span>
        <span className="tabular text-right font-medium">{money(row.amount_cents, locale)}</span>
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
          onClick={() => togglePaid(row)}
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
            <DropdownMenuItem
              onClick={() =>
                setEditing({
                  id: row.id,
                  kind: row.kind,
                  title: row.title,
                  amountCents: row.amount_cents,
                  categoryId: row.category_id,
                  date: row.date,
                  isPaid: paid,
                  paymentUrl: row.payment_url,
                  graceDays: row.grace_days,
                  note: row.note,
                  isAutomatic: row.is_automatic,
                  recurringRuleId: row.recurring_rule_id,
                  rule: row.recurring_rule_id ? rules[row.recurring_rule_id] ?? null : null,
                })
              }
            >
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveTransactionToNextMonth(row.id, row.date).then(() => router.refresh())}>
              <ArrowRightCircle className="h-4 w-4" /> {t.moveNext}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(row)}>
              <Trash2 className="h-4 w-4" /> {t.del}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-base">
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
        <div className="min-w-235">
          {rows.length === 0 && drafts.length === 0 && (
            <div className="px-4 py-10 text-center text-base text-muted-foreground">{t.noUpcoming}</div>
          )}

          {(rows.length > 0 || drafts.length > 0) && (
            <div
              className={`${GRID} items-center gap-1 border-b border-border bg-muted/50 px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase`}
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

          {openRows.map((row, i) => renderRow(row, i > 0))}

          {paidRows.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPaid(!showPaid)}
                className="flex w-full items-center gap-2 border-t border-border px-2 py-2.5 text-base text-muted-foreground hover:bg-muted/50"
                aria-expanded={showPaid}
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showPaid ? "rotate(180deg)" : undefined }}
                />
                <span className="font-medium">
                  {t.paidSection} ({paidRows.length})
                </span>
                <span className="tabular ml-auto">{money(paidTotal, locale)}</span>
              </button>
              {showPaid && paidRows.map((row) => renderRow(row, true))}
            </>
          )}

          {drafts.map((r, i) => {
            const isLast = i === drafts.length - 1;
            const cat = categoryById.get(r.categoryId);
            const cyclic = !!r.pattern;
            return (
              <div
                key={r.key}
                className={`${GRID} items-center gap-1 border-t border-border bg-muted/40 px-2 py-1.5 text-base`}
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
              <span className="font-medium">{openRows.length} {t.rows}</span>
              <span className="tabular font-medium">{t.netTotal} {money(netTotal, locale)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
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
