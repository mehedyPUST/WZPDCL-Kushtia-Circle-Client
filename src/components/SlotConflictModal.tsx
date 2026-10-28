"use client";

import { useEffect } from "react";

/**
 * Modal when saving an hourly slot that already has data for that day.
 * Actions: Proceed (replace) | Calculate only | Cancel / Keep previous
 * Close via X, Esc, backdrop click, or Cancel.
 */
export default function SlotConflictModal({
  open,
  slotLabel,
  dateLabel,
  existingTotalMW,
  existingTime,
  loading = false,
  onProceed,
  onCalculateOnly,
  onKeepPrevious,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        onKeepPrevious?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onKeepPrevious]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-conflict-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onKeepPrevious?.();
      }}
    >
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-app overflow-hidden relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => onKeepPrevious?.()}
          aria-label="Close"
          title="Close (Esc)"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-app hover:bg-surface-3 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pt-5 pb-3 pr-12">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center text-lg font-bold">
              !
            </div>
            <div className="min-w-0">
              <h3
                id="slot-conflict-title"
                className="text-base font-semibold text-app tracking-tight"
              >
                Existing data for this slot
              </h3>
              <p className="mt-2 text-sm text-secondary leading-relaxed">
                There is already saved data for slot{" "}
                <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-300">
                  {slotLabel}
                </span>{" "}
                on{" "}
                <span className="font-semibold text-app">{dateLabel}</span>.
              </p>
              {(existingTotalMW != null || existingTime) && (
                <p className="mt-2.5 text-xs text-muted bg-surface-2 rounded-lg px-3 py-2 border border-app tabular-nums">
                  Previous:{" "}
                  {existingTotalMW != null && (
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {(Math.round((Number(existingTotalMW) + Number.EPSILON) * 10) / 10).toFixed(1)} MW
                    </span>
                  )}
                  {existingTime && (
                    <span className="ml-1 text-muted">· saved at {existingTime}</span>
                  )}
                </p>
              )}
              <p className="mt-3 text-sm text-secondary">
                Do you want to replace the existing data with this calculation?
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2 bg-surface-2 border-t border-app">
          <button
            type="button"
            disabled={loading}
            onClick={onProceed}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Saving…" : "Proceed — replace existing data"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCalculateOnly}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-app bg-surface border border-app hover:bg-surface-3 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            Calculate only
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onKeepPrevious}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-secondary bg-surface-2 border border-app hover:bg-surface-3 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            Cancel — keep previous data
          </button>
        </div>
      </div>
    </div>
  );
}
