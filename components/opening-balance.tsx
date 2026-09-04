"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, CornerDownRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { setMonthOpening, carryOverOpening } from "@/lib/actions/budgets";
import { money } from "@/lib/format";
import type { YearMonth } from "@/lib/month";

export function OpeningBalance({
  householdId,
  walletId,
  ym,
  openingCents,
}: {
  householdId: string;
  walletId: string;
  ym: YearMonth;
  openingCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((openingCents / 100).toFixed(2).replace(".", ","));
  const [pending, startTransition] = useTransition();

  function save() {
    const cents = Math.round(parseFloat(amount.replace(/\s/g, "").replace(",", ".") || "0") * 100);
    startTransition(async () => {
      await setMonthOpening(householdId, walletId, ym, cents);
      setOpen(false);
      router.refresh();
    });
  }

  function carryOver() {
    startTransition(async () => {
      const result = await carryOverOpening(householdId, walletId, ym);
      if (result.amountCents != null) setAmount((result.amountCents / 100).toFixed(2).replace(".", ","));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAmount((openingCents / 100).toFixed(2).replace(".", ","));
          setOpen(true);
        }}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        Stan początkowy
        <span className="tabular font-medium text-foreground">{money(openingCents)}</span>
        <Pencil className="h-3 w-3" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Stan początkowy miesiąca</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Kwota</label>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ile masz na koncie pierwszego dnia miesiąca. Nic nie przenosi się automatycznie — wpisujesz albo
              przenosisz jednym kliknięciem.
            </p>
            <button
              type="button"
              onClick={carryOver}
              disabled={pending}
              className="flex w-fit items-center gap-1.5 text-sm disabled:opacity-50"
              style={{ color: "var(--neatly-primary-dark)" }}
            >
              <CornerDownRight className="h-3.5 w-3.5" /> Przenieś z poprzedniego miesiąca
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Anuluj
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
