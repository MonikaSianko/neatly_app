export type Locale = "pl" | "en";

export const STR = {
  pl: {
    wallet: "Portfel", newWallet: "Nowy portfel", createWallet: "Utwórz portfel", walletName: "Nazwa",
    icon: "Ikona", expenses: "Wydatki", income: "Przychody", expense: "Wydatek", incomeOne: "Przychód",
    upcoming: "Nadchodzące", noUpcoming: "Nic nie czeka na opłacenie w tym miesiącu.",
    opening: "Stan początkowy", closing: "Stan konta na koniec miesiąca",
    editOpening: "Stan początkowy miesiąca", carryPrev: "Przenieś z poprzedniego miesiąca",
    openingHint: "Ile masz na koncie pierwszego dnia miesiąca. Nic nie przenosi się automatycznie — wpisujesz albo przenosisz jednym kliknięciem.",
    balance: "Balans miesiąca", actualBalance: "Faktyczny balans",
    budgets: "Budżety wydatków", setBudget: "Ustaw budżet", editBudget: "Edytuj budżet", newBudget: "Nowy budżet wydatków",
    budgetsEmpty: "Przypisz miesięczny limit do kategorii, żeby zarezerwować na nią pieniądze w tym portfelu.",
    copyPrev: "Skopiuj budżety z poprzedniego miesiąca", limitMonth: "Limit na miesiąc (PLN)",
    budgetHint: "Limit rezerwuje pieniądze w wydatkach miesiąca. Dopóki wydasz mniej, do sumy wchodzi cała kwota limitu; po przekroczeniu — rzeczywista suma pozycji.",
    left: "Zostało", over: "Przekroczono o", pickCatAmount: "Wybierz kategorię i podaj kwotę.",
    emptyList: "Brak pozycji w tym miesiącu. Dodaj pierwszą, żeby zobaczyć podsumowanie.",
    addEntry: "Dodaj pozycję", newEntry: "Nowa pozycja", editEntry: "Edytuj pozycję",
    title: "Tytuł", category: "Kategoria", date: "Data", amount: "Kwota", repeat: "Powtarzaj", until: "Do kiedy",
    paid: "Opłacone", received: "Otrzymane", overdue: "zaległe",
    save: "Zapisz", cancel: "Anuluj", edit: "Edytuj", del: "Usuń", moveNext: "Przenieś na następny miesiąc",
    never: "Nigdy", daily: "Codziennie", weekly: "Co tydzień", pickedDays: "Wybrane dni tygodnia",
    biweekly: "Co dwa tygodnie", monthly: "Co miesiąc", yearly: "Co rok", custom: "Niestandardowo",
    noEnd: "Bez końca", untilDay: "Do dnia",
    scopeEditTitle: "Zapisz zmianę", scopeDelTitle: "Usuń płatność cykliczną",
    scopeIntro: "Ta pozycja należy do serii. Wybierz, czego ma dotyczyć zmiana.",
    scopeThis: "To wystąpienie", scopeThisH: "Pozostałe raty zostają bez zmian.",
    scopeFuture: "To i przyszłe", scopeFutureH: "Wcześniejsze raty zostają nietknięte.",
    scopeAll: "Wszystkie", scopeAllH: "Opłacone raty i ręczne wyjątki zostają zachowane.",
    categories: "Kategorie", newCategory: "Nowa kategoria", saveCategory: "Zapisz kategorię",
    color: "Kolor", archived: "Zarchiwizowane", restore: "Przywróć",
    household: "Gospodarstwo domowe", members: "Członkowie", inviteCode: "Kod zaproszenia",
    owner: "właściciel", member: "członek", invitePerson: "Zaproś osobę", copyCode: "Kopiuj",
    codeCopied: "Skopiowano", validUntil: "Ważny do", householdName: "Nazwa gospodarstwa",
    quickAdd: "Szybkie dodawanie", opening2: "Stan początkowy",
    recurrence: "Cykliczność", apply: "Zastosuj", clearRepeat: "Wyłącz cykliczność",
    addRow: "Dodaj wiersz", saveAll: "Zapisz wszystko", rows: "poz.", clearRow: "Usuń wiersz",
    quickHint: "Wklej dane z arkusza albo wpisz ręcznie. Enter dodaje kolejny wiersz, data i kategoria kopiują się z poprzedniego.",
    netTotal: "suma netto",
    language: "Język", logout: "Wyloguj",
    signInGoogle: "Zaloguj przez Google", tagline: "Budżet rodzinny",
  },
  en: {
    wallet: "Wallet", newWallet: "New wallet", createWallet: "Create wallet", walletName: "Name",
    icon: "Icon", expenses: "Expenses", income: "Income", expense: "Expense", incomeOne: "Income",
    upcoming: "Upcoming", noUpcoming: "Nothing waiting to be paid this month.",
    opening: "Opening balance", closing: "Account at month end",
    editOpening: "Opening balance", carryPrev: "Carry over from last month",
    openingHint: "What sits in the account on day one of the month. Nothing carries over on its own — type it in or carry it over in one click.",
    balance: "Month balance", actualBalance: "Actual balance",
    budgets: "Spending budgets", setBudget: "Set budget", editBudget: "Edit budget", newBudget: "New spending budget",
    budgetsEmpty: "Give a category a monthly limit to reserve money for it in this wallet.",
    copyPrev: "Copy budgets from last month", limitMonth: "Monthly limit (PLN)",
    budgetHint: "A limit reserves money in the month's expenses. Spend less and the full limit still counts; go over and the real total counts instead.",
    left: "Left", over: "Over by", pickCatAmount: "Pick a category and enter an amount.",
    emptyList: "Nothing here yet. Add your first entry to see the summary.",
    addEntry: "Add entry", newEntry: "New entry", editEntry: "Edit entry",
    title: "Title", category: "Category", date: "Date", amount: "Amount", repeat: "Repeat", until: "Until",
    paid: "Paid", received: "Received", overdue: "overdue",
    save: "Save", cancel: "Cancel", edit: "Edit", del: "Delete", moveNext: "Move to next month",
    never: "Never", daily: "Every day", weekly: "Every week", pickedDays: "Chosen weekdays",
    biweekly: "Every two weeks", monthly: "Every month", yearly: "Every year", custom: "Custom",
    noEnd: "No end date", untilDay: "Until",
    scopeEditTitle: "Save change", scopeDelTitle: "Delete recurring payment",
    scopeIntro: "This entry belongs to a series. Choose what the change applies to.",
    scopeThis: "This entry", scopeThisH: "Other entries stay as they are.",
    scopeFuture: "This and future", scopeFutureH: "Earlier entries stay untouched.",
    scopeAll: "All entries", scopeAllH: "Paid entries and manual exceptions are kept.",
    categories: "Categories", newCategory: "New category", saveCategory: "Save category",
    color: "Colour", archived: "Archived", restore: "Restore",
    household: "Household", members: "Members", inviteCode: "Invite code",
    owner: "owner", member: "member", invitePerson: "Invite someone", copyCode: "Copy",
    codeCopied: "Copied", validUntil: "Valid until", householdName: "Household name",
    quickAdd: "Quick add", opening2: "Opening balance",
    recurrence: "Recurrence", apply: "Apply", clearRepeat: "Turn recurrence off",
    addRow: "Add row", saveAll: "Save all", rows: "items", clearRow: "Remove row",
    quickHint: "Paste rows from a spreadsheet or type them in. Enter starts a new row; date and category carry over.",
    netTotal: "net total",
    language: "Language", logout: "Log out",
    signInGoogle: "Sign in with Google", tagline: "Family Budget",
  },
} as const;

export type Dict = Record<keyof (typeof STR)["pl"], string>;

/** Nazwy kategorii startowych (spec: kategorie uzytkownika nie sa tlumaczone). */
export const CAT_EN: Record<string, string> = {
  "Zakupy spożywcze": "Groceries", "Jedzenie na mieście": "Eating out", "Dom": "House",
  "Rachunki": "Utilities", "Samochód": "Car", "Transport": "Transport", "Subskrypcje": "Subscriptions",
  "Prezenty i darowizny": "Gifts & donations", "Rozrywka": "Entertainment", "Zdrowie": "Health",
  "Higiena i uroda": "Personal care", "Zwierzęta": "Pets", "Dziecko": "Kids", "Edukacja": "Education",
  "Sport": "Sports", "Kredyt / raty": "Loans", "Oszczędności": "Savings", "Inne": "Other",
  "Wynagrodzenie": "Salary", "Premia": "Bonus", "Zwrot": "Refund", "Odsetki": "Interest",
  "Prezent": "Gift", "Sprzedaż": "Sale",
};

export function categoryDisplayName(name: string, locale: Locale): string {
  if (locale === "en" && CAT_EN[name]) return CAT_EN[name];
  return name;
}

export function t(locale: Locale): Dict {
  return STR[locale];
}

export const WEEKDAYS: Record<Locale, string[]> = {
  pl: ["pon", "wt", "śr", "czw", "pt", "sob", "nd"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
