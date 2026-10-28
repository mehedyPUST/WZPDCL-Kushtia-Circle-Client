"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listPendingSaves,
  removePendingSave,
  bumpAttempt,
  countPendingSaves,
} from "@/lib/offlineQueue";
import { saveCalculation } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

/**
 * Auto-sync pending offline saves when browser is online and user is logged in.
 */
export function useOfflineSync({ enabled = true, onSynced } = {}) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const n = await countPendingSaves();
      setPendingCount(n);
      return n;
    } catch {
      setPendingCount(0);
      return 0;
    }
  }, []);

  const syncPending = useCallback(async () => {
    if (!enabled || syncingRef.current) return { synced: 0, failed: 0 };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }
    if (!getStoredToken()) {
      // Need auth to save to API
      await refreshCount();
      return { synced: 0, failed: 0 };
    }

    syncingRef.current = true;
    setSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const rows = await listPendingSaves();
      for (const row of rows) {
        try {
          await saveCalculation(row.payload);
          await removePendingSave(row.id);
          synced += 1;
        } catch (err) {
          failed += 1;
          try {
            await bumpAttempt(row.id);
          } catch {
            // ignore
          }
          // Stop on auth errors — no point continuing
          const msg = String(err?.message || "");
          if (msg.includes("log in") || msg.includes("401") || msg.includes("Authentication")) {
            break;
          }
        }
      }
      if (synced > 0) {
        onSynced?.(synced);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }

    return { synced, failed };
  }, [enabled, onSynced, refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    // Sync offline-queued saves strictly when network availability toggles back online
    const onOnline = () => {
      setOnline(true);
      syncPending();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncPending]);

  return {
    pendingCount,
    syncing,
    online,
    syncPending,
    refreshCount,
  };
}
