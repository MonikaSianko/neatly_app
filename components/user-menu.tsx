"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Home, Languages, LogOut, Tags, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CategoryManager, type Category } from "@/components/category-manager";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { usePendingSignal } from "@/components/pending-provider";
import { useMediaQuery } from "@/lib/use-media-query";
import type { Locale } from "@/lib/i18n";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
];

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");
  // Wylogowanie konczy sie przeniesieniem na /login, wiec przycisk musi pokazac, ze juz dziala.
  const [loggingOut, startLogout] = useTransition();
  usePendingSignal(loggingOut);

  function logout() {
    startLogout(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  const trigger = (
    <button
      type="button"
      aria-label={t.account}
      className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    >
      <UserRound className="h-5 w-5" />
    </button>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader className="pb-2">
                <SheetTitle>{t.account}</SheetTitle>
                {email && <p className="truncate text-base text-muted-foreground">{email}</p>}
              </SheetHeader>

              <nav className="flex flex-col px-2 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    setCategoriesOpen(true);
                  }}
                  className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-[17px] active:bg-muted"
                >
                  <Tags className="h-5 w-5 text-muted-foreground" />
                  {t.categories}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    router.push("/household");
                  }}
                  className="flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-[17px] active:bg-muted"
                >
                  <Home className="h-5 w-5 text-muted-foreground" />
                  {t.household}
                </button>

                <div className="mt-1 border-t border-border pt-2">
                  <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground">
                    <Languages className="h-4 w-4" />
                    {t.language}
                  </div>
                  {LOCALES.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLocale(l.value)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 pl-11 text-left text-[17px] active:bg-muted"
                    >
                      <span className="flex-1">{l.label}</span>
                      {locale === l.value && <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  disabled={loggingOut}
                  className="mt-1 flex min-h-12 items-center gap-3 rounded-[10px] border-t border-border px-3 text-left text-[17px] active:bg-muted disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Spinner className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <LogOut className="h-5 w-5 text-muted-foreground" />
                  )}
                  {t.logout}
                </button>
              </nav>
          </SheetContent>
        </Sheet>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {email && (
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground" title={email}>
                {email}
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCategoriesOpen(true)}>
              <Tags className="h-4 w-4" />
              {t.categories}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/household")}>
              <Home className="h-4 w-4" />
              {t.household}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="h-4 w-4" />
                <span className="flex-1">{t.language}</span>
                <span className="text-sm text-muted-foreground uppercase">{locale}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-36">
                <DropdownMenuRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                  {LOCALES.map((l) => (
                    <DropdownMenuRadioItem key={l.value} value={l.value}>
                      {l.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} disabled={loggingOut}>
              {loggingOut ? <Spinner /> : <LogOut className="h-4 w-4" />}
              {t.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <CategoryManager
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        householdId={householdId}
        categories={categories}
      />
    </>
  );
}
