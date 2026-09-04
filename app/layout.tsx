import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthBar } from "@/components/auth-bar";
import { NavTabs } from "@/components/nav-tabs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bolas Helper",
  description: "Assistente de análise de jogos de futebol e mercado. Abres e vês o que já foi lido.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-zinc-900 dark:text-zinc-100">
        <header className="bg-emerald-950 text-emerald-50 shadow-[0_1px_0_rgba(198,240,108,0.35)]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight text-lime-300">
              Bolas Helper
            </Link>
            <NavTabs />
            <AuthBar />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
