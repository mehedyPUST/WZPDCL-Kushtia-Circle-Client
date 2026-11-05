"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-app">
      <div className="max-w-md w-full bg-surface border border-app rounded-2xl p-8 shadow-[var(--app-shadow)]">
        <h2 className="text-3xl font-bold text-danger mb-2">Something went wrong</h2>
        <p className="text-sm text-muted mb-6">
          An unexpected error occurred while loading this view.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
