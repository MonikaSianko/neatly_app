"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Check, Plus, Pencil } from "lucide-react";
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
import { createWallet, updateWallet } from "@/lib/actions/wallets";
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

  // null = arkusz zamkniety, "new" = nowy portfel, id = edycja istniejacego.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [navPending, startNav] = useTransition();
  // Nazwa portfela zmienia sie od razu po kliknieciu, a dane doladowuja sie pod szkieletem.
  // useOptimistic sam wraca do wartosci z URL, wiec przycisk "wstecz" nie zostawia stalej nazwy.
  const [optimisticWalletId, setOptimisticWalletId] = useOptimistic(activeWalletId);
  const active = wallets.find((w) => w.id === optimisticWalletId);

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("wallet", id);
    startNav(() => {
      setOptimisticWalletId(id);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function openCreate() {
    setName("");
    setEmoji("📁");
    setError(null);
    setEditingId("new");
  }

  function openEdit(wallet: Wallet) {
    setName(wallet.name);
    setEmoji(wallet.emoji ?? "📁");
    setError(null);
    setEditingId(wallet.id);
  }

  function submitWallet(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editingId && editingId !== "new") {
        const result = await updateWallet(editingId, name, emoji);
        if (result.error) {
          setError(result.error);
          return;
        }
        setEditingId(null);
        setError(null);
        router.refresh();
        return;
      }

      const result = await createWallet(householdId, name, emoji);
      if (result.error || !result.wallet) {
        setError(result.error);
        return;
      }
      setEditingId(null);
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
            className="flex min-h-9 shrink-0 items-center gap-1 rounded-[10px] border border-border bg-card px-2.5 text-base font-medium transition-opacity sm:min-h-8 sm:px-3"
            style={{ opacity: navPending ? 0.6 : 1 }}
          >
            <span aria-hidden>{active?.emoji}</span>
            <span className="hidden max-w-36 truncate sm:inline">{active?.name}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {wallets.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => select(w.id)}>
              <span aria-hidden>{w.emoji}</span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === active?.id && <Check className="h-4 w-4" />}
              <button
                type="button"
                aria-label={`${t.edit}: ${w.name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openEdit(w);
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t.newWallet}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingId === "new" ? t.newWallet : t.editWallet}</SheetTitle>
          </SheetHeader>
          <form onSubmit={submitWallet} className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <label className="mb-1.5 block text-base font-medium">{t.walletName}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Wakacje 2027"
                className="w-full rounded-[10px] border border-border bg-muted px-3 py-2 text-base"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-base font-medium">{t.icon}</label>
              <EmojiPicker value={emoji} onChange={setEmoji} />
            </div>
            {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-[10px] px-4 py-2.5 text-base font-medium text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {editingId === "new" ? t.createWallet : t.save}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
