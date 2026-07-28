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

function roleLabel(role?: string | null): string {
  if (!role) return "";
  return role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actingUser = await getActingUser();
  const dashboardPath = dashboardPathForRole(actingUser?.role);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <a href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-sm font-bold text-white">
                {brand.shortName.slice(0, 1)}
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900">{brand.shortName}</span>
            </a>
            <nav className="flex items-center gap-1 text-sm font-medium">
              {actingUser ? (
                <>
                  {dashboardPath ? (
                    <a
                      href={dashboardPath}
                      className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Dashboard
                    </a>
                  ) : null}
                  <span className="mx-1 hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 sm:inline-block">
                    {roleLabel(actingUser.role)}
                  </span>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a
                    href="/apply"
                    className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    Apply to work
                  </a>
                  <a
                    href="/contractor-interest"
                    className="rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    Hire workers
                  </a>
                  <a
                    href="/login"
                    className="ml-1 rounded-md bg-brand-700 px-4 py-2 text-white shadow-sm transition hover:bg-brand-800"
                  >
                    Log in
                  </a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t border-slate-800 bg-slate-900 text-slate-300">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
            <div className="space-y-2">
              <span className="text-base font-bold text-white">{brand.shortName}</span>
              <p className="text-sm text-slate-400">{brand.tagline}</p>
              <p className="text-xs text-slate-500">{brand.market}</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-white">For contractors</p>
              <a href="/contractor-interest" className="block text-slate-400 transition hover:text-white">
                Request workers
              </a>
              <a href="/login" className="block text-slate-400 transition hover:text-white">
                Contractor sign in
              </a>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-white">For workers</p>
              <a href="/apply" className="block text-slate-400 transition hover:text-white">
                Apply to work
              </a>
              <a href="/login" className="block text-slate-400 transition hover:text-white">
                Worker sign in
              </a>
            </div>
          </div>
          <div className="border-t border-slate-800 px-4 py-4 text-xs text-slate-500 sm:px-6">
            <div className="mx-auto max-w-6xl">
              {brand.name} - {brand.market}. Work is offered based on contractor demand and is never guaranteed.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
