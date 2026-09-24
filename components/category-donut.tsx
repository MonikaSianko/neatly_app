/**
 * Pierscien udzialu kategorii w wydatkach. Rysowany obwodem okregu (stroke-dasharray),
 * bez biblioteki wykresow — caly wykres to jeden <circle> na kategorie, a kolory i tak
 * mamy w bazie przy kategoriach.
 *
 * Kolor nie jest jedynym nosnikiem informacji: to samo rozbicie stoi obok jako lista,
 * a czytnik ekranu dostaje je w aria-label.
 */
export type DonutSlice = { id: string; label: string; value: number; color: string };

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Wlosowa przerwa miedzy wycinkami — bez niej sasiednie kategorie zlewaja sie w jedno pole. */
const GAP = 2;

export function CategoryDonut({
  slices,
  label,
  centerLabel,
  centerValue,
  centerHint,
  size = 240,
}: {
  slices: DonutSlice[];
  label: string;
  centerLabel: string;
  centerValue: string;
  centerHint: string;
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // Kazdy wycinek zaczyna sie tam, gdzie skonczyly sie poprzednie — sumy czastkowe zamiast
  // licznika zmienianego w trakcie renderu.
  const lengths = slices.map((slice) => (total > 0 ? (slice.value / total) * CIRCUMFERENCE : 0));
  const arcs = slices.map((slice, i) => ({
    ...slice,
    length: Math.max(0, lengths[i] - GAP),
    offset: lengths.slice(0, i).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label={label}>
        <g transform="rotate(-90 120 120)" fill="none" strokeWidth={26}>
          <circle cx="120" cy="120" r={RADIUS} stroke="var(--muted)" />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx="120"
              cy="120"
              r={RADIUS}
              stroke={arc.color}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
        <span className="tabular text-2xl font-semibold tracking-tight">{centerValue}</span>
        <span className="text-xs text-muted-foreground">{centerHint}</span>
      </div>
    </div>
  );
}
