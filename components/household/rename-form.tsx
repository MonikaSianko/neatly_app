"use client";

import { useState } from "react";
import { renameHousehold } from "@/app/household/actions";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";

export function RenameForm({ householdId, initialName }: { householdId: string; initialName: string }) {
  const { t } = useLocale();
  const [name, setName] = useState(initialName);
  const { pending, error, run } = useAction();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(() => renameHousehold(householdId, name), { refresh: false });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2 text-base font-medium"
        aria-label={t.householdName}
      />
      <button
        type="submit"
        disabled={pending || name.trim() === initialName}
        className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-base font-medium hover:bg-muted disabled:opacity-50"
      >
        {pending && <Spinner />}
        {t.save}
      </button>
      {error && <span className="text-sm" style={{ color: "var(--destructive)" }}>{error}</span>}
    </form>
  );
}
