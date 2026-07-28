// Lightweight branded loading state shown by Next.js while a route segment
// streams in. Keeps the app feeling responsive instead of a blank white
// flash between navigations.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-700" />
      <p className="text-sm font-medium text-slate-500">Loading...</p>
    </div>
  );
}
