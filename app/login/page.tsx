import { Suspense } from "react";
import { GoogleLoginButton } from "@/components/google-login-button";
import { resolveLocale } from "@/lib/locale";
import { t as translate } from "@/lib/i18n";

export default async function LoginPage() {
  const dict = translate(await resolveLocale());

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3">
        <img src="/neatly-icon.svg" alt="Neatly" className="h-14 w-14 rounded-[14px]" />
        <div className="text-center">
          <h1 className="text-xl font-semibold">Neatly</h1>
          <p className="text-base text-muted-foreground">{dict.tagline}</p>
        </div>
      </div>
      <Suspense>
        <GoogleLoginButton />
      </Suspense>
    </main>
  );
}
