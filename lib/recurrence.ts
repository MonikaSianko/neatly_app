/**
 * Generowanie wystapien regul cyklicznych — port 1:1 z prototypu
 * (budzet-prototyp-v11-neatly.jsx), bo ta logika jest przetestowana
 * i to w niej najlatwiej o blad (docinanie dat, tygodnie, interwaly).
 */
import { toDate, isoOf, addDays, diffDays, addMonthsClamped } from "./month";

export type Freq = "day" | "week" | "month" | "year";

export type RecurringRule = {
  freq: Freq;
  interval: number;
  weekdays?: number[] | null; // 1=pon..7=nd, tylko dla freq="week"
  startDate: string; // ISO
  untilDate?: string | null; // ISO
};

/** Wszystkie wystapienia reguly w przedziale [from, to] (ISO, wlacznie). */
export function occurrences(rule: RecurringRule, from: string, to: string): string[] {
  const out: string[] = [];
  const start = toDate(rule.startDate);
  const F = toDate(from);
  let limit = toDate(to);
  if (rule.untilDate) {
    const u = toDate(rule.untilDate);
    if (u < limit) limit = u;
  }
  if (start > limit) return out;

  const push = (d: Date) => {
    if (d >= start && d >= F && d <= limit) out.push(isoOf(d));
  };
  const iv = Math.max(1, rule.interval || 1);
  const weekdays = rule.weekdays ?? [];

  if (rule.freq === "day" || (rule.freq === "week" && !weekdays.length)) {
    const step = rule.freq === "day" ? iv : iv * 7;
    const k = Math.max(0, Math.ceil(diffDays(F, start) / step));
    for (let i = 0; i < 400; i++) {
      const d = addDays(start, (k + i) * step);
      if (d > limit) break;
      push(d);
    }
  } else if (rule.freq === "week") {
    const wdStart = (start.getDay() + 6) % 7;
    const weekStart0 = addDays(start, -wdStart);
    const stepDays = iv * 7;
    const w = Math.max(0, Math.floor(diffDays(F, weekStart0) / stepDays) - 1);
    for (let i = 0; i < 120; i++) {
      const ws = addDays(weekStart0, (w + i) * stepDays);
      if (ws > limit) break;
      [...weekdays]
        .sort((a, b) => a - b)
        .forEach((wd) => push(addDays(ws, wd - 1)));
    }
  } else {
    const gap = iv * (rule.freq === "year" ? 12 : 1);
    const ahead = (F.getFullYear() - start.getFullYear()) * 12 + (F.getMonth() - start.getMonth());
    const k = Math.max(0, Math.floor(ahead / gap) - 1);
    for (let i = 0; i < 90; i++) {
      const d = toDate(addMonthsClamped(rule.startDate, (k + i) * gap));
      if (d > limit) break;
      push(d);
    }
  }

  return [...new Set(out)].sort();
}
