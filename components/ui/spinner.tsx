import { Loader2 } from "lucide-react";

/** Jeden ksztalt czekania w calej aplikacji — przy przycisku, w wierszu i w arkuszu. */
export function Spinner({ className = "h-4 w-4", label }: { className?: string; label?: string }) {
  return <Loader2 className={`${className} animate-spin`} role="status" aria-label={label} />;
}
