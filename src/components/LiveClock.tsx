"use client";

import { Clock } from "lucide-react";
import { useLiveClock, useLiveClockParts } from "@/hooks/useLiveClock";

export default function LiveClock({
  time,
  compact = false,
  variant,
}: {
  time?: string | null;
  compact?: boolean;
  variant?: "default" | "compact" | "landscape";
} = {}) {
  const liveTime = useLiveClock();
  const liveParts = useLiveClockParts();
  const displayTime = time !== undefined ? time : liveTime;
  const resolvedVariant = variant ?? (compact ? "compact" : "default");

  if (resolvedVariant === "landscape") {
    return (
      <div
        className="inline-flex items-center gap-2.5 sm:gap-3.5 bg-surface rounded-xl border border-app-strong shadow-inner px-3 sm:px-4 py-1.5 sm:py-2 shrink-0"
        title="Substation live operational clock"
        suppressHydrationWarning
      >
        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-accent shrink-0" />
        {time !== undefined ? (
          <span
            className="text-base sm:text-xl md:text-2xl font-extrabold tracking-wider font-mono tabular-nums text-accent leading-none"
            suppressHydrationWarning
          >
            {displayTime ?? "—"}
          </span>
        ) : (
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <span
              className="hidden sm:inline text-xs md:text-sm font-semibold text-secondary tracking-tight whitespace-nowrap"
              suppressHydrationWarning
            >
              {liveParts?.dateShort ?? "—"}
            </span>
            <span
              className="hidden sm:block h-5 w-px bg-[var(--app-border-strong)]"
              aria-hidden="true"
            />
            <span
              className="text-lg sm:text-xl md:text-2xl lg:text-[1.625rem] font-black tracking-[0.08em] font-mono tabular-nums text-accent leading-none whitespace-nowrap"
              suppressHydrationWarning
            >
              {liveParts?.time ?? "--:--:--"}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (resolvedVariant === "compact") {
    return (
      <span
        className="inline-flex items-center gap-1.5 bg-surface rounded-lg border border-accent/60 shadow-xs px-3 py-1 text-xs sm:text-sm font-extrabold tracking-wider font-mono tabular-nums text-accent uppercase shrink-0"
        suppressHydrationWarning
      >
        <Clock className="w-3.5 h-3.5 opacity-85 shrink-0" />
        <span suppressHydrationWarning>{displayTime ?? "—"}</span>
      </span>
    );
  }

  return (
    <div
      className="bg-app text-accent text-center font-extrabold tracking-widest font-mono border-b border-app uppercase"
      style={{
        paddingTop: "var(--calc-clock-py)",
        paddingBottom: "var(--calc-clock-py)",
        fontSize: "var(--calc-clock-size)",
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 bg-surface rounded-md border border-accent shadow-sm"
        style={{
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          paddingTop: "0.125rem",
          paddingBottom: "0.125rem",
        }}
        suppressHydrationWarning
      >
        <Clock className="w-3.5 h-3.5 opacity-80 shrink-0" />
        <span suppressHydrationWarning>{displayTime ?? "—"}</span>
      </span>
    </div>
  );
}
