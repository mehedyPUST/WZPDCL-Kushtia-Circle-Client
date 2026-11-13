"use client";

import { Suspense } from "react";
import NightLogView from "@/components/NightLogView";
import { SkeletonLogsheet } from "@/components/SkeletonTable";

function NightLogInner() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="shrink-0 px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-1.5">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight font-display">
          Night Logs
        </h1>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          Fill end intervals · By Local or With AI · Modify · Save
        </p>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-none mx-auto px-2 sm:px-5 lg:px-6 pb-2 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          <NightLogView />
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
