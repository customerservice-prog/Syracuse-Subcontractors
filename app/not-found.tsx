import Link from "next/link";

// Custom 404 page so unmatched routes get the same professional, branded
// treatment as the rest of the app instead of Next.js's bare default.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        404 error
      </span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        We can&apos;t find that page
      </h1>
      <p className="mt-3 text-slate-600">
        The page you&apos;re looking for may have been moved or no longer exists.
        Let&apos;s get you back on track.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
        >
          Go to homepage
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
