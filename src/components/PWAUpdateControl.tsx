"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles, X } from "lucide-react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";

interface PWAUpdateButtonProps {
  variant?: "topbar" | "drawer" | "compact";
  onAction?: () => void;
}

export function PWAUpdateButton({
  variant = "topbar",
  onAction,
}: PWAUpdateButtonProps) {
  const {
    updateAvailable,
    checking,
    updating,
    isOnline,
    upToDate,
    checkForUpdates,
    applyUpdate,
  } = usePWAUpdate();

  const busy = checking || updating;

  const handleClick = async () => {
    if (busy) return;
    if (updateAvailable) {
      await applyUpdate();
      onAction?.();
      return;
    }
    const res = await checkForUpdates({ silent: false });
    if (res.hasUpdate) {
      return;
    }
  };

  const handleForceRefresh = async () => {
    if (busy) return;
    await applyUpdate();
    onAction?.();
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={
          updateAvailable
            ? "New app update available — tap to update & reload"
            : "Check for latest app updates"
        }
        aria-label={
          updateAvailable ? "Update app to latest version" : "Check for updates"
        }
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all shrink-0 ${
          updateAvailable
            ? "bg-emerald-500/15 border-emerald-500/45 text-emerald-600 dark:text-emerald-400"
            : "bg-surface-3/60 hover:bg-surface-3 border-app text-secondary hover:text-app"
        } disabled:opacity-60`}
      >
        <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        {updateAvailable && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--app-surface)] animate-pulse"
            aria-hidden
          />
        )}
      </button>
    );
  }

  if (variant === "drawer") {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || !isOnline}
          className={`w-full flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
            updateAvailable
              ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/45 text-emerald-700 dark:text-emerald-300"
              : "text-secondary hover:text-app bg-surface-2 hover:bg-surface-3 border-app"
          } disabled:opacity-55`}
          title={
            !isOnline
              ? "Connect to the internet to check for updates"
              : updateAvailable
                ? "Install latest update and reload"
                : "Check for the latest app changes"
          }
        >
          {updateAvailable ? (
            <Sparkles className="w-4 h-4 shrink-0" />
          ) : upToDate ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <RefreshCw className={`w-4 h-4 shrink-0 ${busy ? "animate-spin" : ""}`} />
          )}
          <span>
            {updating
              ? "Updating App..."
              : checking
                ? "Checking for Updates..."
                : updateAvailable
                  ? "Update Available — Reload App"
                  : upToDate
                    ? "App Up to Date (Recheck)"
                    : "Check for App Updates"}
          </span>
        </button>

        {!updateAvailable && isOnline && (
          <button
            type="button"
            onClick={handleForceRefresh}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium text-muted hover:text-app hover:bg-surface-2 transition-colors disabled:opacity-50"
            title="Clear cached app files and reload latest version (keeps drafts & offline queue)"
          >
            <RefreshCw className={`w-3 h-3 ${updating ? "animate-spin" : ""}`} />
            <span>Sync Latest &amp; Clear Cache</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !isOnline}
        title={
          !isOnline
            ? "Offline — cannot check for updates"
            : updateAvailable
              ? "New version available — click to update and reload"
              : "Check for the latest app updates"
        }
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all whitespace-nowrap shrink-0 ${
          updateAvailable
            ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/45 text-emerald-700 dark:text-emerald-300 shadow-sm"
            : "text-secondary hover:text-app bg-surface-2/80 hover:bg-surface-3 border-app"
        } disabled:opacity-55`}
      >
        <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${busy ? "animate-spin" : ""}`} />
        <span className="hidden xl:inline">
          {updating
            ? "Updating..."
            : checking
              ? "Checking..."
              : updateAvailable
                ? "Update App"
                : upToDate
                  ? "Up to date"
                  : "Check Update"}
        </span>
        <span className="xl:hidden">
          {updating ? "Sync..." : updateAvailable ? "Update" : "Sync"}
        </span>
        {updateAvailable && (
          <span
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}

export function PWAUpdateBanner() {
  const { updateAvailable, updating, isOnline, applyUpdate } = usePWAUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || !isOnline || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 px-3 sm:px-5 py-1.5 bg-emerald-500/15 border-b border-emerald-500/35 flex items-center justify-between gap-2 text-xs"
    >
      <div className="flex items-center gap-2 min-w-0 text-emerald-900 dark:text-emerald-100 font-medium">
        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate">
          A newer version of WZPDCL Load Calculator is available.
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void applyUpdate()}
          disabled={updating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors whitespace-nowrap disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 shrink-0 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Updating..." : "Update & Reload"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20 transition-colors"
          aria-label="Dismiss update notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
