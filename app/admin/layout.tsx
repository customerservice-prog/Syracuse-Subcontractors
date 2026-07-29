// Persistent section-navigation sidebar for the admin dashboard. The
// dashboard itself stays a single server-rendered page (app/admin/page.tsx)
// for simplicity - this layout adds an in-page anchor nav alongside it so
// long dashboard doesn't feel like one endless scroll.
const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "#overview", label: "Overview" },
  { href: "#interests", label: "Contractor interests" },
  { href: "#job-requests", label: "Job requests" },
  { href: "#dispatch", label: "Dispatch" },
  { href: "#hours", label: "Hours awaiting approval" },
  { href: "#invoices", label: "Invoices" },
  { href: "#jobs", label: "Active jobs" },
  { href: "#notifications", label: "Notifications" },
  { href: "#crews", label: "Crews" },
  { href: "#applications", label: "Applications" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-24 lg:w-56 lg:flex-shrink-0">
        <nav className="space-y-0.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Jump to section
          </p>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
