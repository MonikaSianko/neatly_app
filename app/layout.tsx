import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/locale";

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

  let profileLocale: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("locale").eq("user_id", user.id).single();
    profileLocale = profile?.locale ?? null;
  }
  const locale = await resolveLocale(profileLocale);

  return (
    <html lang={locale} className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
