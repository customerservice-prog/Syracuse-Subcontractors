import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { getActingUser } from "@/lib/auth/get-acting-user";
import { signOutAction } from "@/lib/auth/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

// Dashboard routing by role - kept in sync with middleware.ts route groups
// and app/login/actions.ts's post-login redirect so a signed-in user always
// has one obvious way back to their own dashboard from any page.
function dashboardPathForRole(role?: string | null): string | null {
  switch (role) {
    case "SUPER_ADMIN":
    case "DISPATCHER":
      return "/admin";
    case "CONTRACTOR_OWNER":
    case "CONTRACTOR_MANAGER":
    case "SUPERVISOR":
      return "/contractor";
    case "WORKER":
      return "/worker";
    default:
      return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actingUser = await getActingUser();
  const dashboardPath = dashboardPathForRole(actingUser?.role);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <a href="/" className="text-lg font-semibold text-brand">
              {brand.shortName}
            </a>
            <nav className="flex items-center gap-4 text-sm">
              {actingUser ? (
                <>
                  {dashboardPath ? (
                    <a href={dashboardPath} className="hover:text-brand">
                      Dashboard
                    </a>
                  ) : null}
                  <form action={signOutAction}>
                    <button type="submit" className="hover:text-brand">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/apply" className="hover:text-brand">Apply to work</a>
                  <a href="/contractor-interest" className="hover:text-brand">Hire workers</a>
                  <a href="/login" className="hover:text-brand">Log in</a>
                </>
              )}
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
