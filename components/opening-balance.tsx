"use client";

import { useState } from "react";
import { Pencil, CornerDownRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { setMonthOpening, carryOverOpening } from "@/lib/actions/budgets";
import { money } from "@/lib/format";
import type { YearMonth } from "@/lib/month";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";

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
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((openingCents / 100).toFixed(2).replace(".", ","));
  const { pending, busy, error, run } = useAction();

  function save() {
    const cents = Math.round(parseFloat(amount.replace(/\s/g, "").replace(",", ".") || "0") * 100);
    run(() => setMonthOpening(householdId, walletId, ym, cents), {
      key: "save",
      onSuccess: () => setOpen(false),
    });
  }

  function carryOver() {
    run(
      async () => {
        const result = await carryOverOpening(householdId, walletId, ym);
        if (result.amountCents != null) setAmount((result.amountCents / 100).toFixed(2).replace(".", ","));
        setOpen(false);
      },
      { key: "carry" }
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAmount((openingCents / 100).toFixed(2).replace(".", ","));
          setOpen(true);
        }}
        className="flex items-center gap-1 text-base text-muted-foreground"
      >
        {t.opening}
        <span className="tabular font-medium text-foreground">{money(openingCents, locale)}</span>
        <Pencil className="h-3 w-3" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{t.editOpening}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <label className="mb-1.5 block text-base font-medium">{t.amount}</label>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
              />
            </div>
            <p className="text-sm text-muted-foreground">{t.openingHint}</p>
            {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
            <button
              type="button"
              onClick={carryOver}
              disabled={pending}
              className="flex w-fit items-center gap-1.5 text-base disabled:opacity-50"
              style={{ color: "var(--neatly-primary-dark)" }}
            >
              {busy("carry") ? <Spinner className="h-3.5 w-3.5" /> : <CornerDownRight className="h-3.5 w-3.5" />}
              {t.carryPrev}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {busy("save") && <Spinner />}
                {t.save}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-border px-4 py-2.5 text-base font-medium hover:bg-muted"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
