import type { RecurrencePattern } from "@/lib/actions/recurring";
import type { Dict } from "@/lib/i18n";

export type RepeatPreset = "never" | "day" | "week" | "weekdays" | "biweek" | "month" | "year" | "custom";

export function repeatOptions(t: Dict): { value: RepeatPreset; label: string }[] {
  return [
    { value: "never", label: t.never },
    { value: "day", label: t.daily },
    { value: "week", label: t.weekly },
    { value: "weekdays", label: t.pickedDays },
    { value: "biweek", label: t.biweekly },
    { value: "month", label: t.monthly },
    { value: "year", label: t.yearly },
    { value: "custom", label: t.custom },
  ];
}

export function presetToPattern(
  preset: RepeatPreset,
  opts: {
    weekdays: number[];
    customFreq: "day" | "week" | "month" | "year";
    customInterval: number;
    untilDate: string | null;
  }
): RecurrencePattern | null {
  if (preset === "never") return null;
  const untilDate = opts.untilDate || null;
  switch (preset) {
    case "day":
      return { freq: "day", interval: 1, weekdays: [], untilDate };
    case "week":
      return { freq: "week", interval: 1, weekdays: [], untilDate };
    case "weekdays":
      return { freq: "week", interval: 1, weekdays: opts.weekdays.length ? opts.weekdays : [1], untilDate };
    case "biweek":
      return { freq: "week", interval: 2, weekdays: [], untilDate };
    case "month":
      return { freq: "month", interval: 1, weekdays: [], untilDate };
    case "year":
      return { freq: "year", interval: 1, weekdays: [], untilDate };
    case "custom":
      return {
        freq: opts.customFreq,
        interval: Math.max(1, opts.customInterval || 1),
        weekdays: opts.customFreq === "week" ? opts.weekdays : [],
        untilDate,
      };
  }
}
