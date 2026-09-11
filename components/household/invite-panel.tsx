"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { createHouseholdInvite } from "@/app/household/actions";
import { useLocale } from "@/components/locale-provider";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/lib/use-action";

type Invite = { code: string; expires_at: string };

const INTL_LOCALE = { pl: "pl-PL", en: "en-GB" } as const;

export function InvitePanel({
  householdId,
  initialInvite,
}: {
  householdId: string;
  initialInvite: Invite | null;
}) {
  const { locale, t } = useLocale();
  const [invite, setInvite] = useState<Invite | null>(initialInvite);
  const [copied, setCopied] = useState(false);
  const { pending, error, run } = useAction();

  function generate() {
    run(
      async () => {
        const result = await createHouseholdInvite(householdId);
        if (result.error) return result;
        setInvite(result.invite ?? null);
        setCopied(false);
      },
      { refresh: false }
    );
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
            <div className="tabular text-base font-medium">{invite.code}</div>
            <div className="text-xs text-muted-foreground">
              {t.validUntil} {new Date(invite.expires_at).toLocaleDateString(INTL_LOCALE[locale])}
            </div>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-[10px] border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t.codeCopied : t.copyCode}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-[10px] border border-border px-3 py-2 text-base font-medium hover:bg-muted disabled:opacity-50"
        >
          {pending && <Spinner />}
          {t.invitePerson}
        </button>
      )}
      {error && <span className="text-sm" style={{ color: "var(--destructive)" }}>{error}</span>}
    </div>
  );
}
