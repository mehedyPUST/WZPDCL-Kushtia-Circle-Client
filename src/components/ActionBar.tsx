"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";

const btnBase =
  "rounded-xl font-bold tracking-wide uppercase leading-tight shadow-md active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 focus-visible:ring-2 focus-visible:ring-offset-1";

export default function ActionBar({
  mode = "normal",
  onCalculateOnly,
  onCalculateAndSaveHour,
  hourSlotLabel,
  hourSlotSpecial,
  onHistory,
  historyLabel,
  onCalculateLoadShed,
  onCopyLoadShed,
  isSaving,
  saveLabel,
}) {
  const { isAuthenticated, login, canWrite, isViewer } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const isLS = mode === "loadShed";

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

  const btnStyle = {
    height: "var(--calc-btn-h)",
    fontSize: "var(--calc-btn-text)",
    paddingLeft: "0.25rem",
    paddingRight: "0.25rem",
  };

  return (
    <section
      className="flex flex-col"
      style={{
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        paddingBottom: "var(--calc-gap)",
        gap: "var(--calc-gap)",
      }}
    >
      {isLS ? (
        <div className="grid grid-cols-2" style={{ gap: "var(--calc-gap)" }}>
          <button
            type="button"
            onClick={onCalculateLoadShed}
            className={`${btnBase} bg-amber-600 text-white border border-amber-500/80 hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-600/30 hover:-translate-y-0.5 focus-visible:ring-amber-400`}
            style={btnStyle}
          >
            Calculate LS
          </button>
          <button
            type="button"
            onClick={onCopyLoadShed}
            className={`${btnBase} calc-copy-btn hover:-translate-y-0.5 focus-visible:ring-indigo-400`}
            style={btnStyle}
          >
            Copy LS Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2" style={{ gap: "var(--calc-gap)" }}>
          <button
            type="button"
            onClick={onCalculateOnly}
            disabled={isSaving}
            className={`${btnBase} bg-emerald-600 text-white border border-emerald-500/80 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-600/30 hover:-translate-y-0.5 focus-visible:ring-emerald-400`}
            style={btnStyle}
          >
            Calculate Only
          </button>
          <button
            type="button"
            onClick={handleHourSaveClick}
            disabled={isSaving || (isAuthenticated && !canWrite)}
            className={`${btnBase} bg-sky-600 text-white border border-sky-500/80 hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-600/30 hover:-translate-y-0.5 focus-visible:ring-sky-400`}
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
            {isSaving
              ? (saveLabel ? "Updating…" : "Saving…")
              : saveLabel
                ? `${saveLabel}${hourSlotLabel ? ` · ${hourSlotLabel}` : ""}`
                : `Save for ${hourSlotLabel || "—"}`}
            {!saveLabel && hourSlotSpecial ? " ★" : ""}
          </button>
        </div>
      )}

      {!isAuthenticated && !isLS && (
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="w-full text-center font-medium text-amber-300 bg-amber-950/40 rounded-md border border-amber-500/30 hover:bg-amber-950/60 transition-colors cursor-pointer"
          style={{ fontSize: "var(--calc-btn-text)", paddingTop: "0.25rem", paddingBottom: "0.25rem" }}
        >
          Login required to save history — tap to sign in
        </button>
      )}
      {isAuthenticated && isViewer && !isLS && (
        <p
          className="w-full text-center font-medium text-slate-300 bg-slate-800/70 rounded-md border border-app"
          style={{ fontSize: "var(--calc-btn-text)", paddingTop: "0.25rem", paddingBottom: "0.25rem" }}
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
