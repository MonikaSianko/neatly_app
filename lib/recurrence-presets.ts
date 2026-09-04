import type { RecurrencePattern } from "@/lib/actions/recurring";

export type RepeatPreset = "never" | "day" | "week" | "weekdays" | "biweek" | "month" | "year" | "custom";

export const REPEAT_OPTIONS: { value: RepeatPreset; label: string }[] = [
  { value: "never", label: "Nigdy" },
  { value: "day", label: "Codziennie" },
  { value: "week", label: "Co tydzień" },
  { value: "weekdays", label: "Wybrane dni tygodnia" },
  { value: "biweek", label: "Co dwa tygodnie" },
  { value: "month", label: "Co miesiąc" },
  { value: "year", label: "Co rok" },
  { value: "custom", label: "Niestandardowo" },
];

export const WEEKDAY_LABELS_PL = ["pon", "wt", "śr", "czw", "pt", "sob", "nd"];

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
