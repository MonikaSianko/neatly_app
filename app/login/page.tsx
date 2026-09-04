import { Suspense } from "react";
import { GoogleLoginButton } from "@/components/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-3">
        <img src="/neatly-icon.svg" alt="Neatly" className="h-14 w-14 rounded-[14px]" />
        <div className="text-center">
          <h1 className="text-lg font-semibold">Neatly</h1>
          <p className="text-sm text-muted-foreground">Budżet rodzinny</p>
        </div>
      </div>
      <Suspense>
        <GoogleLoginButton />
      </Suspense>
    </main>
  );
}
