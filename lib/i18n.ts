export type Locale = "pl" | "en";

export const STR = {
  pl: {
    wallet: "Portfel", newWallet: "Nowy portfel", createWallet: "Utwórz portfel", walletName: "Nazwa",
    editWallet: "Edytuj portfel",
    icon: "Ikona", expenses: "Wydatki", income: "Przychody", expense: "Wydatek", incomeOne: "Przychód",
    upcoming: "Płatności", noUpcoming: "Nic nie czeka na opłacenie w tym miesiącu.",
    paidSection: "Opłacone", sortBy: "Sortuj", sortByDate: "wg daty płatności", sortByAdded: "wg daty dodania",
    dueDate: "Termin", addedDate: "Dodano", details: "Szczegóły",
    searchCategory: "Szukaj kategorii…", noResults: "Brak wyników",
    chooseCategory: "Wybierz kategorię", goBack: "Wstecz",
    splitToggle: "Podziel na kategorie", splitLabel: "Doprecyzuj (opcjonalnie)",
    splitRemainder: "Do rozdzielenia:", addPart: "Dodaj kategorię",
    splitMismatch: "Suma części musi się równać kwocie płatności.",
    splitNoRepeat: "Płatności podzielonej na kategorie nie da się ustawić jako cyklicznej.",
    splitCategories: "kategorie", splitOne: "Płatność dzielona",
    opening: "Stan początkowy",
    editOpening: "Stan początkowy miesiąca", carryPrev: "Przenieś z poprzedniego miesiąca",
    openingHint: "Ile masz na koncie pierwszego dnia miesiąca. Nic nie przenosi się samo — wpisz kwotę albo przenieś ją z poprzedniego miesiąca jednym kliknięciem.",
    plannedExpenses: "Wydatki planowane", accountBalance: "Stan konta",
    balanceWithBudgets: "Balans z budżetami", balanceNow: "Balans na teraz",
    howCounted: "Jak to liczymy",
    incomeInfo:
      "Wszystko, co w tym miesiącu wpływa na konto — wypłaty, zwroty, przelewy. Także pozycje z przyszłą datą, jeszcze nieotrzymane.",
    plannedExpensesInfo:
      "Ile ma kosztować cały miesiąc. W kategorii z budżetem liczy się cały limit, dopóki się w nim mieścisz — te pieniądze są już odłożone. Po jego przekroczeniu liczy się to, co naprawdę wydałaś.",
    accountBalanceInfo:
      "Ile pieniędzy masz w tej chwili. Stan początkowy plus otrzymane wpływy, minus opłacone wydatki. Pozycje, których jeszcze nie odhaczyłaś, nie liczą się tutaj.",
    balanceWithBudgetsInfo:
      "Czy wpływy pokrywają cały plan miesiąca — razem z pieniędzmi odłożonymi na limity. Przychody minus wydatki planowane. Ujemny wynik oznacza, że plan przekracza wpływy, nawet jeśli pieniądze wciąż są na koncie.",
    balanceNowInfo:
      "Ile zostanie, gdy opłacisz wszystko z listy. Przychody minus wszystkie wpisane wydatki, bez pieniędzy odłożonych na limity. Różnica między tą kwotą a balansem z budżetami to limity, których jeszcze nie wykorzystałaś.",
    budgets: "Budżety wydatków", setBudget: "Ustaw budżet", editBudget: "Edytuj budżet", newBudget: "Nowy budżet wydatków",
    budgetsEmpty: "Ustaw kategorii miesięczny limit, a odłożymy na nią pieniądze w tym portfelu — zanim jeszcze je wydasz.",
    copyPrev: "Skopiuj budżety z poprzedniego miesiąca", limitMonth: "Limit na miesiąc (PLN)",
    budgetHint: "Limit odkłada pieniądze na tę kategorię na cały miesiąc. Dopóki się w nim mieścisz, do wydatków wchodzi cała jego kwota; po przekroczeniu — to, co naprawdę wydałaś.",
    left: "Zostało", over: "Przekroczono o", pickCatAmount: "Wybierz kategorię i podaj kwotę.",
    emptyList: "Brak pozycji w tym miesiącu. Dodaj pierwszą, żeby zobaczyć podsumowanie.",
    addEntry: "Dodaj pozycję", newEntry: "Nowa pozycja", editEntry: "Edytuj pozycję",
    title: "Tytuł", category: "Kategoria", date: "Data", amount: "Kwota", repeat: "Powtarzaj", until: "Do kiedy",
    paid: "Opłacone", received: "Otrzymane", overdue: "zaległe",
    save: "Zapisz", cancel: "Anuluj", edit: "Edytuj", del: "Usuń", rowMenu: "Menu pozycji",
    never: "Nigdy", daily: "Codziennie", weekly: "Co tydzień", pickedDays: "Wybrane dni tygodnia",
    biweekly: "Co dwa tygodnie", monthly: "Co miesiąc", yearly: "Co rok", custom: "Niestandardowo",
    noEnd: "Bez końca", untilDay: "Do dnia",
    scopeEditTitle: "Zapisz zmianę", scopeDelTitle: "Usuń płatność cykliczną",
    scopeIntro: "Ta pozycja należy do serii. Wybierz, czego ma dotyczyć zmiana.",
    scopeThis: "To wystąpienie", scopeThisH: "Pozostałe raty zostają bez zmian.",
    scopeFuture: "To i przyszłe", scopeFutureH: "Wcześniejsze raty zostają nietknięte.",
    scopeAll: "Wszystkie", scopeAllH: "Zmienia całą serię; ręcznie edytowane raty zostają bez zmian.",
    scopeAllHDel: "Usuwa całą serię, razem z opłaconymi ratami.",
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
    paymentUrl: "Link do płatności", paymentUrlOptional: "Link do płatności (opcjonalnie)",
    graceDays: "Dni karencji",
    graceDaysHint: "Ile dni po terminie płatność może jeszcze poczekać, zanim oznaczymy ją jako zaległą.",
    payNow: "Zapłać teraz",
    note: "Notatka", noteOptional: "Notatka (opcjonalnie)", showNote: "Pokaż notatkę",
    account: "Konto", close: "Zamknij", back: "Wróć do budżetu",
    categoryNameHint: "Zmieniasz nazwę tylko w aktywnym języku. Drugą zmienisz po przełączeniu języka.",
    automatic: "Pobierana automatycznie",
    automaticHint:
      "Pieniądze schodzą same — polecenie zapłaty albo subskrypcja z karty. Pozycja odhaczy się w dniu płatności; do tego dnia czeka na liście płatności.",
  },
  en: {
    wallet: "Wallet", newWallet: "New wallet", createWallet: "Create wallet", walletName: "Name",
    editWallet: "Edit wallet",
    icon: "Icon", expenses: "Expenses", income: "Income", expense: "Expense", incomeOne: "Income",
    upcoming: "Payments", noUpcoming: "Nothing waiting to be paid this month.",
    paidSection: "Paid", sortBy: "Sort", sortByDate: "by due date", sortByAdded: "by date added",
    dueDate: "Due", addedDate: "Added", details: "Details",
    searchCategory: "Search categories…", noResults: "No results",
    chooseCategory: "Choose a category", goBack: "Back",
    splitToggle: "Split across categories", splitLabel: "Detail (optional)",
    splitRemainder: "Left to split:", addPart: "Add category",
    splitMismatch: "The parts must add up to the payment amount.",
    splitNoRepeat: "A payment split across categories cannot be recurring.",
    splitCategories: "categories", splitOne: "Split payment",
    opening: "Opening balance",
    editOpening: "Opening balance", carryPrev: "Carry over from last month",
    openingHint: "What sits in the account on day one of the month. Nothing carries over on its own — type the amount or bring it from last month in one click.",
    plannedExpenses: "Planned expenses", accountBalance: "Account balance",
    balanceWithBudgets: "Balance with budgets", balanceNow: "Balance right now",
    howCounted: "How this is counted",
    incomeInfo:
      "Everything landing in the account this month — pay, refunds, transfers. Including entries dated later that haven't arrived yet.",
    plannedExpensesInfo:
      "What the whole month is meant to cost. In a category with a budget, the full limit counts while you stay inside it — that money is already set aside. Once you go over, what you actually spent counts instead.",
    accountBalanceInfo:
      "How much money you have right now. Opening balance plus income received, minus expenses paid. Entries you haven't ticked off yet don't count here.",
    balanceWithBudgetsInfo:
      "Whether your income covers the whole plan for the month — including money set aside for limits. Income minus planned expenses. A negative result means the plan outruns what comes in, even if the money is still in the account.",
    balanceNowInfo:
      "What will be left once you pay everything on the list. Income minus every expense entered, with no money set aside for limits. The gap between this and the balance with budgets is the limits you haven't used yet.",
    budgets: "Spending budgets", setBudget: "Set budget", editBudget: "Edit budget", newBudget: "New spending budget",
    budgetsEmpty: "Give a category a monthly limit and we set that money aside in this wallet — before you spend it.",
    copyPrev: "Copy budgets from last month", limitMonth: "Monthly limit (PLN)",
    budgetHint: "A limit sets money aside for this category for the whole month. While you stay within it, the full limit counts as spending; go over and your real total counts instead.",
    left: "Left", over: "Over by", pickCatAmount: "Pick a category and enter an amount.",
    emptyList: "Nothing here yet. Add your first entry to see the summary.",
    addEntry: "Add entry", newEntry: "New entry", editEntry: "Edit entry",
    title: "Title", category: "Category", date: "Date", amount: "Amount", repeat: "Repeat", until: "Until",
    paid: "Paid", received: "Received", overdue: "overdue",
    save: "Save", cancel: "Cancel", edit: "Edit", del: "Delete", rowMenu: "Entry menu",
    never: "Never", daily: "Every day", weekly: "Every week", pickedDays: "Chosen weekdays",
    biweekly: "Every two weeks", monthly: "Every month", yearly: "Every year", custom: "Custom",
    noEnd: "No end date", untilDay: "Until",
    scopeEditTitle: "Save change", scopeDelTitle: "Delete recurring payment",
    scopeIntro: "This entry belongs to a series. Choose what the change applies to.",
    scopeThis: "This entry", scopeThisH: "Other entries stay as they are.",
    scopeFuture: "This and future", scopeFutureH: "Earlier entries stay untouched.",
    scopeAll: "All entries", scopeAllH: "Changes the whole series; manually edited entries stay as they are.",
    scopeAllHDel: "Deletes the whole series, paid entries included.",
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
    paymentUrl: "Payment link", paymentUrlOptional: "Payment link (optional)",
    graceDays: "Grace days",
    graceDaysHint: "How many days past the due date a payment may wait before we mark it overdue.",
    payNow: "Pay now",
    note: "Note", noteOptional: "Note (optional)", showNote: "Show note",
    account: "Account", close: "Close", back: "Back to budget",
    categoryNameHint: "You are editing the name in the active language only. Switch the language to change the other one.",
    automatic: "Charged automatically",
    automaticHint:
      "The money leaves on its own — a direct debit or a card subscription. It ticks itself off on the payment date; until then it waits in the payments list.",
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

/**
 * Kazdy jezyk ma wlasna nazwe kategorii w bazie (name / name_en), wiec zmiana nazwy
 * w jednym jezyku nie rusza drugiego. CAT_EN zostaje tylko jako zapasowe tlumaczenie
 * kategorii startowych, gdyby wiersz nie mial jeszcze name_en.
 */
export function categoryDisplayName(name: string, locale: Locale, nameEn?: string | null): string {
  if (locale !== "en") return name;
  return nameEn?.trim() || CAT_EN[name] || name;
}

export function t(locale: Locale): Dict {
  return STR[locale];
}

export const WEEKDAYS: Record<Locale, string[]> = {
  pl: ["pon", "wt", "śr", "czw", "pt", "sob", "nd"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
