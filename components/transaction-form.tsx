"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Undo2, X, Zap } from "lucide-react";
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
import { listRefundTargets, type RefundTarget } from "@/lib/actions/refunds";
import {
  createSplitTransaction,
  updateSplitTransaction,
  convertToSplit,
  mergeSplitToSingle,
} from "@/lib/actions/splits";
import { money, shortDate } from "@/lib/format";
import { parseAmountToCents } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useAction } from "@/lib/use-action";
import { startPendingRow, endPendingRow } from "@/lib/pending-rows";
import { Spinner } from "@/components/ui/spinner";
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
  /** Zwrot: przychod zwracajacy konkretny wydatek, ksiegowany w jego kategorii. */
  isRefund?: boolean;
  refundOfId?: string | null;
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
  prefill,
  onSaved,
  onSavingChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  walletId: string;
  categories: Category[];
  defaultDate: string;
  editing?: EditingTransaction | null;
  /**
   * Wartosci poczatkowe dla nowej pozycji — bez id, wiec zapis tworzy wpis, a nie aktualizuje.
   * Stad wiersz roboczy szybkiego dodawania otwiera ten sam formularz co kazda inna pozycja.
   */
  prefill?: Partial<EditingTransaction>;
  /** Wywolywane po udanym zapisie, gdy samo zamkniecie arkusza to za malo (np. zdjecie wiersza roboczego). */
  onSaved?: () => void;
  /** Mowi liscie, ze zapis trwa — edytowany wiersz moze wtedy schowac nieaktualne juz dane. */
  onSavingChange?: (saving: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="full" className="gap-0 overflow-hidden">
        <SheetHeader className="shrink-0 border-b border-border">
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
            prefill={prefill}
            onSaved={onSaved}
            onSavingChange={onSavingChange}
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
  prefill,
  onSaved,
  onSavingChange,
}: {
  onOpenChange: (open: boolean) => void;
  householdId: string;
  walletId: string;
  categories: Category[];
  defaultDate: string;
  editing?: EditingTransaction | null;
  prefill?: Partial<EditingTransaction>;
  onSaved?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const weekdayLabels = WEEKDAYS[locale];
  // Edycja karmi formularz istniejacym wpisem, wartosci wstepne — swiezym wierszem roboczym.
  const initial = editing ?? prefill;
  const [kind, setKind] = useState<"expense" | "income">(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(initial?.amountCents ? (initial.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [isPaid, setIsPaid] = useState(initial?.isPaid ?? false);
  const [paymentUrl, setPaymentUrl] = useState(initial?.paymentUrl ?? "");
  const [graceDays, setGraceDays] = useState(String(initial?.graceDays ?? 0));
  const [note, setNote] = useState(initial?.note ?? "");
  const [isAutomatic, setIsAutomatic] = useState(initial?.isAutomatic ?? false);
  const [isSplit, setIsSplit] = useState(!!initial?.splitGroupId);
  const [isRefund, setIsRefund] = useState(!!initial?.isRefund);
  const [refundOfId, setRefundOfId] = useState<string | null>(initial?.refundOfId ?? null);
  const [refundTargets, setRefundTargets] = useState<RefundTarget[] | null>(null);
  const [parts, setParts] = useState<PartDraft[]>(() =>
    initial?.splitParts?.length
      ? initial.splitParts.map((p) => ({
          key: `part-${++partSeq}`,
          id: p.id,
          categoryId: p.categoryId,
          amount: (p.amountCents / 100).toFixed(2).replace(".", ","),
          label: p.label ?? "",
        }))
      : [newPart(), newPart()]
  );
  const { pending, error, setError, run } = useAction();

  const [repeat, setRepeat] = useState<RepeatPreset>(presetFromRule(initial?.rule));
  const [customFreq, setCustomFreq] = useState<"day" | "week" | "month" | "year">(initial?.rule?.freq ?? "month");
  const [customInterval, setCustomInterval] = useState(String(initial?.rule?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<number[]>(initial?.rule?.weekdays ?? []);
  const [untilMode, setUntilMode] = useState<"never" | "date">(initial?.rule?.untilDate ? "date" : "never");
  const [untilDate, setUntilDate] = useState(initial?.rule?.untilDate ?? "");

  /** Udany zapis zamyka arkusz; wiersz roboczy ma sie wtedy dodatkowo zdjac z listy. */
  function finishSave() {
    onOpenChange(false);
    onSaved?.();
  }

  /**
   * Nowa pozycja pojawi sie w tabeli dopiero po odswiezeniu, a arkusz zamyka sie wczesniej —
   * do tego czasu tabela trzyma w jej miejscu szkielet. Przy edycji nie ma czego zapowiadac,
   * bo wiersz juz tam stoi.
   */
  const announcesNewRow = !editing;

  function beginSave() {
    if (announcesNewRow) startPendingRow();
  }

  function failedSave() {
    if (announcesNewRow) endPendingRow();
  }

  const keyboardInset = useKeyboardInset();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingInput, setPendingInput] = useState<RecurringEntryInput | null>(null);

  /**
   * Zapis zamyka arkusz, zanim serwer odesle nowe dane, wiec lista musi wiedziec, ze czeka —
   * inaczej przez chwile pokazuje stare kwoty jak gdyby nigdy nic. Ref pilnuje, zeby zgloszenie
   * szlo tylko przy zmianie stanu, a nie przy kazdym renderze.
   */
  const reportedSaving = useRef(false);
  useEffect(() => {
    if (reportedSaving.current === pending) return;
    reportedSaving.current = pending;
    onSavingChange?.(pending);
  }, [pending, onSavingChange]);

  // Lista platnosci jedzie z serwera dopiero, gdy zwrot jest zaznaczony — i tylko raz na otwarcie.
  useEffect(() => {
    if (!isRefund || refundTargets) return;
    let alive = true;
    listRefundTargets(householdId, walletId, editing?.refundOfId ?? null).then((result) => {
      if (alive) setRefundTargets(result.targets);
    });
    return () => {
      alive = false;
    };
  }, [isRefund, refundTargets, householdId, walletId, editing?.refundOfId]);

  const filteredCategories = categories.filter((c) => c.kind === kind);
  const isEditingRecurring = !!editing?.recurringRuleId;
  const categoryOptions = filteredCategories.map((c) => ({
    id: c.id,
    label: categoryDisplayName(c.name, locale, c.name_en),
    emoji: c.emoji,
  }));

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const refundTargetOptions = (refundTargets ?? []).map((target) => ({
    id: target.id,
    label: target.splitLabel ? `${target.title} — ${target.splitLabel}` : target.title,
    emoji: categoryById.get(target.categoryId)?.emoji ?? "",
    hint: `${money(target.amountCents, locale)} · ${shortDate(target.date, locale)}`,
  }));
  const refundCategory = categoryById.get(categoryId);
  // Zwrot zawsze wchodzi do kategorii zwracanej platnosci — zeby roznica zostala w jednym miejscu.
  const refundTargetMissing =
    isRefund && !!refundOfId && !!refundTargets && !refundTargets.some((x) => x.id === refundOfId);

  function pickRefundTarget(id: string) {
    setRefundOfId(id);
    const target = refundTargets?.find((x) => x.id === id);
    if (target) setCategoryId(target.categoryId);
  }

  /** Zwrot jest przychodem w kategorii wydatku, wiec przelaczenie na wydatek go odwoluje. */
  function pickKind(next: "expense" | "income") {
    setKind(next);
    if (next === "expense" && isRefund) toggleRefund(false);
  }

  function toggleRefund(next: boolean) {
    setIsRefund(next);
    // Zwrot to zawsze pieniadze wracajace, wiec zaznaczenie przestawia tez rodzaj — inaczej
    // checkbox bylby widoczny dopiero po recznym przelaczeniu na przychod.
    if (next) setKind("income");
    // Kategoria zwrotu nalezy do platnosci, wiec po obu stronach przelacznika trzeba wybrac ja od nowa.
    setCategoryId("");
    setRefundOfId(null);
  }

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
    if (isRefund && !refundOfId) {
      setError(t.refundNoTarget);
      return;
    }
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
      beginSave();
      run(
        // Kolejnosc ma znaczenie: edytowana pozycja musi zostac przerobiona, a nie zdublowana.
        () =>
          editing?.splitGroupId
            ? updateSplitTransaction(editing.splitGroupId, splitInput)
            : editing
              ? convertToSplit(editing.id, splitInput)
              : createSplitTransaction(householdId, walletId, splitInput),
        { onSuccess: finishSave, onError: failedSave }
      );
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

    beginSave();
    run(
      async () => {
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
            isRefund,
            refundOfId,
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
                isRefund,
                refundOfId,
              });
        }
        return result;
      },
      { onSuccess: finishSave, onError: failedSave }
    );
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
    run(() => updateRecurringEntry(editing.id, scope, pendingInput), { onSuccess: finishSave });
  }

  return (
    <>
      {/* Padding rowny klawiaturze — dzieki niemu formularz przewija sie tez przy otwartej klawiaturze. */}
      <form
        onSubmit={submit}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-4"
        style={{ paddingBottom: `calc(${keyboardInset}px + env(safe-area-inset-bottom) + 1rem)` }}
      >
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => pickKind("expense")}
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
            onClick={() => pickKind("income")}
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
          <label className="mb-1.5 block text-base font-medium">{isRefund ? t.refundPick : t.category}</label>
          {isRefund ? (
            <RefundPicker
              targets={refundTargets}
              options={refundTargetOptions}
              value={refundOfId}
              onPick={pickRefundTarget}
              category={refundCategory ? `${refundCategory.emoji} ${categoryDisplayName(refundCategory.name, locale, refundCategory.name_en)}` : null}
              missing={refundTargetMissing}
            />
          ) : isSplit ? (
            <div className="flex flex-col gap-2">
              {parts.map((part, i) => (
                <div key={part.key} className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <CategoryCombobox
                      fullscreenOnMobile
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
            <CategoryCombobox fullscreenOnMobile options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          )}

          {!isEditingRecurring && repeat === "never" && !isRefund && (
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

          {/* Zwrot to przychod doklejony do wydatku — zaznaczenie samo przestawia rodzaj na przychod. */}
          {!isEditingRecurring && repeat === "never" && !isSplit && (
            <div className="mt-2">
              <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
                <input
                  type="checkbox"
                  checked={isRefund}
                  onChange={(e) => toggleRefund(e.target.checked)}
                  className="h-4 w-4 rounded-[6px]"
                />
                <Undo2 className="h-4 w-4 text-muted-foreground" />
                {t.refundToggle}
              </label>
              {isRefund && <p className="mt-1 text-sm text-muted-foreground">{t.refundHint}</p>}
            </div>
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
            disabled={isSplit || isRefund}
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
          {isRefund && <p className="mt-1 text-sm text-muted-foreground">{t.refundNoRepeat}</p>}
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
          className="flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {pending && <Spinner />}
          {t.save}
        </button>
      </form>

      <ScopeDialog open={scopeOpen} onOpenChange={setScopeOpen} title={t.scopeEditTitle} onPick={pickScope} />
    </>
  );
}

/**
 * Wybor zwracanej platnosci. Kategoria nie jest tu do wyboru — bierze sie z platnosci,
 * inaczej zwrot wyladowalby w innej kategorii niz wydatek, ktory ma pomniejszyc.
 */
function RefundPicker({
  targets,
  options,
  value,
  onPick,
  category,
  missing,
}: {
  targets: RefundTarget[] | null;
  options: { id: string; label: string; emoji: string; hint: string }[];
  value: string | null;
  onPick: (id: string) => void;
  category: string | null;
  missing: boolean;
}) {
  const { t } = useLocale();

  if (!targets) return <p className="text-sm text-muted-foreground">{t.loading}</p>;
  if (targets.length === 0) return <p className="text-sm text-muted-foreground">{t.refundNoTargets}</p>;

  return (
    <div className="flex flex-col gap-1.5">
      <CategoryCombobox
        fullscreenOnMobile
        options={options}
        value={missing ? "" : (value ?? "")}
        onChange={onPick}
        placeholder={t.refundPickPlaceholder}
        title={t.refundPickTitle}
        searchPlaceholder={t.refundSearchPayment}
      />
      {missing ? (
        <p className="text-sm" style={{ color: "var(--destructive)" }}>{t.refundOrphan}</p>
      ) : category ? (
        <p className="text-sm text-muted-foreground">
          {t.category}: {category}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t.refundCategoryFrom}</p>
      )}
    </div>
  );
}
