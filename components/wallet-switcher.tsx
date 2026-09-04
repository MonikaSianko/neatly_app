"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmojiPicker } from "@/components/emoji-picker";
import { createWallet } from "@/lib/actions/wallets";
import { useLocale } from "@/components/locale-provider";

type Wallet = { id: string; name: string; emoji: string | null };

export function WalletSwitcher({
  wallets,
  activeWalletId,
  householdId,
}: {
  wallets: Wallet[];
  activeWalletId: string;
  householdId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const active = wallets.find((w) => w.id === activeWalletId);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("wallet", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createWallet(householdId, name, emoji);
      if (result.error || !result.wallet) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setEmoji("📁");
      setError(null);
      select(result.wallet.id);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm font-medium sm:px-3"
          >
            <span aria-hidden>{active?.emoji}</span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{active?.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {wallets.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => select(w.id)}>
              <span aria-hidden>{w.emoji}</span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === activeWalletId && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t.newWallet}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t.newWallet}</SheetTitle>
          </SheetHeader>
          <form onSubmit={submitCreate} className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t.walletName}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Wakacje 2027"
                className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t.icon}</label>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
            {error && <p className="text-xs" style={{ color: "var(--destructive)" }}>{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {t.createWallet}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
