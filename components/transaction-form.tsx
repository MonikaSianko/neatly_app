"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createTransaction, updateTransaction, type TransactionInput } from "@/lib/actions/transactions";
import { parseAmountToCents } from "@/lib/format";

type Category = { id: string; name: string; emoji: string; kind: "expense" | "income" };

export type EditingTransaction = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amountCents: number;
  categoryId: string;
  date: string;
  isPaid: boolean;
};

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

  const filteredCategories = categories.filter((c) => c.kind === kind);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (!amountCents) {
      setError("Podaj kwotę.");
      return;
    }
    const input: TransactionInput = { kind, title, amountCents, categoryId, date, isPaid };
    startTransition(async () => {
      const result = editing
        ? await updateTransaction(editing.id, input)
        : await createTransaction(householdId, walletId, input);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
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
  );
}
