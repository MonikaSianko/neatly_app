import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { label: "Nadchodzące", active: true },
  { label: "Wydatki", active: false },
  { label: "Przychody", active: false },
] as const;

const UPCOMING_ROWS = [
  { kind: "-", title: "Czynsz", category: "🏠 Dom", date: "5 wrz", amount: "2 400,00 zł", overdue: false },
  { kind: "-", title: "Prąd", category: "💡 Rachunki", date: "12 wrz", amount: "180,50 zł", overdue: false },
  { kind: "+", title: "Wynagrodzenie", category: "💼 Wynagrodzenie", date: "1 wrz", amount: "8 200,00 zł", overdue: true },
] as const;

const BUDGET_TILES = [
  { emoji: "🛒", name: "Zakupy spożywcze", color: "var(--neatly-cat-01)", spent: 1240, limit: 2500 },
  { emoji: "🚗", name: "Samochód", color: "var(--neatly-cat-16)", spent: 640, limit: 500 },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header walletName="Płatności miesięczne" email={user.email ?? null} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:grid md:grid-cols-[1fr_320px] md:items-start md:gap-6 md:p-6">
        {/* Prawa kolumna na mobile jest u góry */}
        <aside className="order-1 flex flex-col gap-4 md:order-2">
          <section className="rounded-[14px] border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stan początkowy</span>
              <span className="tabular font-medium">3 500,00 zł</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground">Przychody</div>
                <div className="tabular text-[18px] font-semibold">8 200,00 zł</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Wydatki</div>
                <div className="tabular text-[18px] font-semibold">4 820,50 zł</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Balans miesiąca</div>
                <div className="tabular text-[18px] font-semibold" style={{ color: "var(--neatly-primary-dark)" }}>
                  3 379,50 zł
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Faktyczny balans</div>
                <div className="tabular text-[18px] font-semibold">−2 400,00 zł</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Stan konta na koniec miesiąca</span>
              <span className="tabular font-semibold">1 100,00 zł</span>
            </div>
          </section>

          <section className="rounded-[14px] border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Budżety wydatków</h2>
              <button type="button" className="rounded-[10px] border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                Ustaw budżet
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {BUDGET_TILES.map((tile) => {
                const pct = Math.min(100, Math.round((tile.spent / tile.limit) * 100));
                const over = tile.spent > tile.limit;
                return (
                  <div key={tile.name} className="rounded-[10px] border border-border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span aria-hidden>{tile.emoji}</span>
                        {tile.name}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {tile.spent.toLocaleString("pl-PL")} / {tile.limit.toLocaleString("pl-PL")} zł
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full" style={{ background: "var(--neatly-primary-soft)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, background: tile.color }}
                      />
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: over ? "var(--destructive)" : "var(--muted-foreground)" }}>
                      {over
                        ? `Przekroczono o ${(tile.spent - tile.limit).toLocaleString("pl-PL")} zł`
                        : `Zostało ${(tile.limit - tile.spent).toLocaleString("pl-PL")} zł`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        {/* Lewa kolumna: zakładki */}
        <section className="order-2 flex flex-col gap-3 md:order-1">
          <div className="flex gap-1 rounded-full border border-border bg-card p-1 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={
                  tab.active
                    ? { background: "var(--neatly-primary-soft)", color: "var(--neatly-primary-dark)" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-[14px] border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {UPCOMING_ROWS.map((row) => (
                  <tr key={row.title} className="border-b border-border last:border-0">
                    <td className="w-8 py-2 pl-4 text-center text-muted-foreground">{row.kind}</td>
                    <td className="py-2 font-medium">{row.title}</td>
                    <td className="py-2 text-muted-foreground">{row.category}</td>
                    <td className="py-2" style={{ color: row.overdue ? "var(--destructive)" : undefined }}>
                      {row.date}
                      {row.overdue && <span className="ml-1 text-[11px]">zaległe</span>}
                    </td>
                    <td className="tabular py-2 pr-4 text-right font-medium">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              3 poz. · suma netto 5 619,50 zł
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        aria-label="Dodaj pozycję"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg"
        style={{ background: "var(--primary)" }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </>
  );
}
