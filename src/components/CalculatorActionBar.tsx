"use client";

import { useState } from "react";
import { Calculator, Copy, RotateCcw, Save, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";

const btnBase =
  "rounded-xl font-bold tracking-wide uppercase leading-tight shadow-md active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 focus-visible:ring-2 focus-visible:ring-offset-1";

export default function CalculatorActionBar({
  mode = "normal",
  onCalculateOnly,
  onCalculateAndSaveHour,
  hourSlotLabel,
  hourSlotSpecial,
  onHistory,
  historyLabel,
  onCalculateLoadShed,
  onCopyLoadShed,
  onClear,
  isSaving,
  saveLabel,
  layout = "portrait",
}: {
  mode?: string;
  onCalculateOnly?: () => void;
  onCalculateAndSaveHour?: () => void;
  hourSlotLabel?: string;
  hourSlotSpecial?: boolean;
  onHistory?: () => void;
  historyLabel?: string;
  onCalculateLoadShed?: () => void;
  onCopyLoadShed?: () => void;
  onClear?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  layout?: "portrait" | "landscape";
}) {
  const { isAuthenticated, login, canWrite, isViewer } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const isLS = mode === "loadShed";
  const isLandscape = layout === "landscape";

  const handleHourSaveClick = () => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    if (!canWrite) {
      return;
    }
    onCalculateAndSaveHour?.();
  };

  const btnStyle = isLandscape
    ? {
        height: "2.75rem",
      }
    : {
        height: "var(--calc-btn-h)",
        fontSize: "var(--calc-btn-text)",
        paddingLeft: "0.25rem",
        paddingRight: "0.25rem",
      };

  const lsResponsiveCls = isLandscape
    ? "inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 text-[11px] sm:text-xs"
    : "";

  return (
    <section
      className={
        isLandscape
          ? "flex flex-col items-stretch lg:items-end gap-2 shrink-0"
          : "flex flex-col"
      }
      style={
        isLandscape
          ? undefined
          : {
              paddingLeft: "var(--calc-section-px)",
              paddingRight: "var(--calc-section-px)",
              paddingBottom: "var(--calc-gap)",
              gap: "var(--calc-gap)",
            }
      }
    >
      {isLS ? (
        <div
          className={
            isLandscape
              ? "grid grid-cols-3 sm:flex sm:flex-wrap items-center sm:justify-end gap-2"
              : "grid grid-cols-3"
          }
          style={isLandscape ? undefined : { gap: "var(--calc-gap)" }}
        >
          <button
            type="button"
            onClick={onCalculateLoadShed}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 bg-orange-500 hover:bg-orange-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white border border-orange-600/80 dark:border-amber-500/80 hover:shadow-lg hover:shadow-orange-500/25 dark:hover:shadow-amber-600/30 hover:-translate-y-0.5 focus-visible:ring-orange-400`}
            style={btnStyle}
          >
            {isLandscape && <Zap className="w-3.5 h-3.5 shrink-0" />}
            <span>Calculate LS</span>
          </button>
          <button
            type="button"
            onClick={onCopyLoadShed}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 calc-copy-btn hover:-translate-y-0.5 focus-visible:ring-emerald-500`}
            style={btnStyle}
          >
            {isLandscape && <Copy className="w-3.5 h-3.5 shrink-0" />}
            <span>Copy LS</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isSaving || !onClear}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 calc-reset-btn focus-visible:ring-rose-400`}
            style={btnStyle}
            title="Reset all bus voltages and feeder values"
          >
            {isLandscape && <RotateCcw className="w-3.5 h-3.5 shrink-0" />}
            <span>Reset</span>
          </button>
        </div>
      ) : (
        <div
          className={
            isLandscape
              ? "grid grid-cols-3 sm:flex sm:flex-wrap items-center sm:justify-end gap-2"
              : "grid grid-cols-3"
          }
          style={isLandscape ? undefined : { gap: "var(--calc-gap)" }}
        >
          <button
            type="button"
            onClick={onCalculateOnly}
            disabled={isSaving}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 btn-primary border border-emerald-600/70 hover:opacity-95 hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-emerald-500`}
            style={btnStyle}
          >
            {isLandscape && <Calculator className="w-3.5 h-3.5 shrink-0" />}
            <span>Calculate</span>
          </button>
          <button
            type="button"
            onClick={handleHourSaveClick}
            disabled={isSaving || (isAuthenticated && !canWrite)}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 bg-blue-500 hover:bg-blue-600 dark:bg-sky-600 dark:hover:bg-sky-500 text-white border border-blue-600/70 dark:border-sky-500/80 hover:shadow-lg hover:shadow-blue-500/25 dark:hover:shadow-sky-600/30 hover:-translate-y-0.5 focus-visible:ring-blue-400`}
            style={btnStyle}
            title={
              isAuthenticated && !canWrite
                ? "Viewer account — cannot save"
                : !isAuthenticated
                ? "Sign in to save"
                : hourSlotSpecial
                ? `Special slot ${hourSlotLabel} (18:30 / 19:30 window)`
                : `Snap save to nearest hour ${hourSlotLabel}`
            }
          >
            {isLandscape && <Save className="w-3.5 h-3.5 shrink-0" />}
            <span>
              {isSaving
                ? (saveLabel ? "Updating…" : "Saving…")
                : saveLabel
                  ? `${saveLabel}${hourSlotLabel ? ` · ${hourSlotLabel}` : ""}`
                  : `Save for ${hourSlotLabel || "—"}`}
              {!saveLabel && hourSlotSpecial ? " ★" : ""}
            </span>
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isSaving || !onClear}
            className={`${btnBase} ${lsResponsiveCls} whitespace-nowrap shrink-0 calc-reset-btn focus-visible:ring-rose-400`}
            style={btnStyle}
            title="Reset all bus voltages and feeder values"
          >
            {isLandscape && <RotateCcw className="w-3.5 h-3.5 shrink-0" />}
            <span>Reset</span>
          </button>
        </div>
      )}

      {!isAuthenticated && !isLS && (
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className={`${isLandscape ? "px-3 py-1 text-[11px] self-end" : "w-full"} text-center font-semibold text-orange-700 dark:text-amber-300 bg-orange-50 dark:bg-amber-950/40 rounded-lg border border-orange-200 dark:border-amber-500/30 hover:bg-orange-100 dark:hover:bg-amber-950/60 transition-colors cursor-pointer shadow-xs`}
          style={isLandscape ? undefined : { fontSize: "var(--calc-btn-text)", paddingTop: "0.35rem", paddingBottom: "0.35rem" }}
        >
          Login required to save history — tap to sign in
        </button>
      )}
      {isAuthenticated && isViewer && !isLS && (
        <p
          className={`${isLandscape ? "px-3 py-1 text-[11px] self-end" : "w-full"} text-center font-semibold text-secondary bg-surface-2 rounded-lg border border-app shadow-xs`}
          style={isLandscape ? undefined : { fontSize: "var(--calc-btn-text)", paddingTop: "0.35rem", paddingBottom: "0.35rem" }}
        >
          Viewer role — calculate only; saving is disabled
        </p>
      )}

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={login}
      />
    </section>
  );
}
