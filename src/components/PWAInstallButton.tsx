"use client";

import { useState } from "react";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface PWAInstallButtonProps {
  variant?: "topbar" | "drawer";
  onAction?: () => void;
}

export default function PWAInstallButton({
  variant = "topbar",
  onAction,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAction?.();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === "drawer" ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl text-[12px] font-semibold text-accent bg-[var(--app-accent-dim)] hover:opacity-90 border border-[var(--app-accent-border)] transition-all"
          title="Install WZPDCL Load Calculator for offline access"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Install Offline App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-accent bg-[var(--app-accent-dim)] hover:opacity-90 border border-[var(--app-accent-border)] transition-all whitespace-nowrap shrink-0"
          title="Install WZPDCL Load Calculator for offline access"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Install App</span>
          <span className="xl:hidden">Install</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[var(--app-overlay)] backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install on iPhone or iPad"
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-app p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[var(--app-accent-dim)] border border-[var(--app-accent-border)] flex items-center justify-center text-accent shrink-0">
                  <Smartphone className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-app leading-tight">
                    Install WZPDCL Load
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Use the calculator offline anytime
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-app hover:bg-surface-3 border border-app transition-colors"
                aria-label="Close instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-2.5 text-xs text-secondary">
              <li className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 border border-app">
                <Share className="w-4 h-4 text-accent shrink-0" />
                <span>
                  1. Tap the <strong className="text-app">Share</strong> button
                  in Safari&apos;s toolbar.
                </span>
              </li>
              <li className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 border border-app">
                <PlusSquare className="w-4 h-4 text-accent shrink-0" />
                <span>
                  2. Scroll down and tap{" "}
                  <strong className="text-app">Add to Home Screen</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => {
                setShowIOSGuide(false);
                onAction?.();
              }}
              className="btn-primary w-full min-h-[42px] rounded-xl text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
