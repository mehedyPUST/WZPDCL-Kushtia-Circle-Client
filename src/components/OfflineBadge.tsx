"use client";

import { useEffect, useState } from "react";

export default function OfflineBadge({
  online,
  pendingCount,
  syncing,
  onSyncNow,
}) {
  // Don't render status until after mount so SSR HTML matches the first client paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (online && pendingCount === 0 && !syncing) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {!online && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-100 border border-amber-400/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Offline
        </span>
      )}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing || !online}
          title={
            online
              ? "Tap to sync pending saves now"
              : "Will sync automatically when online"
          }
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-sky-500/20 text-sky-100 border border-sky-400/40 hover:bg-sky-500/30 disabled:opacity-60 transition-all"
        >
          {syncing ? "Syncing…" : `${pendingCount} pending sync`}
        </button>
      )}
      {syncing && pendingCount === 0 && (
        <span className="text-[10px] font-bold text-emerald-200/90">Syncing…</span>
      )}
    </div>
  );
}
