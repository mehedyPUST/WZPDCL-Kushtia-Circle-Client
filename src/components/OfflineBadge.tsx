"use client";

import { useEffect, useState } from "react";
import { CloudUpload, WifiOff } from "lucide-react";

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
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-800 dark:text-amber-100 border border-amber-500/40">
          <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          Offline Mode
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
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-sky-500/15 text-sky-800 dark:text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 disabled:opacity-60 transition-all"
        >
          <CloudUpload className="w-3 h-3 shrink-0" />
          {syncing ? "Syncing…" : `${pendingCount} pending sync`}
        </button>
      )}
      {syncing && pendingCount === 0 && (
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-200">
          Syncing…
        </span>
      )}
    </div>
  );
}

