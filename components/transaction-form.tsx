"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, X, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import {
  createRecurringEntry,
  updateRecurringEntry,
  convertToRecurring,
  type RecurringEntryInput,
  type RecurrencePattern,
} from "@/lib/actions/recurring";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  createSplitTransaction,
  updateSplitTransaction,
  convertToSplit,
  mergeSplitToSingle,
} from "@/lib/actions/splits";
import { money } from "@/lib/format";
import { parseAmountToCents } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { WEEKDAYS, categoryDisplayName } from "@/lib/i18n";

type Category = { id: string; name: string; name_en: string | null; emoji: string; kind: "expense" | "income" };

export type EditingRule = {
  freq: "day" | "week" | "month" | "year";
  interval: number;
  weekdays: number[] | null;
  untilDate: string | null;
};

export type EditingSplitPart = { id: string; categoryId: string; amountCents: number; label: string | null };

export type EditingTransaction = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
  paymentUrl: string | null;
  graceDays: number;
  note: string | null;
  isAutomatic: boolean;
  recurringRuleId: string | null;
  rule?: EditingRule | null;
  /** Ustawione, gdy edytujemy platnosc podzielona na kategorie — wtedy id dotyczy grupy, nie wiersza. */
  splitGroupId?: string | null;
  splitParts?: EditingSplitPart[];
};

type PartDraft = { key: string; id?: string; categoryId: string; amount: string; label: string };

let partSeq = 0;
const newPart = (categoryId = ""): PartDraft => ({
  key: `part-${++partSeq}-${Date.now()}`,
  categoryId,
  amount: "",
  label: "",
});

type RepeatPreset = "never" | "day" | "week" | "weekdays" | "biweek" | "month" | "year" | "custom";

function presetFromRule(rule?: EditingRule | null): RepeatPreset {
  if (!rule) return "never";
  if (rule.freq === "day" && rule.interval === 1) return "day";
  if (rule.freq === "week" && rule.interval === 1 && !(rule.weekdays?.length)) return "week";
  if (rule.freq === "week" && rule.interval === 1 && rule.weekdays?.length) return "weekdays";
  if (rule.freq === "week" && rule.interval === 2) return "biweek";
  if (rule.freq === "month" && rule.interval === 1) return "month";
  if (rule.freq === "year" && rule.interval === 1) return "year";
  return "custom";
}

export function TransactionForm({
  open,
  onOpenChange,
  householdId,
  walletId,
  categories,
  defaultDate,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  walletId: string;
  categories: Category[];
  defaultDate: string;
  editing?: EditingTransaction | null;
}) {
  const { t } = useLocale();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? t.editEntry : t.newEntry}</SheetTitle>
        </SheetHeader>
        {open && (
          <TransactionFormFields
            key={editing?.id ?? "new"}
            onOpenChange={onOpenChange}
            householdId={householdId}
            walletId={walletId}
            categories={categories}
            defaultDate={defaultDate}
            editing={editing}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TransactionFormFields({
  onOpenChange,
  householdId,
  walletId,
  categories,
  defaultDate,
  editing,
}: {
  onOpenChange: (open: boolean) => void;
  householdId: string;
  walletId: string;
  categories: Category[];
  defaultDate: string;
  editing?: EditingTransaction | null;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const weekdayLabels = WEEKDAYS[locale];
  const [kind, setKind] = useState<"expense" | "income">(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [isPaid, setIsPaid] = useState(editing?.isPaid ?? false);
  const [paymentUrl, setPaymentUrl] = useState(editing?.paymentUrl ?? "");
  const [graceDays, setGraceDays] = useState(String(editing?.graceDays ?? 0));
  const [note, setNote] = useState(editing?.note ?? "");
  const [isAutomatic, setIsAutomatic] = useState(editing?.isAutomatic ?? false);
  const [isSplit, setIsSplit] = useState(!!editing?.splitGroupId);
  const [parts, setParts] = useState<PartDraft[]>(() =>
    editing?.splitParts?.length
      ? editing.splitParts.map((p) => ({
          key: `part-${++partSeq}`,
          id: p.id,
          categoryId: p.categoryId,
          amount: (p.amountCents / 100).toFixed(2).replace(".", ","),
          label: p.label ?? "",
        }))
      : [newPart(), newPart()]
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [repeat, setRepeat] = useState<RepeatPreset>(presetFromRule(editing?.rule));
  const [customFreq, setCustomFreq] = useState<"day" | "week" | "month" | "year">(editing?.rule?.freq ?? "month");
  const [customInterval, setCustomInterval] = useState(String(editing?.rule?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(editing?.rule?.weekdays ?? []);
  const [untilMode, setUntilMode] = useState<"never" | "date">(editing?.rule?.untilDate ? "date" : "never");
  const [untilDate, setUntilDate] = useState(editing?.rule?.untilDate ?? "");

  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingInput, setPendingInput] = useState<RecurringEntryInput | null>(null);

  const filteredCategories = categories.filter((c) => c.kind === kind);
  const isEditingRecurring = !!editing?.recurringRuleId;
  const categoryOptions = filteredCategories.map((c) => ({
    id: c.id,
    label: categoryDisplayName(c.name, locale, c.name_en),
    emoji: c.emoji,
  }));

  // Suma czesci musi trafic w kwote platnosci — inaczej wpis nie zgodzi sie z wyciagiem.
  const partsTotal = parts.reduce((sum, p) => sum + (parseAmountToCents(p.amount) ?? 0), 0);
  const remainder = (parseAmountToCents(amount) ?? 0) - partsTotal;

  function pattern(): RecurrencePattern | null {
    if (repeat === "never") return null;
    const map: Record<Exclude<RepeatPreset, "never" | "custom">, RecurrencePattern> = {
      day: { freq: "day", interval: 1, weekdays: [], untilDate: untilMode === "date" ? untilDate || null : null },
      week: { freq: "week", interval: 1, weekdays: [], untilDate: untilMode === "date" ? untilDate || null : null },
      weekdays: {
        freq: "week",
        interval: 1,
        weekdays: weekdays.length ? weekdays : [1],
        untilDate: untilMode === "date" ? untilDate || null : null,
      },
      biweek: { freq: "week", interval: 2, weekdays: [], untilDate: untilMode === "date" ? untilDate || null : null },
      month: { freq: "month", interval: 1, weekdays: [], untilDate: untilMode === "date" ? untilDate || null : null },
      year: { freq: "year", interval: 1, weekdays: [], untilDate: untilMode === "date" ? untilDate || null : null },
    };
    if (repeat === "custom") {
      return {
        freq: customFreq,
        interval: Math.max(1, Number(customInterval) || 1),
        weekdays: customFreq === "week" ? weekdays : [],
        untilDate: untilMode === "date" ? untilDate || null : null,
      };
    }
    return map[repeat];
  }

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (!amountCents || (!isSplit && !categoryId)) {
      setError(t.pickCatAmount);
      return;
    }

    const p = pattern();
    const normalizedPaymentUrl = paymentUrl.trim() || null;
    const normalizedGraceDays = Math.max(0, Number(graceDays) || 0);
    const normalizedNote = note.trim() || null;

    if (isSplit) {
      if (remainder !== 0) {
        setError(t.splitMismatch);
        return;
      }
      const splitInput = {
        kind,
        title,
        date,
        isPaid,
        paymentUrl: normalizedPaymentUrl,
        graceDays: normalizedGraceDays,
        note: normalizedNote,
        isAutomatic,
        parts: parts.map((part) => ({
          id: part.id,
          categoryId: part.categoryId,
          amountCents: parseAmountToCents(part.amount) ?? 0,
          label: part.label.trim() || null,
        })),
      };
      startTransition(async () => {
        // Kolejnosc ma znaczenie: edytowana pozycja musi zostac przerobiona, a nie zdublowana.
        const result = editing?.splitGroupId
          ? await updateSplitTransaction(editing.splitGroupId, splitInput)
          : editing
            ? await convertToSplit(editing.id, splitInput)
            : await createSplitTransaction(householdId, walletId, splitInput);
        if (result.error) {
          setError(result.error);
          return;
        }
        onOpenChange(false);
        router.refresh();
      });
      return;
    }

    if (isEditingRecurring) {
      setPendingInput({
        kind,
        title,
        amountCents,
        categoryId,
        date,
        isPaid,
        paymentUrl: normalizedPaymentUrl,
        graceDays: normalizedGraceDays,
        note: normalizedNote,
        isAutomatic,
        pattern: p ?? currentRuleAsPattern(),
      });
      setScopeOpen(true);
      return;
    }

    startTransition(async () => {
      let result: { error: string | null };
      if (editing) {
        const fields = {
          kind,
          title,
          amountCents,
          categoryId,
          date,
          isPaid,
          paymentUrl: normalizedPaymentUrl,
          graceDays: normalizedGraceDays,
          note: normalizedNote,
          isAutomatic,
        };
        if (editing.splitGroupId) {
          // Wylaczony podzial: zostaje jedna pozycja, nadmiarowe czesci znikaja.
          result = await mergeSplitToSingle(editing.splitGroupId, fields);
        } else if (p) {
          result = await convertToRecurring(editing.id, householdId, walletId, { ...fields, pattern: p });
        } else {
          result = await updateTransaction(editing.id, fields);
        }
      } else {
        result = p
          ? await createRecurringEntry(householdId, walletId, {
              kind,
              title,
              amountCents,
              categoryId,
              date,
              isPaid,
              paymentUrl: normalizedPaymentUrl,
              graceDays: normalizedGraceDays,
              note: normalizedNote,
              isAutomatic,
              pattern: p,
            })
          : await createTransaction(householdId, walletId, {
              kind,
              title,
              amountCents,
              categoryId,
              date,
              isPaid,
              paymentUrl: normalizedPaymentUrl,
              graceDays: normalizedGraceDays,
              note: normalizedNote,
              isAutomatic,
            });
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  function currentRuleAsPattern(): RecurrencePattern {
    return {
      freq: editing!.rule!.freq,
      interval: editing!.rule!.interval,
      weekdays: editing!.rule!.weekdays ?? [],
      untilDate: editing!.rule!.untilDate,
    };
  }

  function pickScope(scope: Scope) {
    if (!editing || !pendingInput) return;
    setScopeOpen(false);
    startTransition(async () => {
      const result = await updateRecurringEntry(editing.id, scope, pendingInput);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className="rounded-full p-2"
            style={kind === "expense" ? { background: "var(--neatly-danger-soft)", color: "var(--destructive)" } : { color: "var(--muted-foreground)" }}
            aria-label={t.expense}
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="tabular w-40 rounded-[10px] border border-border bg-muted px-3 py-2 text-center text-[34px] font-semibold"
          />
          <button
            type="button"
            onClick={() => setKind("income")}
            className="rounded-full p-2"
            style={kind === "income" ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" } : { color: "var(--muted-foreground)" }}
            aria-label={t.incomeOne}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.title}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.category}</label>
          {isSplit ? (
            <div className="flex flex-col gap-2">
              {parts.map((part, i) => (
                <div key={part.key} className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <CategoryCombobox
                      options={categoryOptions}
                      value={part.categoryId}
                      onChange={(categoryId) =>
                        setParts((prev) => prev.map((p, k) => (k === i ? { ...p, categoryId } : p)))
                      }
                    />
                    <input
                      value={part.label}
                      placeholder={t.splitLabel}
                      onChange={(e) =>
                        setParts((prev) => prev.map((p, k) => (k === i ? { ...p, label: e.target.value } : p)))
                      }
                      className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={part.amount}
                    placeholder="0,00"
                    inputMode="decimal"
                    onChange={(e) =>
                      setParts((prev) => prev.map((p, k) => (k === i ? { ...p, amount: e.target.value } : p)))
                    }
                    className="tabular min-h-11 w-28 rounded-[10px] border border-border bg-muted px-3 text-right text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setParts((prev) => prev.filter((_, k) => k !== i))}
                    disabled={parts.length <= 2}
                    className="flex min-h-11 w-9 items-center justify-center rounded-[10px] text-muted-foreground disabled:opacity-30"
                    aria-label={t.clearRow}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setParts((prev) => [...prev, newPart()])}
                  className="flex min-h-11 items-center gap-1.5 text-sm font-medium sm:min-h-9"
                  style={{ color: "var(--neatly-primary-dark)" }}
                >
                  <Plus className="h-4 w-4" /> {t.addPart}
                </button>
                <span
                  className="tabular text-sm font-medium"
                  style={{ color: remainder === 0 ? "var(--neatly-success)" : "var(--destructive)" }}
                >
                  {t.splitRemainder} {money(remainder, locale)}
                </span>
              </div>
            </div>
          ) : (
            <CategoryCombobox options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          )}

          {!isEditingRecurring && repeat === "never" && (
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => setIsSplit(e.target.checked)}
                className="h-4 w-4 rounded-[6px]"
              />
              {t.splitToggle}
            </label>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.date}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.repeat}</label>
          <select
            value={repeat}
            disabled={isSplit}
            onChange={(e) => setRepeat(e.target.value as RepeatPreset)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base disabled:opacity-60"
          >
            <option value="never">{t.never}</option>
            <option value="day">{t.daily}</option>
            <option value="week">{t.weekly}</option>
            <option value="weekdays">{t.pickedDays}</option>
            <option value="biweek">{t.biweekly}</option>
            <option value="month">{t.monthly}</option>
            <option value="year">{t.yearly}</option>
            <option value="custom">{t.custom}</option>
          </select>
          {isSplit && <p className="mt-1 text-sm text-muted-foreground">{t.splitNoRepeat}</p>}
        </div>

        {repeat === "weekdays" && (
          <div className="flex flex-wrap gap-1.5">
            {weekdayLabels.map((label, i) => {
              const d = i + 1;
              const active = weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium"
                  style={active ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {repeat === "custom" && (
          <div className="flex items-end gap-2">
            <div>
              <input
                type="number"
                min={1}
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                className="w-16 rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
              />
            </div>
            <select
              value={customFreq}
              onChange={(e) => setCustomFreq(e.target.value as typeof customFreq)}
              className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
            >
              <option value="day">{t.daily}</option>
              <option value="week">{t.weekly}</option>
              <option value="month">{t.monthly}</option>
              <option value="year">{t.yearly}</option>
            </select>
          </div>
        )}

        {repeat === "custom" && customFreq === "week" && (
          <div className="flex flex-wrap gap-1.5">
            {weekdayLabels.map((label, i) => {
              const d = i + 1;
              const active = weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium"
                  style={active ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {repeat !== "never" && (
          <div>
            <label className="mb-1.5 block text-base font-medium">{t.until}</label>
            <div className="flex gap-2">
              <select
                value={untilMode}
                onChange={(e) => setUntilMode(e.target.value as "never" | "date")}
                className="rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
              >
                <option value="never">{t.noEnd}</option>
                <option value="date">{t.untilDay}</option>
              </select>
              {untilMode === "date" && (
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
                />
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.noteOptional}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-base font-medium">{t.paymentUrlOptional}</label>
          <input
            type="url"
            value={paymentUrl}
            onChange={(e) => setPaymentUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
          />
        </div>

        {paymentUrl.trim() && (
          <div>
            <label className="mb-1.5 block text-base font-medium">{t.graceDays}</label>
            <input
              type="number"
              min={0}
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
              className="w-24 rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
            />
            <p className="mt-1 text-sm text-muted-foreground">{t.graceDaysHint}</p>
          </div>
        )}

        <label className="flex min-h-11 items-center gap-2 text-base sm:min-h-0">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="h-4 w-4 rounded-[6px]"
          />
          {kind === "income" ? t.received : t.paid}
        </label>

        <div>
          <label className="flex min-h-11 items-center gap-2 text-base sm:min-h-0">
            <input
              type="checkbox"
              checked={isAutomatic}
              onChange={(e) => setIsAutomatic(e.target.checked)}
              className="h-4 w-4 rounded-[6px]"
            />
            <Zap className="h-4 w-4 text-muted-foreground" />
            {t.automatic}
          </label>
          <p className="mt-1 text-sm text-muted-foreground">{t.automaticHint}</p>
        </div>

        {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] px-4 py-2.5 text-base font-medium text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {t.save}
        </button>
      </form>

      <ScopeDialog open={scopeOpen} onOpenChange={setScopeOpen} title={t.scopeEditTitle} onPick={pickScope} />
    </>
  );
}
