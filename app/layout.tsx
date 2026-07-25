import type { Metadata } from "next";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <a href="/" className="text-lg font-semibold text-brand">
              {brand.shortName}
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/apply" className="hover:text-brand">Apply to work</a>
              <a href="/contractor-interest" className="hover:text-brand">Hire workers</a>
              <a href="/login" className="hover:text-brand">Log in</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-xs text-slate-500">
          {brand.name} - {brand.market}. Work is offered based on contractor demand and is never guaranteed.
        </footer>
      </body>
    </html>
  );
}
