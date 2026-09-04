import { describe, expect, it } from "vitest";
import { occurrences, type RecurringRule } from "./recurrence";

describe("occurrences", () => {
  it("acceptance criterion 7: 'every month on the 31st' clamps correctly all year", () => {
    const rule: RecurringRule = { freq: "month", interval: 1, startDate: "2026-01-31" };
    const dates = occurrences(rule, "2026-01-01", "2026-12-31");
    expect(dates).toEqual([
      "2026-01-31",
      "2026-02-28", // not a leap year
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("clamps 29 Feb on a leap year correctly for a yearly rule", () => {
    const rule: RecurringRule = { freq: "year", interval: 1, startDate: "2024-02-29" };
    const dates = occurrences(rule, "2024-01-01", "2027-12-31");
    expect(dates).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28"]);
  });

  it("daily rule with an interval", () => {
    const rule: RecurringRule = { freq: "day", interval: 3, startDate: "2026-09-01" };
    const dates = occurrences(rule, "2026-09-01", "2026-09-10");
    expect(dates).toEqual(["2026-09-01", "2026-09-04", "2026-09-07", "2026-09-10"]);
  });

  it("weekly on chosen weekdays ('every two weeks' = freq week, interval 2)", () => {
    // 2026-09-07 is a Monday.
    const rule: RecurringRule = { freq: "week", interval: 2, weekdays: [1, 3], startDate: "2026-09-07" };
    const dates = occurrences(rule, "2026-09-01", "2026-10-05");
    expect(dates).toEqual(["2026-09-07", "2026-09-09", "2026-09-21", "2026-09-23", "2026-10-05"]);
  });

  it("respects untilDate", () => {
    const rule: RecurringRule = { freq: "month", interval: 1, startDate: "2026-01-15", untilDate: "2026-03-01" };
    const dates = occurrences(rule, "2026-01-01", "2026-12-31");
    expect(dates).toEqual(["2026-01-15", "2026-02-15"]);
  });

  it("never returns dates before the rule's start", () => {
    const rule: RecurringRule = { freq: "month", interval: 1, startDate: "2026-06-15" };
    const dates = occurrences(rule, "2026-01-01", "2026-12-31");
    expect(dates.every((d) => d >= "2026-06-15")).toBe(true);
    expect(dates[0]).toBe("2026-06-15");
  });

  it("is idempotent when queried for overlapping ranges (no duplicates within a call)", () => {
    const rule: RecurringRule = { freq: "week", interval: 1, weekdays: [1, 5], startDate: "2026-09-01" };
    const dates = occurrences(rule, "2026-09-01", "2026-09-30");
    expect(new Set(dates).size).toBe(dates.length);
  });
});
