"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Scope = "this" | "future" | "all";

const OPTIONS: { value: Scope; label: string; hint: string }[] = [
  { value: "this", label: "To wystąpienie", hint: "Pozostałe raty zostają bez zmian." },
  { value: "future", label: "To i przyszłe", hint: "Wcześniejsze raty zostają nietknięte." },
  { value: "all", label: "Wszystkie", hint: "Opłacone raty i ręczne wyjątki zostają zachowane." },
];

export function ScopeDialog({
  open,
  onOpenChange,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onPick: (scope: Scope) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="px-4 text-sm text-muted-foreground">
          Ta pozycja należy do serii. Wybierz, czego ma dotyczyć zmiana.
        </p>
        <div className="flex flex-col gap-2 p-4 pt-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPick(opt.value)}
              className="rounded-[10px] border border-border p-3 text-left hover:bg-muted"
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.hint}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
