"use client";

import { useState, useTransition } from "react";
import { renameHousehold } from "@/app/household/actions";
import { useLocale } from "@/components/locale-provider";

export function RenameForm({ householdId, initialName }: { householdId: string; initialName: string }) {
  const { t } = useLocale();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await renameHousehold(householdId, name);
      setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-[10px] border border-border bg-background px-3 py-2 text-sm font-medium"
        aria-label={t.householdName}
      />
      <button
        type="submit"
        disabled={pending || name.trim() === initialName}
        className="rounded-[10px] border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {t.save}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--destructive)" }}>{error}</span>}
    </form>
  );
}
