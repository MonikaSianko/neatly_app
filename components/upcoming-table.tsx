"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  MoreVertical,
  X,
  Repeat,
  Check,
  ChevronDown,
  ExternalLink,
  Zap,
  Pencil,
  Trash2,
  Undo2,
  Search,
} from "lucide-react";
import { NotePopover } from "@/components/note-popover";
import { CategoryCombobox } from "@/components/category-combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionForm, type EditingTransaction, type EditingRule } from "@/components/transaction-form";
import { ScopeDialog, type Scope } from "@/components/scope-dialog";
import { deleteTransaction } from "@/lib/actions/transactions";
import { deleteSplitTransaction, setSplitPaid } from "@/lib/actions/splits";
import { deleteRecurringEntry } from "@/lib/actions/recurring";
import { saveDraftRows, type DraftRowInput } from "@/lib/actions/drafts";
import { createClient } from "@/lib/supabase/client";
import { money, shortDate, parseAmountToCents, payNowStyle, foldText, amountText } from "@/lib/format";
import { paymentStatus } from "@/lib/month";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";
import { clearPendingRows, endPendingRow, startPendingRow, usePendingRows } from "@/lib/pending-rows";
import { categoryDisplayName } from "@/lib/i18n";

type Category = {
  id: string;
  name: string;
  name_en: string | null;
  emoji: string;
  color: string;
  kind: "expense" | "income";
};

export type UpcomingRow = {
  id: string;
  kind: "expense" | "income";
  title: string;
  amount_cents: number;
  category_id: string;
  date: string;
  is_paid: boolean;
  created_at: string;
  recurring_rule_id: string | null;
  payment_url: string | null;
  grace_days: number;
  note: string | null;
  is_automatic: boolean;
  split_group_id: string | null;
  split_label: string | null;
  /** Zwrot: przychod pomniejszajacy konkretny wydatek. */
  is_refund: boolean;
  refund_of_id: string | null;
};

/** Platnosc widziana tak, jak w banku: pojedyncza pozycja albo grupa czesci z suma kwot. */
type PaymentGroup = {
  key: string;
  head: UpcomingRow;
  parts: UpcomingRow[];
  total: number;
};

/** Data platnosci to termin, data dodania to moment wpisania pozycji — to dwie rozne rzeczy. */
type SortKey = "date" | "created";
type SortDir = "asc" | "desc";

/**
 * Jedna siatka dla naglowka, wierszy danych i wierszy roboczych — inaczej kolumny sie rozjezdzaja.
 * Szerokosci dobrane tak, zeby tabela zmiescila sie bez przewijania w poziomie od lg w gore:
 * przy lg (jedna kolumna) dostepne ~990px, przy xl (z panelem bocznym) ~910px.
 */
const GRID = "grid grid-cols-[28px_1.5fr_1.1fr_96px_92px_116px_120px_32px_32px]";

type DraftRow = {
  key: string;
  kind: "expense" | "income";
  title: string;
  categoryId: string;
  date: string;
  amount: string;
  isPaid: boolean;
};

let keySeq = 0;
const nextKey = () => `draft-${++keySeq}-${Date.now()}`;

function mkRow(kind: "expense" | "income", categoryId: string, date: string, patch: Partial<DraftRow> = {}): DraftRow {
  return { key: nextKey(), kind, title: "", categoryId, date, amount: "", isPaid: false, ...patch };
}

export function UpcomingTable({
  rows,
  refundParents,
  categories,
  householdId,
  walletId,
  rules,
  today,
  defaultDate,
}: {
  rows: UpcomingRow[];
  /** Tytuly zwracanych platnosci po id — zwrot sam z siebie nie mowi, czego dotyczy. */
  refundParents: Record<string, string>;
  categories: Category[];
  householdId: string;
  walletId: string;
  rules: Record<string, EditingRule>;
  today: string;
  defaultDate: string;
}) {
  const { locale, t } = useLocale();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  // Indeks wiersza roboczego otwartego w pelnym formularzu.
  const [draftIdx, setDraftIdx] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Domyslnie w kolejnosci dodawania: ostatnio wpisana pozycja ląduje na koncu listy.
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  // Klucz edytowanej platnosci przezywa zamkniecie arkusza, bo zapis konczy sie juz po nim.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Wiersze, ktorych dane sa juz nieaktualne (zapisane albo usuwane) — do czasu odpowiedzi
  // serwera stoi w ich miejscu szkielet, bo pokazywanie starej kwoty myli bardziej niz jej brak.
  const [staleKeys, setStaleKeys] = useState<string[]>([]);
  const [lastRows, setLastRows] = useState(rows);
  const pendingNewRows = usePendingRows();
  const [deleteTarget, setDeleteTarget] = useState<UpcomingRow | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
  const { pending, busy, error, run } = useAction();
  const lastInputRef = useRef<HTMLInputElement | null>(null);

  // Nowa tablica wierszy = serwer odeslal swieze dane, wiec nie ma juz na co czekac. Korekta
  // w trakcie renderu zamiast w efekcie: React powtarza render od razu, bez migniecia szkieletu.
  if (rows !== lastRows) {
    setLastRows(rows);
    setStaleKeys([]);
  }

  // Nowy wpis dojechal razem z ta tablica — zapowiedz mozna zdjac.
  useEffect(() => {
    clearPendingRows();
  }, [rows]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const catsOf = (kind: "expense" | "income") => categories.filter((c) => c.kind === kind);

  function addRow() {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      const next = mkRow(last?.kind ?? "expense", last?.categoryId ?? catsOf("expense")[0]?.id ?? "", last?.date ?? defaultDate);
      setTimeout(() => lastInputRef.current?.focus(), 30);
      return [...prev, next];
    });
  }

  function update(i: number, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setDrafts((prev) => prev.filter((_, k) => k !== i));
  }

  function onKeyDown(e: React.KeyboardEvent, i: number, isLast: boolean) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (isLast) addRow();
    else setTimeout(() => lastInputRef.current?.focus(), 30);
  }

  function onPaste(e: React.ClipboardEvent, i: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();

    const parsed = text
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const parts = line
          .split(/\t|;/)
          .map((x) => x.trim())
          .filter(Boolean);
        const last = parts[parts.length - 1] ?? "";
        const cents = parseAmountToCents(last);
        const titleParts = cents != null ? parts.slice(0, -1) : parts;
        return {
          title: titleParts.join(" ").slice(0, 60),
          amount: cents != null ? (cents / 100).toFixed(2).replace(".", ",") : "",
        };
      });

    setDrafts((prev) => {
      const base = prev[i];
      const made = parsed.map((p) => mkRow(base?.kind ?? "expense", base?.categoryId ?? catsOf("expense")[0]?.id ?? "", base?.date ?? defaultDate, p));
      return [...prev.slice(0, i), ...made, ...prev.slice(i + 1)];
    });
  }

  /** Wiersz roboczy w jezyku formularza. Pusta kwota zostaje pusta, a nie jako "0,00". */
  function draftPrefill(r: DraftRow): Partial<EditingTransaction> {
    const cents = parseAmountToCents(r.amount);
    return {
      kind: r.kind,
      title: r.title,
      categoryId: r.categoryId,
      date: r.date,
      isPaid: r.isPaid,
      ...(cents ? { amountCents: cents } : {}),
    };
  }

  const isPaid = (row: UpcomingRow) => overrides[row.id] ?? row.is_paid;

  function toggleSplit(key: string) {
    setExpandedSplits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Odhaczenie dotyczy calej platnosci — czesci jednego zakupu schodza z konta razem. */
  function togglePaid(group: PaymentGroup) {
    const next = !isPaid(group.head);
    const affected = group.parts.length > 0 ? group.parts : [group.head];
    setOverrides((prev) => ({ ...prev, ...Object.fromEntries(affected.map((r) => [r.id, next])) }));

    run(
      async () => {
        const result = group.parts.length
          ? await setSplitPaid(group.key, next)
          : await (async () => {
              const supabase = createClient();
              const { error: dbError } = await supabase
                .from("transactions")
                .update({ is_paid: next, paid_at: next ? new Date().toISOString() : null })
                .eq("id", group.head.id);
              return { error: dbError?.message ?? null };
            })();

        // Odhaczenie zmienia wiersz od razu, wiec nieudany zapis trzeba cofnac na ekranie.
        if (result.error) {
          setOverrides((prev) => ({ ...prev, ...Object.fromEntries(affected.map((r) => [r.id, r.is_paid])) }));
        }
        return result;
      },
      { key: group.key }
    );
  }

  /** Usuwany wiersz od razu idzie w szkielet — zniknie z nim dopiero, gdy przyjda nowe dane. */
  function markStale(key: string) {
    setStaleKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function dropStale(key: string) {
    setStaleKeys((prev) => prev.filter((x) => x !== key));
  }

  function requestDelete(group: PaymentGroup) {
    if (group.head.recurring_rule_id && group.parts.length === 0) {
      setDeleteTarget(group.head);
      return;
    }
    markStale(group.key);
    run(
      () => (group.parts.length > 0 ? deleteSplitTransaction(group.key) : deleteTransaction(group.head.id)),
      { onError: () => dropStale(group.key) }
    );
  }

  function pickDeleteScope(scope: Scope) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    markStale(id);
    run(() => deleteRecurringEntry(id, scope), { onError: () => dropStale(id) });
  }

  /** Czesci jednej platnosci schodza sie w jeden wiersz z suma — taka kwota widnieje na wyciagu. */
  function toGroups(list: UpcomingRow[]): PaymentGroup[] {
    const splits = new Map<string, UpcomingRow[]>();
    const groups: PaymentGroup[] = [];

    for (const row of list) {
      if (!row.split_group_id) {
        groups.push({ key: row.id, head: row, parts: [], total: row.amount_cents });
        continue;
      }
      const found = splits.get(row.split_group_id);
      if (found) found.push(row);
      else splits.set(row.split_group_id, [row]);
    }
    for (const [key, parts] of splits) {
      groups.push({ key, head: parts[0], parts, total: parts.reduce((s, p) => s + p.amount_cents, 0) });
    }

    return groups.sort((a, b) => {
      const rising =
        sortKey === "created"
          ? a.head.created_at.localeCompare(b.head.created_at)
          : a.head.date.localeCompare(b.head.date) || a.head.title.localeCompare(b.head.title);
      return sortDir === "asc" ? rising : -rising;
    });
  }

  /**
   * Szukanie po tym, co widac w wierszu: tytul, kategoria, doprecyzowanie czesci i kwota.
   * Kwoty porownujemy tekstem ("147" trafia w "147,00"), bo tak sie ich szuka — po tym,
   * co widnieje na ekranie, a nie po groszach.
   */
  function matches(group: PaymentGroup): boolean {
    const q = foldText(query.trim());
    if (!q) return true;

    const parts = group.parts.length > 0 ? group.parts : [group.head];
    const words = [
      group.head.title,
      ...parts.map((p) => p.split_label ?? ""),
      ...parts.map((p) => {
        const cat = categoryById.get(p.category_id);
        return cat ? categoryDisplayName(cat.name, locale, cat.name_en) : "";
      }),
    ];
    if (words.some((word) => foldText(word).includes(q))) return true;

    const digits = q.replace(/\s/g, "").replace(".", ",");
    return [group.total, ...parts.map((p) => p.amount_cents)].some((cents) => amountText(cents).includes(digits));
  }

  const filled = drafts.filter((r) => r.title.trim() && (parseAmountToCents(r.amount) ?? 0) > 0);
  const draftTotal = filled.reduce((sum, r) => sum + (parseAmountToCents(r.amount) ?? 0), 0);
  const allOpen = toGroups(rows.filter((r) => !isPaid(r)));
  const allPaid = toGroups(rows.filter(isPaid));
  const openGroups = allOpen.filter(matches);
  const paidGroups = allPaid.filter(matches);
  const total = allOpen.length + allPaid.length;
  const shown = openGroups.length + paidGroups.length;
  const filtering = query.trim().length > 0;
  const sumOf = (groups: PaymentGroup[]) =>
    groups.reduce((sum, g) => sum + (g.head.kind === "income" ? g.total : -g.total), 0);
  const netTotal = sumOf(openGroups);
  const paidTotal = sumOf(paidGroups);

  function saveAll() {
    if (filled.length === 0) return;
    const input: DraftRowInput[] = filled.map((r) => ({
      kind: r.kind,
      title: r.title,
      amountCents: parseAmountToCents(r.amount) ?? 0,
      categoryId: r.categoryId,
      date: r.date,
      isPaid: r.isPaid,
    }));
    // Wiersze robocze znikaja od razu po zapisie, wiec az do odswiezenia trzymaja miejsce szkielety.
    input.forEach(startPendingRow);
    run(() => saveDraftRows(householdId, walletId, input), {
      onSuccess: () => setDrafts([]),
      onError: () => input.forEach(endPendingRow),
    });
  }

  /** Edycje otwiera menu (...) — i na telefonie, i na desktopie, z jednego zrodla danych. */
  function openEdit(group: PaymentGroup) {
    const row = group.head;
    const split = group.parts.length > 0;
    setEditingKey(group.key);
    setEditing({
      id: row.id,
      kind: row.kind,
      title: row.title,
      amountCents: group.total,
      categoryId: row.category_id,
      date: row.date,
      isPaid: isPaid(row),
      paymentUrl: row.payment_url,
      graceDays: row.grace_days,
      note: row.note,
      isAutomatic: row.is_automatic,
      recurringRuleId: row.recurring_rule_id,
      rule: row.recurring_rule_id ? rules[row.recurring_rule_id] ?? null : null,
      isRefund: row.is_refund,
      refundOfId: row.refund_of_id,
      splitGroupId: split ? group.key : null,
      splitParts: split
        ? group.parts.map((p) => ({
            id: p.id,
            categoryId: p.category_id,
            amountCents: p.amount_cents,
            label: p.split_label,
          }))
        : undefined,
    });
  }

  /**
   * Tytul zwrotu z nazwa zwracanej platnosci z przodu. Doklejana czesc ma kolor marki,
   * zeby bylo widac, ze to nie jest czesc wpisanej nazwy.
   */
  function rowTitle(row: UpcomingRow) {
    const parent = row.is_refund && row.refund_of_id ? refundParents[row.refund_of_id] : null;
    if (!parent) return row.title;
    return (
      <>
        <span style={{ color: "var(--neatly-primary-dark)" }}>{parent} — </span>
        {row.title}
      </>
    );
  }

  /** Jedna siatka dla pozycji oplaconych i nieoplaconych, zeby kolumny wszedzie sie pokrywaly. */
  function renderGroup(group: PaymentGroup, withBorder: boolean) {
    const row = group.head;
    const split = group.parts.length > 0;
    const cat = categoryById.get(row.category_id);
    const paid = isPaid(row);
    const late = !paid && row.date < today;
    const expanded = expandedSplits.has(group.key);

    const categoryNames = split
      ? group.parts
          .map((p) => {
            const c = categoryById.get(p.category_id);
            return c ? categoryDisplayName(c.name, locale, c.name_en) : "";
          })
          .filter(Boolean)
          .join(", ")
      : cat
        ? categoryDisplayName(cat.name, locale, cat.name_en)
        : "";

    // Po zapisie wiersz ma stare wartosci az do odpowiedzi serwera — lepiej pokazac szkielet
    // niz kwote, ktorej juz nie ma.
    if (staleKeys.includes(group.key)) return <RowSkeleton key={group.key} withBorder={withBorder} />;

    // Wiersz w trakcie zapisu przygasa i nie przyjmuje kolejnych klikniec, zeby podwojne
    // dotkniecie nie wyslalo dwoch sprzecznych zmian.
    const waiting = busy(group.key);

    return (
      <div
        key={group.key}
        className={withBorder ? "border-t border-border" : ""}
        style={waiting ? { opacity: 0.55, pointerEvents: "none" } : undefined}
        aria-busy={waiting || undefined}
      >
      {/* Telefon: dwie linie zamiast dziewieciu kolumn. Akcje siedza w menu (...),
          zeby przypadkowe dotkniecie wiersza nie otwieralo edycji. */}
      <div className={`flex items-center gap-2 px-3 py-2.5 lg:hidden ${paid ? "text-muted-foreground" : ""}`}>
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {split ? (
              <span className="flex shrink-0 items-center">
                {group.parts.slice(0, 3).map((part) => (
                  <span
                    key={part.id}
                    className="-mr-1 h-2.5 w-2.5 rounded-full ring-2 ring-card"
                    style={{ background: categoryById.get(part.category_id)?.color }}
                  />
                ))}
              </span>
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
            )}
            <span className="truncate text-base font-medium">{rowTitle(row)}</span>
            {row.is_refund && (
              <Undo2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--neatly-primary-dark)" }} aria-label={t.refundOne} />
            )}
            {row.recurring_rule_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {row.is_automatic && <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--neatly-primary-dark)" }} />}
          </span>
          <span
            className="mt-0.5 flex items-center gap-1.5 truncate text-sm"
            style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}
          >
            <span className="truncate">{categoryNames}</span>
            <span className="shrink-0 opacity-50">·</span>
            <span className="shrink-0">
              {shortDate(row.date, locale)}
              {late && ` ${t.overdue}`}
            </span>
          </span>
        </div>

        <span className="tabular shrink-0 text-base font-semibold">{money(group.total, locale)}</span>

        {split && (
          <button
            type="button"
            onClick={() => toggleSplit(group.key)}
            aria-expanded={expanded}
            aria-label={t.splitOne}
            className="tap-target flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground"
          >
            <ChevronDown
              className="h-5 w-5 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        )}

        <button
          type="button"
          onClick={() => togglePaid(group)}
          className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border"
          style={{
            borderColor: paid ? "var(--primary)" : "var(--border)",
            background: paid ? "var(--primary)" : "transparent",
          }}
          aria-label={row.kind === "income" ? t.received : t.paid}
        >
          {waiting ? (
            <Spinner className="h-4 w-4" />
          ) : (
            paid && <Check className="h-4 w-4 text-primary-foreground" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
              aria-label={t.rowMenu}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(group)}>
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(group)}>
              <Trash2 className="h-4 w-4" /> {t.del}
            </DropdownMenuItem>
            {!paid && row.payment_url && (
              <DropdownMenuItem asChild>
                <a href={row.payment_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> {t.payNow}
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={`${GRID} hidden items-center gap-1 px-2 py-2 text-base lg:grid ${paid ? "text-muted-foreground" : ""}`}
      >
        <span
          className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
          style={{ color: row.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
          aria-label={row.is_refund ? t.refundOne : row.kind === "expense" ? t.expense : t.incomeOne}
        >
          {row.is_refund ? (
            <Undo2 className="h-3.5 w-3.5" />
          ) : row.kind === "expense" ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownLeft className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{rowTitle(row)}</span>
          {row.is_refund && (
            <Undo2
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--neatly-primary-dark)" }}
              aria-label={t.refundOne}
            />
          )}
          {row.recurring_rule_id && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t.repeat} />}
          {row.is_automatic && (
            <Zap
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--neatly-primary-dark)" }}
              aria-label={t.automatic}
            />
          )}
          {row.note && <NotePopover note={row.note} />}
        </span>
        {split ? (
          <button
            type="button"
            onClick={() => toggleSplit(group.key)}
            className="flex min-w-0 items-center gap-1.5 text-left text-muted-foreground"
            aria-expanded={expanded}
          >
            <span className="flex shrink-0 -space-x-1">
              {group.parts.slice(0, 3).map((part) => (
                <span
                  key={part.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-card"
                  style={{ background: categoryById.get(part.category_id)?.color }}
                />
              ))}
            </span>
            <span className="truncate text-sm">
              {group.parts.length} {t.splitCategories}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
            {cat ? categoryDisplayName(cat.name, locale, cat.name_en) : ""}
          </span>
        )}
        <span className="text-sm" style={{ color: late ? "var(--destructive)" : "var(--muted-foreground)" }}>
          {shortDate(row.date, locale)}
          {late && ` ${t.overdue}`}
        </span>
        <span className="text-sm text-muted-foreground">{shortDate(row.created_at.slice(0, 10), locale)}</span>
        <span className="tabular text-right font-medium">{money(group.total, locale)}</span>
        <span className="flex justify-end">
          {!paid && row.payment_url && (
            <a
              href={row.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-2 text-sm font-medium sm:py-1"
              style={payNowStyle(paymentStatus(row.date, row.grace_days, today))}
            >
              <ExternalLink className="h-3 w-3 shrink-0" /> {t.payNow}
            </a>
          )}
        </span>
        <button
          type="button"
          onClick={() => togglePaid(group)}
          className="tap-target mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border"
          style={{
            borderColor: paid ? "var(--primary)" : "var(--border)",
            background: paid ? "var(--primary)" : "transparent",
          }}
          aria-label={row.kind === "income" ? t.received : t.paid}
        >
          {waiting ? (
            <Spinner className="h-3 w-3" />
          ) : (
            paid && <Check className="h-3 w-3 text-primary-foreground" />
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="tap-target mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label={t.edit}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(group)}>
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(group)}>
              <Trash2 className="h-4 w-4" /> {t.del}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {split && expanded && (
        <div className="bg-muted/40 pb-1">
          {group.parts.map((part) => {
            const partCat = categoryById.get(part.category_id);
            return (
              <div key={part.id}>
                <div className="flex items-center gap-2 py-1.5 pr-3 pl-8 text-sm text-muted-foreground lg:hidden">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partCat?.color }} />
                  <span className="min-w-0 flex-1 truncate">
                    {part.split_label || (partCat ? categoryDisplayName(partCat.name, locale, partCat.name_en) : "")}
                  </span>
                  <span className="tabular shrink-0">{money(part.amount_cents, locale)}</span>
                </div>

                <div className={`${GRID} hidden items-center gap-1 px-2 py-1.5 text-sm lg:grid`}>
                  <span />
                  <span className="truncate pl-4 text-muted-foreground">{part.split_label || "—"}</span>
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partCat?.color }} />
                    {partCat ? categoryDisplayName(partCat.name, locale, partCat.name_en) : ""}
                  </span>
                  <span />
                  <span />
                  <span className="tabular text-right">{money(part.amount_cents, locale)}</span>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:min-w-64 sm:flex-1 lg:max-w-96">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPayments}
            aria-label={t.searchPayments}
            className="min-h-11 w-full rounded-[10px] border border-border bg-card pr-10 pl-9 text-base sm:min-h-9"
          />
          {filtering && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.clearSearch}
              className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-base">
        <span className="text-muted-foreground">{t.sortBy}</span>
        <SortMenu
          label={t.sortBy}
          value={sortKey}
          onChange={(next) => setSortKey(next as SortKey)}
          options={[
            { value: "date", label: t.sortByDate },
            { value: "created", label: t.sortByAdded },
          ]}
        />
        <SortMenu
          label={t.sortDirection}
          value={sortDir}
          onChange={(next) => setSortDir(next as SortDir)}
          options={[
            { value: "asc", label: t.sortOldest },
            { value: "desc", label: t.sortNewest },
          ]}
        />

        {filtering && (
          <span className="text-sm text-muted-foreground">
            {t.filteredCount} {shown} {t.ofPayments} {total}
          </span>
        )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        {/* Szerokosc minimalna dopiero od lg, gdzie tabela ma sie gdzie zmiescic. Nizej
            wchodzi uklad dwuwierszowy, wiec przewijanie w poziomie nigdy nie jest potrzebne. */}
        <div className="lg:min-w-[812px]">
          {shown === 0 && drafts.length === 0 && pendingNewRows === 0 && (
            <div className="px-4 py-10 text-center text-base text-muted-foreground">
              {filtering ? t.noResults : t.noUpcoming}
            </div>
          )}

          {(shown > 0 || drafts.length > 0 || pendingNewRows > 0) && (
            <div
              className={`${GRID} hidden items-center gap-1 border-b border-border bg-muted/50 px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid`}
            >
              <span />
              <span>{t.title}</span>
              <span>{t.category}</span>
              <span>{t.dueDate}</span>
              <span>{t.addedDate}</span>
              <span className="text-right">{t.amount}</span>
              <span />
              <span />
              <span />
            </div>
          )}

          {paidGroups.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPaid(!showPaid)}
                className="flex w-full items-center gap-2 px-2 py-2.5 text-base text-muted-foreground hover:bg-muted/50"
                aria-expanded={showPaid}
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showPaid ? "rotate(180deg)" : undefined }}
                />
                <span className="font-medium">
                  {t.paidSection} ({paidGroups.length})
                </span>
                <span className="tabular ml-auto">{money(paidTotal, locale)}</span>
              </button>
              {showPaid && paidGroups.map((group) => renderGroup(group, true))}
            </>
          )}

          {openGroups.map((group, i) => renderGroup(group, i > 0 || paidGroups.length > 0))}

          {/* Nowy wpis jeszcze nie wrocil z serwera — do tego czasu trzyma miejsce na koncu listy. */}
          {Array.from({ length: pendingNewRows }, (_, i) => (
            <RowSkeleton key={`new-${i}`} withBorder={i > 0 || openGroups.length > 0 || paidGroups.length > 0} />
          ))}

          {/* Wiersze robocze tylko od sm — na telefonie dodaje sie przez przycisk +. */}
          {drafts.map((r, i) => {
            const isLast = i === drafts.length - 1;
            const cat = categoryById.get(r.categoryId);
            return (
              <div
                key={r.key}
                className={`${GRID} hidden items-center gap-1 border-t border-border bg-muted/40 px-2 py-1.5 text-base lg:grid`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const k = r.kind === "expense" ? "income" : "expense";
                    update(i, { kind: k, categoryId: catsOf(k)[0]?.id ?? "" });
                  }}
                  className="tap-target mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-border"
                  style={{ color: r.kind === "expense" ? "var(--destructive)" : "var(--neatly-primary-dark)" }}
                  aria-label={r.kind === "expense" ? t.expense : t.incomeOne}
                >
                  {r.kind === "expense" ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  )}
                </button>

                <div className="flex min-w-0 items-center gap-1">
                  <input
                    ref={isLast ? lastInputRef : null}
                    value={r.title}
                    placeholder="—"
                    onPaste={(e) => onPaste(e, i)}
                    onChange={(e) => update(i, { title: e.target.value })}
                    onKeyDown={(e) => onKeyDown(e, i, isLast)}
                    className="w-full min-w-0 rounded-sm bg-transparent text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex min-w-0 items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat?.color }} />
                  <CategoryCombobox
                    variant="inline"
                    options={catsOf(r.kind).map((c) => ({
                      id: c.id,
                      label: categoryDisplayName(c.name, locale, c.name_en),
                      emoji: c.emoji,
                    }))}
                    value={r.categoryId}
                    onChange={(categoryId) => update(i, { categoryId })}
                  />
                </div>

                <input
                  type="date"
                  value={r.date}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="w-full rounded-sm bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                {/* Kolumna "Dodano" — nowy wiersz dostanie te date dopiero przy zapisie. */}
                <span className="text-sm text-muted-foreground">—</span>

                <input
                  value={r.amount}
                  placeholder="0,00"
                  inputMode="decimal"
                  onChange={(e) => update(i, { amount: e.target.value })}
                  onKeyDown={(e) => onKeyDown(e, i, isLast)}
                  className="tabular w-full rounded-sm bg-transparent text-right text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setDraftIdx(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground sm:h-7 sm:w-7"
                    aria-label={t.editEntry}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground sm:h-7 sm:w-7"
                    aria-label={t.clearRow}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => update(i, { isPaid: !r.isPaid })}
                  className="tap-target mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: r.isPaid ? "var(--primary)" : "var(--border)",
                    background: r.isPaid ? "var(--primary)" : "transparent",
                  }}
                >
                  {r.isPaid && <Check className="h-3 w-3 text-primary-foreground" />}
                </button>

                <span />
              </div>
            );
          })}

          {rows.length > 0 && drafts.length === 0 && (
            <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-2.5 text-base">
              <span className="font-medium">{openGroups.length} {t.rows}</span>
              <span className="tabular font-medium">{t.netTotal} {money(netTotal, locale)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 hidden flex-wrap items-center gap-3 lg:flex">
        <button
          type="button"
          onClick={addRow}
          className="flex min-h-11 items-center gap-1.5 text-base sm:min-h-0"
          style={{ color: "var(--neatly-primary-dark)" }}
        >
          <Plus className="h-3.5 w-3.5" /> {t.addRow}
        </button>
        {drafts.length > 0 && (
          <>
            <div className="flex-1" />
            <span className="text-base text-muted-foreground">
              {filled.length} {t.rows} · <span className="tabular text-foreground">{money(draftTotal, locale)}</span>
            </span>
            <button
              type="button"
              onClick={() => setDrafts([])}
              className="rounded-[10px] border border-border px-3 py-1.5 text-base font-medium hover:bg-muted"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={pending || filled.length === 0}
              className="flex items-center gap-2 rounded-[10px] px-4 py-1.5 text-base font-medium text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {pending && <Spinner />}
              {t.saveAll}
            </button>
          </>
        )}
      </div>
      {drafts.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{t.quickHint}</p>}
      {error && <p className="mt-2 text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

      {/* Wiersz roboczy otwiera ten sam formularz co reszta pozycji. Zapis tworzy wpis od razu,
          wiec wiersz schodzi z listy roboczej — inaczej "Zapisz wszystko" dodaloby go drugi raz.
          Klucz wiersza przemontowuje formularz, zeby kolejny wiersz nie odziedziczyl poprzednich pol. */}
      {draftIdx !== null && drafts[draftIdx] && (
        <TransactionForm
          key={drafts[draftIdx].key}
          open
          onOpenChange={(open) => !open && setDraftIdx(null)}
          householdId={householdId}
          walletId={walletId}
          categories={categories}
          defaultDate={defaultDate}
          prefill={draftPrefill(drafts[draftIdx])}
          onSaved={() => {
            removeRow(draftIdx);
            setDraftIdx(null);
          }}
        />
      )}

      <TransactionForm
        onSavingChange={(saving) => {
          if (saving && editingKey) markStale(editingKey);
          else if (editingKey) dropStale(editingKey);
        }}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        householdId={householdId}
        walletId={walletId}
        categories={categories}
        defaultDate={defaultDate}
        editing={editing}
      />

      <ScopeDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t.scopeDelTitle}
        mode="delete"
        onPick={pickDeleteScope}
      />
    </>
  );
}

/**
 * Wiersz w oczekiwaniu na dane po zapisie. Odwzorowuje oba uklady — dwuwierszowy na telefonie
 * i siatke na desktopie — zeby tabela nie skakala w momencie podmiany.
 */
function RowSkeleton({ withBorder }: { withBorder: boolean }) {
  return (
    <div className={withBorder ? "border-t border-border" : ""} aria-busy>
      <div className="flex items-center gap-2 px-3 py-2.5 lg:hidden">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-3 w-28 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
        <div className="h-7 w-7 shrink-0 animate-pulse rounded-[7px] bg-muted" />
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
      </div>

      <div className={`${GRID} hidden items-center gap-1 px-2 py-2 lg:grid`}>
        <div className="mx-auto h-6 w-6 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-14 animate-pulse rounded bg-muted" />
        <div className="h-4 w-14 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-muted" />
        <div />
        <div className="mx-auto h-5 w-5 animate-pulse rounded-[6px] bg-muted" />
        <div className="mx-auto h-5 w-5 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

/**
 * Wybor sortowania na tych samych klockach co przelacznik jezyka i portfela — natywny <select>
 * otwiera liste malowana przez system, ktora nie ma nic wspolnego z reszta aplikacji.
 */
function SortMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const current = options.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex min-h-9 items-center gap-1 rounded-[10px] border border-border bg-card px-2.5 text-sm font-medium hover:bg-muted sm:min-h-8"
        >
          {current?.label}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
