"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/components/locale-provider";

export type Scope = "this" | "future" | "all";

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
  const { t } = useLocale();
  const options: { value: Scope; label: string; hint: string }[] = [
    { value: "this", label: t.scopeThis, hint: t.scopeThisH },
    { value: "future", label: t.scopeFuture, hint: t.scopeFutureH },
    { value: "all", label: t.scopeAll, hint: t.scopeAllH },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="px-4 text-sm text-muted-foreground">{t.scopeIntro}</p>
        <div className="flex flex-col gap-2 p-4 pt-2">
          {options.map((opt) => (
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
