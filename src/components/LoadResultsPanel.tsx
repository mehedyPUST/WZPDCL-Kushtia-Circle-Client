"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check } from "lucide-react";

const btnBase =
  "rounded-xl font-extrabold tracking-wide uppercase leading-tight shadow-md active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400";

export default function LoadResultsPanel({
  calculate,
  bottail11kV,
  totalMW,
  onCopy,
  layout = "portrait",
}: {
  calculate: boolean;
  bottail11kV: number;
  totalMW: number;
  onCopy?: (e?: any) => void;
  layout?: "portrait" | "landscape";
}) {
  const [copied, setCopied] = useState(false);
  const bottail = calculate ? (Math.round((bottail11kV + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0";
  const total = calculate ? (Math.round((totalMW + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0";
  const isLandscape = layout === "landscape";

  const handleCopyClick = (e) => {
    onCopy?.(e);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (isLandscape) {
    return (
      <section className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] text-app rounded-lg flex items-center justify-between gap-3 border border-emerald-200 dark:border-teal-500/25 px-3.5 sm:px-4 h-11 min-w-0 sm:min-w-[10.5rem] shadow-xs">
          <span className="text-[11px] font-bold tracking-wide uppercase text-emerald-700 dark:text-teal-300 whitespace-nowrap">
            H3+T3
          </span>
          <motion.span
            key={`bottail-${bottail}`}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="font-black font-mono tabular-nums tracking-tight text-accent text-base sm:text-lg whitespace-nowrap"
          >
            {bottail}{" "}
            <span className="text-xs font-bold opacity-80">MW</span>
          </motion.span>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900 text-white rounded-lg flex items-center justify-between gap-3 shadow-sm border border-emerald-500/40 dark:border-emerald-400/35 px-4 h-11 min-w-0 sm:min-w-[11.5rem]">
          <span className="text-[11px] font-bold tracking-wide uppercase text-white/90 whitespace-nowrap">
            Total
          </span>
          <motion.span
            key={`total-${total}`}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            className="font-black font-mono tabular-nums tracking-tight text-white text-lg sm:text-xl whitespace-nowrap"
          >
            {total}{" "}
            <span className="text-xs font-bold text-white/85">MW</span>
          </motion.span>
        </div>

        <button
          type="button"
          onClick={handleCopyClick}
          className={`${btnBase} calc-copy-btn ${ copied ? "calc-copy-btn--copied" : "" } col-span-2 sm:col-span-1 rounded-lg flex items-center justify-center gap-1.5 px-4 h-11 text-xs whitespace-nowrap shrink-0`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 shrink-0" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 shrink-0" />
              <span>Copy Total</span>
            </>
          )}
        </button>
      </section>
    );
  }

  return (
    <section
      className="grid grid-cols-3"
      style={{
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        paddingBottom: "var(--calc-gap)",
        gap: "var(--calc-gap)",
      }}
    >
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] text-app rounded-xl flex items-center justify-between shadow-xs border border-emerald-200 dark:border-teal-500/25 min-w-0"
        style={{ height: "var(--calc-badge-h)", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}
      >
        <span
          className="font-bold tracking-wide uppercase text-emerald-700 dark:text-teal-300 truncate"
          style={{ fontSize: "var(--calc-badge-label)" }}
        >
          H3+T3
        </span>
        <motion.span
          key={`bottail-${bottail}`}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="font-black font-mono tabular-nums tracking-tight text-accent shrink-0 ml-1"
          style={{ fontSize: "var(--calc-badge-text)" }}
        >
          {bottail}{" "}
          <span
            className="font-bold opacity-80"
            style={{ fontSize: "var(--calc-badge-label)" }}
          >
            MW
          </span>
        </motion.span>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900 text-white rounded-xl flex items-center justify-between shadow-md shadow-emerald-900/20 dark:shadow-black/50 border border-emerald-500/40 dark:border-emerald-400/35 min-w-0"
        style={{ height: "var(--calc-badge-h)", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}
      >
        <span
          className="font-bold tracking-wide uppercase text-white/90 truncate"
          style={{ fontSize: "var(--calc-badge-label)" }}
        >
          Total
        </span>
        <motion.span
          key={`total-${total}`}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="font-black font-mono tabular-nums tracking-tight text-white shrink-0 ml-1"
          style={{ fontSize: "var(--calc-badge-text)" }}
        >
          {total}{" "}
          <span
            className="font-bold text-white/80"
            style={{ fontSize: "var(--calc-badge-label)" }}
          >
            MW
          </span>
        </motion.span>
      </motion.div>

      <button
        type="button"
        onClick={handleCopyClick}
        className={`${btnBase} calc-copy-btn ${ copied ? "calc-copy-btn--copied" : "" } flex items-center justify-center gap-1.5 hover:-translate-y-0.5`}
        style={{
          height: "var(--calc-badge-h)",
          fontSize: "var(--calc-btn-text)",
          paddingLeft: "0.25rem",
          paddingRight: "0.25rem",
        }}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 shrink-0" />
            <span>Copy Total</span>
          </>
        )}
      </button>
    </section>
  );
}
