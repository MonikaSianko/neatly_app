"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { repeatOptions, presetToPattern, type RepeatPreset } from "@/lib/recurrence-presets";
import { WEEKDAYS } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import type { RecurrencePattern } from "@/lib/actions/recurring";

export function DraftRecurrenceDialog({
  open,
  onOpenChange,
  initialPattern,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPattern: RecurrencePattern | null;
  onApply: (pattern: RecurrencePattern | null) => void;
}) {
  const { locale, t } = useLocale();
  const weekdayLabels = WEEKDAYS[locale];
  const [preset, setPreset] = useState<RepeatPreset>(initialPattern ? "custom" : "never");
  const [weekdays, setWeekdays] = useState<number[]>(initialPattern?.weekdays ?? []);
  const [customFreq, setCustomFreq] = useState<"day" | "week" | "month" | "year">(initialPattern?.freq ?? "month");
  const [customInterval, setCustomInterval] = useState(String(initialPattern?.interval ?? 1));
  const [untilMode, setUntilMode] = useState<"never" | "date">(initialPattern?.untilDate ? "date" : "never");
  const [untilDate, setUntilDate] = useState(initialPattern?.untilDate ?? "");

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function apply() {
    const pattern = presetToPattern(preset, {
      weekdays,
      customFreq,
      customInterval: Number(customInterval),
      untilDate: untilMode === "date" ? untilDate : null,
    });
    onApply(pattern);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.recurrence}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as RepeatPreset)}
            className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
          >
            {repeatOptions(t).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {(preset === "weekdays" || (preset === "custom" && customFreq === "week")) && (
            <div className="flex flex-wrap gap-1.5">
              {weekdayLabels.map((label, i) => {
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

          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <input
                type="number"
                min={1}
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                className="w-16 rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              />
              <select
                value={customFreq}
                onChange={(e) => setCustomFreq(e.target.value as typeof customFreq)}
                className="flex-1 rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              >
                <option value="day">{t.daily}</option>
                <option value="week">{t.weekly}</option>
                <option value="month">{t.monthly}</option>
                <option value="year">{t.yearly}</option>
              </select>
            </div>
          )}

          {preset !== "never" && (
            <div className="flex gap-2">
              <select
                value={untilMode}
                onChange={(e) => setUntilMode(e.target.value as "never" | "date")}
                className="rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              >
                <option value="never">{t.noEnd}</option>
                <option value="date">{t.untilDay}</option>
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
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              {t.apply}
            </button>
            {preset !== "never" && (
              <button
                type="button"
                onClick={() => {
                  setPreset("never");
                  onApply(null);
                }}
                className="rounded-[10px] border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                {t.clearRepeat}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
