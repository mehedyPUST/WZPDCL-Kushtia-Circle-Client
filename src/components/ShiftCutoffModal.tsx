"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, Clock3, LogIn, ShieldCheck, X } from "lucide-react";
import { formatDhakaCutoffHM } from "@/lib/shiftSession";
import { dhakaNowParts, SHIFT_META, shiftFromHour } from "@/lib/dutyShifts";

interface ShiftCutoffModalProps {
  open: boolean;
  cutoffAt?: number | null;
  onClose: () => void;
  onLoginClick: () => void;
}

export default function ShiftCutoffModal({
  open,
  cutoffAt,
  onClose,
  onLoginClick,
}: ShiftCutoffModalProps) {
  const loginBtnRef = useRef<HTMLButtonElement | null>(null);

  const cutoffHm = useMemo(() => formatDhakaCutoffHM(cutoffAt), [cutoffAt]);

  const activeShiftInfo = (() => {
    const nowParts = dhakaNowParts();
    const shiftId = shiftFromHour(nowParts.hour);
    return SHIFT_META[shiftId];
  })();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      loginBtnRef.current?.focus();
    }, 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/65 dark:bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-cutoff-modal-title"
          aria-describedby="shift-cutoff-modal-message"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md rounded-2xl border bg-gradient-to-br from-orange-50/90 via-white to-amber-50/40 border-orange-200 dark:from-amber-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/30 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-orange-200/80 dark:border-amber-500/20 bg-orange-50/75 dark:bg-amber-950/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-100/90 dark:bg-amber-500/20 border border-orange-200 dark:border-amber-400/35 flex items-center justify-center shrink-0 text-orange-700 dark:text-amber-300">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-orange-700 dark:text-amber-300">
                    <span>Shift Change Cutoff</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {cutoffHm ? `${cutoffHm} BST` : "08:30 / 14:30 / 20:30 BST"}
                    </span>
                  </div>
                  <h2
                    id="shift-cutoff-modal-title"
                    className="text-base sm:text-lg font-bold text-app tracking-tight mt-0.5"
                  >
                    Shift Handover Sign-Out
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-white/75 dark:hover:bg-surface-3 transition-colors shrink-0"
                aria-label="Dismiss shift cutoff modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Structured Body */}
            <div className="p-5 space-y-4">
              {/* Primary Required Message */}
              <div className="rounded-xl border border-orange-200/90 dark:border-amber-500/30 bg-white/85 dark:bg-[#0b1322]/85 px-4 py-3.5 shadow-xs">
                <p
                  id="shift-cutoff-modal-message"
                  className="text-sm sm:text-[15px] font-bold text-app leading-snug"
                >
                  New Shift Started . Please Login with Your Own User ID &amp; Password
                </p>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  The previous shift operator session was closed automatically at the scheduled substation handover boundary to keep calculation logs and station notes attributed to the active officer.
                </p>
              </div>

              {/* Structured Shift Context Table */}
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-emerald-200/80 dark:border-teal-500/25 bg-gradient-to-br from-emerald-50/75 via-white to-blue-50/30 dark:from-teal-950/40 dark:via-[#0f1726] dark:to-[#0f1726] px-3.5 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-teal-300">
                    <Clock3 className="w-3.5 h-3.5 shrink-0" />
                    Current Active Shift
                  </dt>
                  <dd className="mt-1 font-bold text-app text-sm">
                    {activeShiftInfo.label}
                  </dd>
                  <dd className="text-[11px] font-mono tabular-nums text-muted mt-0.5">
                    {activeShiftInfo.window} BST
                  </dd>
                </div>

                <div className="rounded-xl border border-blue-200/80 dark:border-sky-500/25 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/35 dark:from-sky-950/40 dark:via-[#0f1726] dark:to-[#0f1726] px-3.5 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-sky-300">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    Cutoff Boundary
                  </dt>
                  <dd className="mt-1 font-bold text-app text-sm font-mono tabular-nums">
                    {cutoffHm ? `${cutoffHm} BST` : "Scheduled"}
                  </dd>
                  <dd className="text-[11px] text-muted mt-0.5">
                    08:30 · 14:30 · 20:30
                  </dd>
                </div>
              </dl>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-orange-200/80 dark:border-amber-500/20 bg-orange-50/60 dark:bg-amber-950/35 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-app bg-white/80 dark:bg-surface-2 border border-orange-200/80 dark:border-amber-500/25 hover:bg-orange-50 dark:hover:bg-amber-950/40 transition-colors whitespace-nowrap"
              >
                Dismiss
              </button>
              <button
                ref={loginBtnRef}
                type="button"
                onClick={onLoginClick}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                Login Now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
