export type YearMonth = { y: number; m: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function parseMonthParam(param: string | undefined): YearMonth {
  if (param) {
    const match = /^(\d{4})-(\d{2})$/.exec(param);
    if (match) return { y: Number(match[1]), m: Number(match[2]) };
  }
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

export function monthKey({ y, m }: YearMonth): string {
  return `${y}-${pad(m)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function monthRange({ y, m }: YearMonth): { from: string; to: string } {
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
}

export function shiftMonth({ y, m }: YearMonth, k: number): YearMonth {
  const t = m - 1 + k;
  return { y: y + Math.floor(t / 12), m: (((t % 12) + 12) % 12) + 1 };
}

export const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const isoOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (dt: Date, n: number): Date => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

export const diffDays = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / 86400000);

/** Dodaje k miesiecy do daty ISO, docinajac dzien do ostatniego dnia docelowego miesiaca. */
export function addMonthsClamped(iso: string, k: number): string {
  const d = toDate(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const t = m - 1 + k;
  const ny = y + Math.floor(t / 12);
  const nm = (((t % 12) + 12) % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

const MONTH_NAMES_PL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

export function monthLabel({ y, m }: YearMonth): string {
  return `${MONTH_NAMES_PL[m - 1]} ${y}`;
}

export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
