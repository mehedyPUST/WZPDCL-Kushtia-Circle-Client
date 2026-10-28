"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check } from "lucide-react";

const btnBase =
  "rounded-xl font-extrabold tracking-wide uppercase leading-tight shadow-md active:scale-[0.97] transition-all duration-200 ease-out cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400";

export default function ResultsPanel({ calculate, bottail11kV, totalMW, onCopy }) {
  const [copied, setCopied] = useState(false);
  const bottail = calculate ? (Math.round((bottail11kV + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0";
  const total = calculate ? (Math.round((totalMW + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0";

  const handleCopyClick = (e) => {
    onCopy?.(e);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

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
        className="bg-surface-2 dark:bg-gradient-to-br dark:from-slate-800/95 dark:via-slate-900 dark:to-slate-950 text-app dark:text-white rounded-xl flex items-center justify-between shadow-xs dark:shadow-lg dark:shadow-slate-950/40 border border-app min-w-0"
        style={{ height: "var(--calc-badge-h)", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}
      >
        <span
          className="font-bold tracking-wide uppercase text-muted dark:text-slate-300 truncate"
          style={{ fontSize: "var(--calc-badge-label)" }}
        >
          H3+T3
        </span>
        <motion.span
          key={`bottail-${bottail}`}
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="font-black font-mono tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400 shrink-0 ml-1"
          style={{ fontSize: "var(--calc-badge-text)" }}
        >
          {bottail}{" "}
          <span className="font-bold opacity-80" style={{ fontSize: "var(--calc-badge-label)" }}>
            MW
          </span>
        </motion.span>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.01 }}
        className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-xl flex items-center justify-between shadow-md shadow-emerald-950/20 border border-emerald-500/40 min-w-0"
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
          <span className="font-bold text-white/80" style={{ fontSize: "var(--calc-badge-label)" }}>
            MW
          </span>
        </motion.span>
      </motion.div>

      <button
        type="button"
        onClick={handleCopyClick}
        className={`${btnBase} calc-copy-btn ${
          copied ? "calc-copy-btn--copied" : ""
        } flex items-center justify-center gap-1.5 hover:-translate-y-0.5`}
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
