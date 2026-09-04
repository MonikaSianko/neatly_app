import { UserMenu } from "@/components/user-menu";
import { WalletSwitcher } from "@/components/wallet-switcher";
import { MonthNav } from "@/components/month-nav";
import type { Category } from "@/components/category-manager";
import type { YearMonth } from "@/lib/month";

type Wallet = { id: string; name: string; emoji: string | null };

export function Header({
  wallets,
  activeWalletId,
  householdId,
  categories,
  email,
  ym,
}: {
  wallets: Wallet[];
  activeWalletId: string;
  householdId: string;
  categories: Category[];
  email: string | null;
  ym: YearMonth;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <img src="/neatly-icon.svg" alt="Neatly" className="h-7 w-7 rounded-[8px]" />
          <span className="hidden text-sm font-medium sm:inline">Neatly</span>
        </div>

        <WalletSwitcher wallets={wallets} activeWalletId={activeWalletId} householdId={householdId} />

        <div className="flex flex-1 items-center justify-center">
          <MonthNav ym={ym} />
        </div>

        <UserMenu email={email} householdId={householdId} categories={categories} />
      </div>
    </header>
  );
}
