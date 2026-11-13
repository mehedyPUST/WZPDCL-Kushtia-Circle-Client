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

  return (
    <section
      className={
        isLandscape
          ? "grid grid-cols-3 max-w-2xl mx-auto w-full px-3 pb-2 gap-2.5"
          : "grid grid-cols-3"
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
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-surface-2 dark:bg-gradient-to-br dark:from-surface-2 dark:to-surface text-app rounded-xl flex items-center justify-between shadow-xs border border-app min-w-0 px-2.5"
        style={{ height: isLandscape ? "2.5rem" : "var(--calc-badge-h)" }}
      >
        <span
          className="font-bold tracking-wide uppercase text-secondary truncate"
          style={{ fontSize: isLandscape ? "0.72rem" : "var(--calc-badge-label)" }}
        >
          H3+T3
        </span>
        <motion.span
          key={`bottail-${bottail}`}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="font-black font-mono tabular-nums tracking-tight text-accent shrink-0 ml-1"
          style={{ fontSize: isLandscape ? "1.05rem" : "var(--calc-badge-text)" }}
        >
          {bottail}{" "}
          <span
            className="font-bold opacity-80"
            style={{ fontSize: isLandscape ? "0.7rem" : "var(--calc-badge-label)" }}
          >
            MW
          </span>
        </motion.span>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900 text-white rounded-xl flex items-center justify-between shadow-md shadow-emerald-900/20 dark:shadow-black/50 border border-emerald-500/40 dark:border-emerald-400/35 min-w-0 px-2.5"
        style={{ height: isLandscape ? "2.5rem" : "var(--calc-badge-h)" }}
      >
        <span
          className="font-bold tracking-wide uppercase text-white/90 truncate"
          style={{ fontSize: isLandscape ? "0.72rem" : "var(--calc-badge-label)" }}
        >
          Total
        </span>
        <motion.span
          key={`total-${total}`}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="font-black font-mono tabular-nums tracking-tight text-white shrink-0 ml-1"
          style={{ fontSize: isLandscape ? "1.05rem" : "var(--calc-badge-text)" }}
        >
          {total}{" "}
          <span
            className="font-bold text-white/80"
            style={{ fontSize: isLandscape ? "0.7rem" : "var(--calc-badge-label)" }}
          >
            MW
          </span>
        </motion.span>
      </motion.div>

      <button
        type="button"
        onClick={handleCopyClick}
        className={`${btnBase} calc-copy-btn ${ copied ? "calc-copy-btn--copied" : "" } flex items-center justify-center gap-1.5 hover:-translate-y-0.5 px-2`}
        style={{
          height: isLandscape ? "2.5rem" : "var(--calc-badge-h)",
          fontSize: isLandscape ? "0.75rem" : "var(--calc-btn-text)",
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
