"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || "dev";
const AUTO_CHECK_INTERVAL_MS = 3 * 60 * 1000;

interface SwReply {
  ok?: boolean;
  cleared?: number;
}

function sendSwMessage(
  worker: ServiceWorker | null | undefined,
  payload: { type: "SKIP_WAITING" | "CLEAR_CACHES" }
): Promise<SwReply> {
  if (!worker) return Promise.resolve({ ok: false });
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve({ ok: false }), 2500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve((event.data as SwReply) || { ok: true });
    };
    try {
      worker.postMessage(payload, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve({ ok: false });
    }
  });
}

export interface CheckUpdatesResult {
  hasUpdate: boolean;
  offline?: boolean;
}

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [upToDate, setUpToDate] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [latestBuildId, setLatestBuildId] = useState<string | null>(null);
  const lastAutoCheckRef = useRef<number>(0);

  const checkForUpdates = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}): Promise<CheckUpdatesResult> => {
      if (typeof window === "undefined") {
        return { hasUpdate: false };
      }

      if (!navigator.onLine) {
        if (!silent) {
          toast.error("You are offline — connect to the internet to check for updates");
        }
        return { hasUpdate: false, offline: true };
      }

      setChecking(true);
      setUpToDate(false);

      let hasWaitingWorker = false;
      let hasNewBuild = false;

      try {
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
              await registration.update();
              if (registration.waiting) {
                hasWaitingWorker = true;
              }
            }
          } catch {
            // SW may be disabled in dev or unavailable in this browser
          }
        }

        try {
          const res = await fetch(`/api/health?t=${Date.now()}`, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          });
          if (res.ok) {
            const data = (await res.json()) as { buildId?: string };
            if (data?.buildId) {
              setLatestBuildId(data.buildId);
              if (
                CURRENT_BUILD_ID !== "dev" &&
                data.buildId !== "dev" &&
                data.buildId !== CURRENT_BUILD_ID
              ) {
                hasNewBuild = true;
              }
            }
          }
        } catch {
          // Ignore network probe error if health endpoint is unreachable
        }

        const foundUpdate = hasWaitingWorker || hasNewBuild;
        setLastCheckedAt(new Date());
        lastAutoCheckRef.current = Date.now();

        if (foundUpdate) {
          setUpdateAvailable(true);
          if (!silent) {
            toast.success("New app update found — click Update App to reload");
          }
          return { hasUpdate: true };
        }

        setUpToDate(true);
        if (!silent) {
          toast.success("You are on the latest available version");
        }
        return { hasUpdate: false };
      } finally {
        setChecking(false);
      }
    },
    []
  );

  const applyUpdate = useCallback(async () => {
    if (typeof window === "undefined") return false;

    if (!navigator.onLine) {
      toast.error("You are offline — keeping cached app available");
      return false;
    }

    setUpdating(true);
    const toastId = toast.loading("Updating app to the latest version...");

    try {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update().catch(() => undefined);
            if (registration.waiting) {
              await sendSwMessage(registration.waiting, { type: "SKIP_WAITING" });
            }
            const targetWorker =
              registration.active || registration.waiting || navigator.serviceWorker.controller;
            await sendSwMessage(targetWorker, { type: "CLEAR_CACHES" });
          }
        } catch {
          // Fall through to direct CacheStorage cleanup
        }
      }

      if ("caches" in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        } catch {
          // Ignore CacheStorage deletion errors
        }
      }

      toast.success("Latest app synced — reloading...", { id: toastId });

      window.setTimeout(() => {
        window.location.reload();
      }, 180);

      return true;
    } catch {
      toast.error("Could not refresh app cache", { id: toastId });
      setUpdating(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const onOnline = () => {
      setIsOnline(true);
      if (Date.now() - lastAutoCheckRef.current >= AUTO_CHECK_INTERVAL_MS) {
        void checkForUpdates({ silent: true });
      }
    };
    const onOffline = () => setIsOnline(false);

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        Date.now() - lastAutoCheckRef.current >= AUTO_CHECK_INTERVAL_MS
      ) {
        void checkForUpdates({ silent: true });
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    let cleanupSwListeners: (() => void) | undefined;

    if ("serviceWorker" in navigator) {
      let cancelled = false;
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (cancelled || !registration) return;

          if (registration.waiting) {
            setUpdateAvailable(true);
          }

          const handleUpdateFound = () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateAvailable(true);
              }
            });
          };

          registration.addEventListener("updatefound", handleUpdateFound);
          cleanupSwListeners = () => {
            registration.removeEventListener("updatefound", handleUpdateFound);
          };
        })
        .catch(() => undefined);

      // Delayed initial silent update check after hydration
      const initialTimer = window.setTimeout(() => {
        if (navigator.onLine) {
          void checkForUpdates({ silent: true });
        }
      }, 1500);

      return () => {
        cancelled = true;
        window.clearTimeout(initialTimer);
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        cleanupSwListeners?.();
      };
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkForUpdates]);

  return {
    updateAvailable,
    checking,
    updating,
    isOnline,
    upToDate,
    lastCheckedAt,
    currentBuildId: CURRENT_BUILD_ID,
    latestBuildId,
    checkForUpdates,
    applyUpdate,
  };
}
