import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  const { data: householdId, error } = await supabase.rpc("redeem_household_invite", {
    invite_code: code,
  });

  if (error || !householdId) {
    return (
      <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Nieprawidłowy kod zaproszenia</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ten kod jest błędny albo już wygasł. Poproś o nowe zaproszenie osobę z gospodarstwa.
        </p>
      </main>
    );
  }

  redirect("/");
}
