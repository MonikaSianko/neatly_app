"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2, Archive, RotateCcw, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  createCategory,
  updateCategory,
  reorderCategory,
  restoreCategory,
  deleteOrArchiveCategory,
  type CategoryKind,
} from "@/lib/actions/categories";

const PALETTE = [
  "#5865F2", "#6389DE", "#4390DA", "#0099CF", "#009EC4", "#00A3AC",
  "#00A68C", "#00A683", "#00A577", "#36A467", "#58A051", "#749B38",
  "#AE8600", "#AA8800", "#BF7B0F", "#C9732F", "#CF6D45", "#D16766",
  "#D06676", "#C6679A", "#B06FBF", "#B96CB3", "#9977D1", "#867EDA",
];

export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  position: number;
  is_archived: boolean;
};

type Draft = {
  id: string | null;
  name: string;
  emoji: string;
  color: string;
};

export function CategoryManager({
  open,
  onOpenChange,
  householdId,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  categories: Category[];
}) {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const list = categories
    .filter((c) => c.kind === kind && !c.is_archived)
    .sort((a, b) => a.position - b.position);
  const archived = categories.filter((c) => c.kind === kind && c.is_archived);

  function move(id: string, direction: -1 | 1) {
    startTransition(async () => {
      const result = await reorderCategory(householdId, kind, id, direction);
      if (result.error) setError(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteOrArchiveCategory(id);
      if (result.error) setError(result.error);
    });
  }

  function restore(id: string) {
    startTransition(async () => {
      const result = await restoreCategory(id);
      if (result.error) setError(result.error);
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    startTransition(async () => {
      const result = edit.id
        ? await updateCategory(edit.id, { name: edit.name, emoji: edit.emoji, color: edit.color })
        : await createCategory(householdId, list.length, { ...edit, kind });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEdit(null);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Kategorie</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="flex w-fit gap-1 rounded-full border border-border bg-card p-1">
            {(
              [
                ["expense", "Wydatki"],
                ["income", "Przychody"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setEdit(null);
                }}
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={
                  kind === k
                    ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-[14px] border border-border">
            {list.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span aria-hidden>{c.emoji}</span>
                <span className="flex-1 truncate text-sm">{c.name}</span>
                <button
                  type="button"
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0 || pending}
                  className="p-1 text-muted-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(c.id, 1)}
                  disabled={i === list.length - 1 || pending}
                  className="p-1 text-muted-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEdit({ id: c.id, name: c.name, emoji: c.emoji, color: c.color })}
                  className="p-1 text-muted-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  className="p-1"
                  style={{ color: "var(--destructive)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setEdit({ id: null, name: "", emoji: "📦", color: PALETTE[0] })}
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Nowa kategoria
          </button>

          {archived.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Archive className="h-3.5 w-3.5" /> Zarchiwizowane ({archived.length})
              </button>
              {showArchived && (
                <div className="mt-2 rounded-[14px] border border-border">
                  {archived.map((c, i) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 bg-muted px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
                    >
                      <span aria-hidden>{c.emoji}</span>
                      <span className="flex-1 truncate text-sm text-muted-foreground">{c.name}</span>
                      <button
                        type="button"
                        onClick={() => restore(c.id)}
                        disabled={pending}
                        className="flex items-center gap-1 p-1 text-xs"
                        style={{ color: "var(--neatly-primary-dark)" }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Przywróć
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}

          {edit && (
            <form onSubmit={submitEdit} className="flex flex-col gap-4 border-t border-border pt-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Nazwa</label>
                <input
                  autoFocus
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Ikona</label>
                <EmojiPicker value={edit.emoji} onChange={(emoji) => setEdit({ ...edit, emoji })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Kolor</label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEdit({ ...edit, color: p })}
                      className="h-7 w-7 rounded-full"
                      style={{
                        background: p,
                        outline: edit.color === p ? "2px solid var(--foreground)" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-[10px] px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  Zapisz kategorię
                </button>
                <button
                  type="button"
                  onClick={() => setEdit(null)}
                  className="rounded-[10px] border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Anuluj
                </button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
