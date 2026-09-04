import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RenameForm } from "@/components/household/rename-form";
import { InvitePanel } from "@/components/household/invite-panel";

export default async function HouseholdPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/household");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_household_id")
    .eq("user_id", user.id)
    .single();

  const householdId = profile?.active_household_id;
  if (!householdId) redirect("/");

  const { data: household } = await supabase
    .from("households")
    .select("id, name")
    .eq("id", householdId)
    .single();

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: true });

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", memberIds)
    : { data: [] };

  const { data: pendingInvite } = await supabase
    .from("household_invites")
    .select("code, expires_at")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!household) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-lg font-semibold">Gospodarstwo domowe</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Nazwa</h2>
        <RenameForm householdId={household.id} initialName={household.name} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Członkowie</h2>
        <div className="rounded-[14px] border border-border bg-card">
          {(members ?? []).map((member, i) => {
            const p = memberProfiles?.find((mp) => mp.user_id === member.user_id);
            return (
              <div
                key={member.user_id}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div>
                  <div className="font-medium">{p?.display_name || p?.email || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{p?.email}</div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {member.role === "owner" ? "właściciel" : "członek"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Kod zaproszenia</h2>
        <InvitePanel householdId={household.id} initialInvite={pendingInvite ?? null} />
      </section>
    </main>
  );
}
