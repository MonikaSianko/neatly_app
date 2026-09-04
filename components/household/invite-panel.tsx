"use client";

import { useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { createHouseholdInvite } from "@/app/household/actions";

type Invite = { code: string; expires_at: string };

export function InvitePanel({
  householdId,
  initialInvite,
}: {
  householdId: string;
  initialInvite: Invite | null;
}) {
  const [invite, setInvite] = useState<Invite | null>(initialInvite);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await createHouseholdInvite(householdId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setInvite(result.invite ?? null);
      setCopied(false);
    });
  }

  function copyLink() {
    if (!invite) return;
    const url = `${window.location.origin}/join/${invite.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {invite ? (
        <div className="flex items-center justify-between rounded-[10px] border border-border p-3">
          <div>
            <div className="tabular text-sm font-medium">{invite.code}</div>
            <div className="text-[11px] text-muted-foreground">
              Ważny do {new Date(invite.expires_at).toLocaleDateString("pl-PL")}
            </div>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Skopiowano" : "Kopiuj"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="w-fit rounded-[10px] border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Zaproś osobę
        </button>
      )}
      {error && <span className="text-xs" style={{ color: "var(--destructive)" }}>{error}</span>}
    </div>
  );
}
