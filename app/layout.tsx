import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Neatly — Family Budget",
  description: "Budżet rodzinny. Money, neatly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFBFB",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let locale: Locale = "pl";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("locale").eq("user_id", user.id).single();
    if (profile?.locale === "en") locale = "en";
  }

  return (
    <html lang={locale} className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
