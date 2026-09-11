"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/components/locale-provider";
import { foldText as fold } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";

export type ComboboxOption = {
  id: string;
  label: string;
  emoji: string;
  color?: string;
  /** Drugi plan pozycji — przy platnosciach kwota i data, zeby odroznic te o tym samym tytule. */
  hint?: string;
};

export function CategoryCombobox({
  options,
  value,
  onChange,
  placeholder,
  variant = "field",
  disabled = false,
  fullscreenOnMobile = false,
  title,
  searchPlaceholder,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  variant?: "field" | "inline";
  disabled?: boolean;
  /** Na telefonie zamiast dropdownu (chowal sie pod paskiem adresu) pelnoekranowa lista. */
  fullscreenOnMobile?: boolean;
  /** Naglowek i placeholder szukajki — domyslnie kategorie, bo stad wziela sie ta lista. */
  title?: string;
  searchPlaceholder?: string;
}) {
  const { t } = useLocale();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const fullscreen = fullscreenOnMobile && isMobile;
  // Nasluch na visualViewport tylko tam, gdzie faktycznie zaslania go klawiatura —
  // w tabeli platnosci comboboxow jest tyle, ile wierszy.
  const keyboardInset = useKeyboardInset(fullscreen && open);

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    return options.filter((o) => fold(o.label).includes(q));
  }, [options, query]);

  // Ekran kategorii nie jest warstwa Radiksa, wiec sam musi przejac fokus — inaczej Escape
  // trafia do Sheeta i zamyka caly formularz, zamiast wrocic do niego.
  useEffect(() => {
    if (fullscreen && open) screenRef.current?.focus();
  }, [fullscreen, open]);

  function toggle(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (next) {
      setQuery("");
      setActiveIndex(Math.max(0, options.findIndex((o) => o.id === value)));
    }
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = e.key === "ArrowDown" ? prev + 1 : prev - 1;
        const clamped = Math.max(0, Math.min(filtered.length - 1, next));
        listRef.current?.children[clamped]?.scrollIntoView({ block: "nearest" });
        return clamped;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) pick(option.id);
    }
  }

  const triggerClass =
    variant === "inline"
      ? "flex w-full min-w-0 items-center gap-1 rounded-sm bg-transparent text-left text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "flex min-h-11 w-full items-center gap-2 rounded-[10px] border border-border bg-muted px-3 text-left text-base";

  const trigger = (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={fullscreen ? () => toggle(true) : undefined}
      className={`${triggerClass} disabled:opacity-60`}
    >
      {selected ? (
        <>
          <span aria-hidden>{selected.emoji}</span>
          <span className="min-w-0 flex-1 truncate">{selected.label}</span>
          {selected.hint && <span className="tabular shrink-0 text-sm text-muted-foreground">{selected.hint}</span>}
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{placeholder ?? t.category}</span>
      )}
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );

  const list = (
    <OptionList
      listId={listId}
      listRef={listRef}
      options={filtered}
      value={value}
      activeIndex={activeIndex}
      onHover={setActiveIndex}
      onPick={pick}
      emptyLabel={t.noResults}
    />
  );

  if (fullscreen) {
    return (
      <>
        {trigger}
        {open && (
          <div
            ref={screenRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? t.chooseCategory}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                return;
              }
              onKeyDown(e);
            }}
            className="fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground outline-none"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center gap-1 border-b border-border px-2 py-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.goBack}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="text-lg font-medium">{title ?? t.chooseCategory}</span>
            </div>

            <input
              aria-controls={listId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={searchPlaceholder ?? t.searchCategory}
              className="shrink-0 border-b border-border bg-transparent px-4 py-3 text-base outline-none"
            />

            {/* Padding rowny klawiaturze — bez niego dolne kategorie zostaja pod nia. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
              style={{ paddingBottom: `calc(${keyboardInset}px + env(safe-area-inset-bottom) + 0.5rem)` }}
            >
              {list}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Popover open={open && !disabled} onOpenChange={toggle}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>

      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder ?? t.searchCategory}
          className="w-full border-b border-border bg-transparent px-3 py-2.5 text-base outline-none"
        />
        <div className="max-h-64 overflow-y-auto p-1">{list}</div>
      </PopoverContent>
    </Popover>
  );
}

function OptionList({
  listId,
  listRef,
  options,
  value,
  activeIndex,
  onHover,
  onPick,
  emptyLabel,
}: {
  listId: string;
  listRef: React.RefObject<HTMLUListElement | null>;
  options: ComboboxOption[];
  value: string;
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <ul ref={listRef} id={listId} role="listbox">
      {options.length === 0 && <li className="px-3 py-2.5 text-base text-muted-foreground">{emptyLabel}</li>}
      {options.map((option, i) => (
        <li key={option.id}>
          <button
            type="button"
            role="option"
            id={`${listId}-${option.id}`}
            aria-selected={option.id === value}
            onClick={() => onPick(option.id)}
            onMouseEnter={() => onHover(i)}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-base"
            style={i === activeIndex ? { background: "var(--accent)" } : undefined}
          >
            <span aria-hidden>{option.emoji}</span>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.hint && <span className="tabular shrink-0 text-sm text-muted-foreground">{option.hint}</span>}
            {option.id === value && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />}
          </button>
        </li>
      ))}
    </ul>
  );
}
