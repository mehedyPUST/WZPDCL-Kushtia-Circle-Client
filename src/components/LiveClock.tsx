"use client";

import { useLiveClock } from "@/hooks/useLiveClock";

export default function LiveClock({ time }) {
  const liveTime = useLiveClock();
  const displayTime = time !== undefined ? time : liveTime;

  return (
    <div
      className="bg-app text-accent text-center font-extrabold tracking-widest font-mono border-b border-app uppercase"
      style={{ paddingTop: "var(--calc-clock-py)", paddingBottom: "var(--calc-clock-py)", fontSize: "var(--calc-clock-size)" }}
    >
      <span
        className="inline-block bg-surface rounded-md border border-accent shadow-sm"
        style={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.125rem", paddingBottom: "0.125rem" }}
        suppressHydrationWarning
      >
        <span className="opacity-70 mr-1" aria-hidden>
          ⏱
        </span>
        <span suppressHydrationWarning>{displayTime ?? "—"}</span>
      </span>
    </div>
  );
}
