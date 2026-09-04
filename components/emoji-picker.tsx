"use client";

import { useState } from "react";

const EMOJIS = [
  "🛒", "🍔", "🏠", "💡", "🚗", "🚌", "📺", "🎁", "🎉", "💊", "💄", "🐾",
  "👶", "📚", "⚽", "💳", "🐖", "📦", "✈️", "☕", "🍺", "🎬", "🧾", "🔧",
  "🌱", "🎓", "💼", "🌟", "↩️", "📈", "🏷️", "💰", "🎸", "🧴", "🚲", "🍼",
];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-12 items-center justify-center rounded-[10px] border border-border bg-muted text-xl"
      >
        {value || "🙂"}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 grid grid-cols-9 gap-1 rounded-[10px] border border-border bg-card p-2 shadow-md">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className="rounded py-1 text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
