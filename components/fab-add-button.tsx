"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TransactionForm } from "@/components/transaction-form";
import { useLocale } from "@/components/locale-provider";

type Category = { id: string; name: string; emoji: string; kind: "expense" | "income" };

export function FabAddButton({
  householdId,
  walletId,
  categories,
  defaultDate,
}: {
  householdId: string;
  walletId: string;
  categories: Category[];
  defaultDate: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t.addEntry}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg"
        style={{ background: "var(--primary)" }}
      >
        <Plus className="h-6 w-6" />
      </button>
      <TransactionForm
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        walletId={walletId}
        categories={categories}
        defaultDate={defaultDate}
      />
    </>
  );
}
