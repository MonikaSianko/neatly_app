import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { LOCALE_COOKIE, LOCALE_MAX_AGE, isLocale } from "@/lib/locale";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // ?lang=en otwiera aplikacje w wybranym jezyku — takze zanim ktos sie zaloguje,
  // wiec link mozna wyslac osobie, ktora jeszcze nie ma profilu.
  const lang = request.nextUrl.searchParams.get("lang");
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, {
      path: "/",
      maxAge: LOCALE_MAX_AGE,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
