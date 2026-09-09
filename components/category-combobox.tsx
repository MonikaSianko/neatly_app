"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/components/locale-provider";

export type ComboboxOption = { id: string; label: string; emoji: string; color?: string };

/** "spozywcze" ma trafiac w "spożywcze" — bez tego szukanie po polsku wymaga ogonkow. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function CategoryCombobox({
  options,
  value,
  onChange,
  placeholder,
  variant = "field",
  disabled = false,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  variant?: "field" | "inline";
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return options;
    return options.filter((o) => fold(o.label).includes(q));
  }, [options, query]);

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

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (next) {
          setQuery("");
          setActiveIndex(Math.max(0, options.findIndex((o) => o.id === value)));
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={`${triggerClass} disabled:opacity-60`}
        >
          {selected ? (
            <>
              <span aria-hidden>{selected.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{selected.label}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{placeholder ?? t.category}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

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
          placeholder={t.searchCategory}
          className="w-full border-b border-border bg-transparent px-3 py-2.5 text-base outline-none"
        />
        <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-3 py-2.5 text-base text-muted-foreground">{t.noResults}</li>
          )}
          {filtered.map((option, i) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                id={`${listId}-${option.id}`}
                aria-selected={option.id === value}
                onClick={() => pick(option.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-base"
                style={i === activeIndex ? { background: "var(--accent)" } : undefined}
              >
                <span aria-hidden>{option.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.id === value && <Check className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
