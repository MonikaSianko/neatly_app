import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { UserMenu } from "@/components/user-menu";

export function Header({ walletName, email }: { walletName: string; email: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <img src="/neatly-icon.svg" alt="Neatly" className="h-7 w-7 rounded-[8px]" />
          <span className="hidden text-sm font-medium sm:inline">Neatly</span>
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-sm font-medium sm:px-3"
        >
          <span aria-hidden>💵</span>
          <span className="hidden sm:inline">{walletName}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex flex-1 items-center justify-center gap-0.5">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="min-w-[7rem] rounded-[10px] px-2 py-1 text-center text-sm font-medium hover:bg-muted"
          >
            wrzesień 2026
          </button>
          <button
            type="button"
            aria-label="Następny miesiąc"
            className="rounded-[10px] p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <UserMenu email={email} />
      </div>
    </header>
  );
}
