"use client";

import { Suspense } from "react";
import RestTimeDataView from "@/components/RestTimeDataView";
import { SkeletonLogsheet } from "@/components/SkeletonTable";

function NightLogInner() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="shrink-0 px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-1.5">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight font-display">
          Generate Night Logs
        </h1>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          Enter 00:00 &amp; 08:00 · generate 01:00–07:00 · edit if needed · save
        </p>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-none mx-auto px-2 sm:px-5 lg:px-6 pb-2">
        <div className="h-[calc(100dvh-var(--shell-chrome-h,0px)-5.5rem)] sm:h-[calc(100dvh-var(--shell-chrome-h,0px)-6.25rem)] md:h-[calc(100dvh-var(--shell-chrome-h,0px)-6.75rem)]">
          <RestTimeDataView />
        </div>
      </div>
    </div>
  );
}

function NightLogFallback() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full px-2 sm:px-5 lg:px-6 pt-3 pb-2">
      <SkeletonLogsheet rows={10} />
    </div>
  );
}

export default function GenerateNightLogPage() {
  return (
    <Suspense fallback={<NightLogFallback />}>
      <NightLogInner />
    </Suspense>
  );
}