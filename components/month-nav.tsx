"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type YearMonth, monthKey, monthLabel, shiftMonth } from "@/lib/month";
import { useLocale } from "@/components/locale-provider";

const INTL_LOCALE = { pl: "pl-PL", en: "en-GB" } as const;

export function MonthNav({ ym }: { ym: YearMonth }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(ym.y);

  function go(next: YearMonth) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthKey(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  const monthShort = (i: number) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short" }).format(new Date(2026, i, 1));

  return (
    <div className="relative flex items-center justify-center gap-0.5">
      <button
        type="button"
        aria-label="Poprzedni miesiąc"
        onClick={() => go(shiftMonth(ym, -1))}
        className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setPickerYear(ym.y);
          setOpen(!open);
        }}
        className="min-w-[7rem] rounded-[10px] px-2 py-1 text-center text-sm font-medium capitalize hover:bg-muted"
      >
        {monthLabel(ym, locale)}
      </button>
      <button
        type="button"
        aria-label="Następny miesiąc"
        onClick={() => go(shiftMonth(ym, 1))}
        className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute top-10 z-40 w-64 rounded-[14px] border border-border bg-card p-3 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setPickerYear((y) => y - 1)} className="p-1">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">{pickerYear}</span>
            <button type="button" onClick={() => setPickerYear((y) => y + 1)} className="p-1">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const active = ym.y === pickerYear && ym.m === i + 1;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    go({ y: pickerYear, m: i + 1 });
                    setOpen(false);
                  }}
                  className="rounded-[10px] py-2 text-sm capitalize"
                  style={active ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined}
                >
                  {monthShort(i)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
