"use client";

import { useRouter } from "next/navigation";
import { Home, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email }: { email: string | null }) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu użytkownika"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <UserRound className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {email && <DropdownMenuLabel className="font-normal text-muted-foreground">{email}</DropdownMenuLabel>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/household")}>
          <Home className="h-4 w-4" />
          Gospodarstwo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout}>
          <LogOut className="h-4 w-4" />
          Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
