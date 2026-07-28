"use client";

import { useEffect } from "react";

// App-level error boundary. Next.js requires this to be a client component.
// Replaces the default unstyled error screen with a branded, reassuring
// message and a retry action, matching the rest of the site's design.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the console for now; a real error-tracking provider can be
    // wired in here later without touching the UI.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="text-sm font-semibold uppercase tracking-wide text-red-600">
        Something went wrong
      </span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Unexpected error
      </h1>
      <p className="mt-3 text-slate-600">
        We hit a snag loading this page. You can try again, or head back to
        the homepage.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Go to homepage
        </a>
      </div>
    </div>
  );
}
