"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createTransaction, updateTransaction, deleteTransaction } from "@/lib/actions/transactions";
import {
  createRecurringEntry,
  updateRecurringEntry,
  type RecurringEntryInput,
  type RecurrencePattern,
} from "@/lib/actions/recurring";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { parseAmountToCents } from "@/lib/format";

type Category = { id: string; name: string; emoji: string; kind: "expense" | "income" };

export type EditingRule = {
  freq: "day" | "week" | "month" | "year";
  interval: number;
  weekdays: number[] | null;
  untilDate: string | null;
};

export type EditingTransaction = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
  recurringRuleId: string | null;
  rule?: EditingRule | null;
};

const WEEKDAY_LABELS = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];

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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Edytuj pozycję" : "Nowa pozycja"}</SheetTitle>
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
  const [kind, setKind] = useState<"expense" | "income">(editing?.kind ?? "expense");
  const [amount, setAmount] = useState(editing ? (editing.amountCents / 100).toFixed(2).replace(".", ",") : "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [date, setDate] = useState(editing?.date ?? defaultDate);
  const [isPaid, setIsPaid] = useState(editing?.isPaid ?? false);
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
    if (!amountCents) {
      setError("Podaj kwotę.");
      return;
    }
    if (!categoryId) {
      setError("Wybierz kategorię.");
      return;
    }

    const p = pattern();

    if (isEditingRecurring) {
      setPendingInput({ kind, title, amountCents, categoryId, date, isPaid, pattern: p ?? currentRuleAsPattern() });
      setScopeOpen(true);
      return;
    }

    startTransition(async () => {
      let result: { error: string | null };
      if (editing) {
        if (p) {
          await deleteTransaction(editing.id);
          result = await createRecurringEntry(householdId, walletId, { kind, title, amountCents, categoryId, date, isPaid, pattern: p });
        } else {
          result = await updateTransaction(editing.id, { kind, title, amountCents, categoryId, date, isPaid });
        }
      } else {
        result = p
          ? await createRecurringEntry(householdId, walletId, { kind, title, amountCents, categoryId, date, isPaid, pattern: p })
          : await createTransaction(householdId, walletId, { kind, title, amountCents, categoryId, date, isPaid });
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
            aria-label="Wydatek"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="tabular w-40 rounded-[10px] border border-border bg-muted px-3 py-2 text-center text-[30px] font-semibold"
          />
          <button
            type="button"
            onClick={() => setKind("income")}
            className="rounded-full p-2"
            style={kind === "income" ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" } : { color: "var(--muted-foreground)" }}
            aria-label="Przychód"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Tytuł</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Kategoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
          >
            <option value="">Wybierz kategorię</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Powtarzaj</label>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatPreset)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
          >
            <option value="never">Nigdy</option>
            <option value="day">Codziennie</option>
            <option value="week">Co tydzień</option>
            <option value="weekdays">Wybrane dni tygodnia</option>
            <option value="biweek">Co dwa tygodnie</option>
            <option value="month">Co miesiąc</option>
            <option value="year">Co rok</option>
            <option value="custom">Niestandardowo</option>
          </select>
        </div>

        {repeat === "weekdays" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const d = i + 1;
              const active = weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
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
              <label className="mb-1.5 block text-sm font-medium">Co</label>
              <input
                type="number"
                min={1}
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                className="w-16 rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              />
            </div>
            <select
              value={customFreq}
              onChange={(e) => setCustomFreq(e.target.value as typeof customFreq)}
              className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
            >
              <option value="day">dni</option>
              <option value="week">tygodni</option>
              <option value="month">miesięcy</option>
              <option value="year">lat</option>
            </select>
          </div>
        )}

        {repeat === "custom" && customFreq === "week" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const d = i + 1;
              const active = weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
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
            <label className="mb-1.5 block text-sm font-medium">Do kiedy</label>
            <div className="flex gap-2">
              <select
                value={untilMode}
                onChange={(e) => setUntilMode(e.target.value as "never" | "date")}
                className="rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              >
                <option value="never">Bez końca</option>
                <option value="date">Do dnia</option>
              </select>
              {untilMode === "date" && (
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
                />
              )}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="h-4 w-4 rounded-[6px]"
          />
          {kind === "income" ? "Otrzymane" : "Opłacone"}
        </label>

        {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          Zapisz
        </button>
      </form>

      <ScopeDialog open={scopeOpen} onOpenChange={setScopeOpen} title="Zapisz zmianę" onPick={pickScope} />
    </>
  );
}
