"use client";

import { useRef, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { type YearMonth, monthKey, shiftMonth } from "@/lib/month";

export function SwipeMonth({ ym, children }: { ym: YearMonth; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const touchX = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 70) return;
    const next = shiftMonth(ym, dx < 0 ? 1 : -1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", monthKey(next));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
