import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-app">
      <div className="max-w-md w-full bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 rounded-2xl p-8 shadow-sm">
        <h2 className="text-4xl font-bold text-accent mb-2">404</h2>
        <h1 className="text-xl font-semibold text-app mb-3">Page Not Found</h1>
        <p className="text-sm text-muted mb-6">
          The page or route you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
