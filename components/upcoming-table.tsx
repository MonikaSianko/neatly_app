"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, MoreVertical, X, Repeat, Check } from "lucide-react";
import { DraftRecurrenceDialog } from "@/components/draft-recurrence-dialog";
import { saveDraftRows, type DraftRowInput } from "@/lib/actions/drafts";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate, parseAmountToCents } from "@/lib/format";
import type { RecurrencePattern } from "@/lib/actions/recurring";
import { useLocale } from "@/components/locale-provider";
import { categoryDisplayName } from "@/lib/i18n";

type Category = { id: string; name: string; emoji: string; color: string; kind: "expense" | "income" };

export type UpcomingRow = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amount_cents: number;
  category_id: string;
  date: string;
  recurring_rule_id: string | null;
};

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
  today,
  defaultDate,
}: {
  rows: UpcomingRow[];
  categories: Category[];
  householdId: string;
  walletId: string;
  today: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [recIdx, setRecIdx] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
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

  async function togglePaid(row: UpcomingRow) {
    const next = !(overrides[row.id] ?? false);
    setOverrides((prev) => ({ ...prev, [row.id]: next }));
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
      .eq("id", row.id);
    if (error) {
      setOverrides((prev) => ({ ...prev, [row.id]: false }));
      return;
    }
    router.refresh();
  }

  const filled = drafts.filter((r) => r.title.trim() && (parseAmountToCents(r.amount) ?? 0) > 0);
  const draftTotal = filled.reduce((sum, r) => sum + (parseAmountToCents(r.amount) ?? 0), 0);
  const visibleRows = rows.filter((r) => !overrides[r.id]);
  const netTotal = visibleRows.reduce((sum, r) => sum + (r.kind === "income" ? r.amount_cents : -r.amount_cents), 0);

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

  return (
    <>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        <div className="min-w-[660px]">
          {rows.length === 0 && drafts.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t.noUpcoming}</div>
          )}

          {visibleRows.map((row, i) => {
            const cat = categoryById.get(row.category_id);
            const late = row.date < today;
            return (
              <div
                key={row.id}
                className={`grid grid-cols-[32px_1.6fr_1.2fr_100px_100px_36px] items-center gap-1 px-2 py-2 text-sm ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span
                  className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
                  style={{ color: row.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
                >
                  {row.kind === "expense" ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {row.title}
                  {row.recurring_rule_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
                  {cat ? categoryDisplayName(cat.name, locale) : ""}
                </span>
                <span className="text-xs" style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}>
                  {shortDate(row.date, locale)}
                  {late && ` ${t.overdue}`}
                </span>
                <span className="tabular text-right font-medium">{money(row.amount_cents, locale)}</span>
                <button
                  type="button"
                  onClick={() => togglePaid(row)}
                  className="mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border border-border"
                  aria-label={row.kind === "income" ? t.received : t.paid}
                />
              </div>
            );
          })}

          {drafts.map((r, i) => {
            const isLast = i === drafts.length - 1;
            const cat = categoryById.get(r.categoryId);
            const cyclic = !!r.pattern;
            return (
              <div
                key={r.key}
                className="grid grid-cols-[32px_1.6fr_1.2fr_120px_100px_36px_44px] items-center gap-1 border-t border-border bg-muted/40 px-2 py-1.5 text-sm"
              >
                <button
                  type="button"
                  onClick={() => {
                    const k = r.kind === "expense" ? "income" : "expense";
                    update(i, { kind: k, categoryId: catsOf(k)[0]?.id ?? "" });
                  }}
                  className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
                  style={{ color: r.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
                >
                  {r.kind === "expense" ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </button>

                <div className="flex min-w-0 items-center gap-1">
                  <input
                    ref={isLast ? lastInputRef : null}
                    value={r.title}
                    placeholder="—"
                    onPaste={(e) => onPaste(e, i)}
                    onChange={(e) => update(i, { title: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, isLast)}
                    className="w-full min-w-0 rounded-sm bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {cyclic && <Repeat className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>

                <div className="flex min-w-0 items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
                  <select
                    value={r.categoryId}
                    onChange={(e) => update(i, { categoryId: e.target.value })}
                    className="w-full min-w-0 rounded-sm bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {catsOf(r.kind).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {categoryDisplayName(c.name, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="date"
                  value={r.date}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="w-full rounded-sm bg-transparent text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <input
                  value={r.amount}
                  placeholder="0,00"
                  inputMode="decimal"
                  onChange={(e) => update(i, { amount: e.target.value })}
                  onKeyDown={(e) => onKeyDown(e, i, isLast)}
                  className="tabular w-full rounded-sm bg-transparent text-right text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <button
                  type="button"
                  onClick={() => update(i, { isPaid: !r.isPaid })}
                  className="mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: r.isPaid ? "var(--primary)" : "var(--border)",
                    background: r.isPaid ? "var(--primary)" : "transparent",
                  }}
                >
                  {r.isPaid && <Check className="h-3 w-3 text-primary-foreground" />}
                </button>

                <div className="flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRecIdx(i)}
                    className="rounded-md p-1"
                    style={cyclic ? { color: "var(--primary)", background: "var(--neatly-primary-soft)" } : { color: "var(--muted-foreground)" }}
                    aria-label={t.recurrence}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeRow(i)} className="p-1 text-muted-foreground" aria-label={t.clearRow}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {rows.length > 0 && drafts.length === 0 && (
            <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2.5 text-sm">
              <span className="font-medium">{visibleRows.length} {t.rows}</span>
              <span className="tabular font-medium">{t.netTotal} {money(netTotal, locale)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--neatly-primary-dark)" }}>
          <Plus className="h-3.5 w-3.5" /> {t.addRow}
        </button>
        {drafts.length > 0 && (
          <>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              {filled.length} {t.rows} · <span className="tabular text-foreground">{money(draftTotal, locale)}</span>
            </span>
            <button
              type="button"
              onClick={() => setDrafts([])}
              className="rounded-[10px] border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || filled.length === 0}
              className="rounded-[10px] px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {t.saveAll}
            </button>
          </>
        )}
      </div>
      {drafts.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t.quickHint}</p>}
      {error && <p className="mt-2 text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}

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
    </>
  );
}
