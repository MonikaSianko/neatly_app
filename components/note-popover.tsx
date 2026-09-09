"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/components/locale-provider";

/** Notatka pod ikona info. Popover otwierany klikiem/tapnieciem — dziala tak samo na mobile, gdzie hover nie istnieje. */
export function NotePopover({ note }: { note: string }) {
  const { t } = useLocale();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.showNote}
          className="tap-target flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="whitespace-pre-wrap break-words">{note}</PopoverContent>
    </Popover>
  );
}
