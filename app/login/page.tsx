import Link from "next/link";
import { brand } from "@/config/brand";
import { loginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? "Unable to sign in. Please try again."
    : null;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-6">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-lg font-bold text-white shadow-sm">
        {brand.shortName.slice(0, 1)}
      </span>

      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">{brand.name} account access</p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Contractor and worker accounts are created by an administrator after
          approval. Contact {brand.supportEmail} for access.
        </p>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/" className="font-medium text-brand-700 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
