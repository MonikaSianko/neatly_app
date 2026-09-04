"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Languages, LogOut, Tags, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryManager, type Category } from "@/components/category-manager";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/locale-provider";

export function UserMenu({
  email,
  householdId,
  categories,
}: {
  email: string | null;
  householdId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const { locale, t, setLocale } = useLocale();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
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
          <DropdownMenuItem onClick={() => setCategoriesOpen(true)}>
            <Tags className="h-4 w-4" />
            {t.categories}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/household")}>
            <Home className="h-4 w-4" />
            {t.household}
          </DropdownMenuItem>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{t.language}</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["pl", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLocale(l);
                  }}
                  className="px-2.5 py-1 text-xs font-medium uppercase"
                  style={locale === l ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryManager
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        householdId={householdId}
        categories={categories}
      />
    </>
  );
}
