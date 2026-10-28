"use client";

import { motion } from "motion/react";

/**
 * Universal professional skeleton component with subtle shimmer animation
 */
export function SkeletonShimmer({ className = "" }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-800/60 rounded-md ${className}`}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          repeat: Infinity,
          duration: 1.6,
          ease: "linear",
        }}
      />
    </div>
  );
}

export function SkeletonLine({ className = "h-4 w-full", rounded = "rounded-md" }) {
  return <SkeletonShimmer className={`${className} ${rounded}`} />;
}

export function SkeletonStatCard({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="h-4 w-4 rounded-full" />
          </div>
          <SkeletonLine className="h-7 w-32" />
          <SkeletonLine className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLogsheet({ rows = 12 }) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-slate-900/60 rounded-2xl border border-app overflow-hidden shadow-xl shadow-black/40">
      {/* Skeleton Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-app">
        <div className="flex items-center gap-2">
          <SkeletonShimmer className="h-8 w-28 rounded-lg" />
          <SkeletonShimmer className="h-8 w-24 rounded-lg hidden sm:block" />
          <SkeletonShimmer className="h-8 w-32 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonShimmer className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Skeleton Sheet Grid */}
      <div className="flex-1 min-h-0 p-3 overflow-hidden">
        <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-surface">
          <div className="grid grid-cols-12 gap-1 px-3 py-2.5 bg-slate-950 border-b border-slate-800">
            <SkeletonShimmer className="h-4 w-12 rounded" />
            <SkeletonShimmer className="h-4 w-14 rounded" />
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonShimmer key={i} className="h-4 w-full rounded" />
            ))}
            <SkeletonShimmer className="h-4 w-12 rounded ml-auto" />
          </div>
          <div className="divide-y divide-slate-800/60">
            {Array.from({ length: rows }).map((_, r) => (
              <div
                key={r}
                className={`grid grid-cols-12 gap-2 px-3 py-2 items-center ${
                  r % 2 === 0 ? "bg-slate-900/20" : "bg-slate-900/40"
                }`}
              >
                <SkeletonShimmer className="h-3.5 w-10 rounded" />
                <SkeletonShimmer className="h-3.5 w-12 rounded bg-emerald-950/40" />
                {Array.from({ length: 9 }).map((_, c) => (
                  <SkeletonShimmer key={c} className="h-3.5 w-full rounded" />
                ))}
                <SkeletonShimmer className="h-6 w-14 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonAdmin() {
  return (
    <div className="w-full flex-1 flex flex-col min-h-0 space-y-4 p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-app">
        <div className="space-y-1.5">
          <SkeletonShimmer className="h-6 w-36 rounded-lg" />
          <SkeletonShimmer className="h-3.5 w-60 rounded-md" />
        </div>
        <SkeletonShimmer className="h-9 w-32 rounded-lg" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <SkeletonShimmer className="h-9 w-24 rounded-lg" />
        <SkeletonShimmer className="h-9 w-24 rounded-lg" />
      </div>

      {/* User list table skeleton */}
      <div className="rounded-xl border border-app bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonShimmer className="h-4 w-28 rounded" />
          <div className="flex gap-1">
            <SkeletonShimmer className="h-7 w-16 rounded-md" />
            <SkeletonShimmer className="h-7 w-16 rounded-md" />
            <SkeletonShimmer className="h-7 w-16 rounded-md" />
          </div>
        </div>
        <SkeletonTable rows={6} columns={5} dark showHeader />
      </div>
    </div>
  );
}

export default function SkeletonTable({
  rows = 9,
  columns = 5,
  dark = true,
  showHeader = true,
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-xl border ${
        dark
          ? "border-slate-800/80 bg-slate-900/40"
          : "border-slate-200 bg-white"
      } shadow-sm backdrop-blur-sm`}
    >
      <table className="w-full table-fixed border-collapse">
        {showHeader && (
          <thead
            className={
              dark
                ? "bg-slate-800/60 border-b border-slate-800 text-slate-400"
                : "bg-slate-100 border-b border-slate-200 text-slate-600"
            }
          >
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="py-2.5 px-3 text-center">
                  <SkeletonShimmer
                    className={`h-3.5 mx-auto rounded ${
                      i === 0 ? "w-8" : i === 1 ? "w-28" : "w-16"
                    } ${dark ? "bg-slate-700/60" : "bg-slate-300"}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className={dark ? "divide-y divide-slate-800/60" : "divide-y divide-slate-200"}>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className={
                dark
                  ? rowIndex % 2 === 0
                    ? "bg-slate-900/20"
                    : "bg-slate-900/50"
                  : rowIndex % 2 === 0
                  ? "bg-white"
                  : "bg-slate-50/70"
              }
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="py-2.5 px-3 text-center">
                  <SkeletonShimmer
                    className={`h-4 mx-auto rounded ${
                      colIndex === 0
                        ? "w-6"
                        : colIndex === 1
                        ? "w-24"
                        : colIndex === columns - 1
                        ? "w-20"
                        : "w-14"
                    } ${dark ? "bg-slate-800/70" : "bg-slate-200"}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}