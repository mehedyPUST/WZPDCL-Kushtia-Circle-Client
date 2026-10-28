"use client";

import CircleLoadView from "@/components/CircleLoadView";

export default function CircleLoadPage() {
  return (
    <div className="page-frame">
      <div className="mb-2 shrink-0">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight">
          Circle Load
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Kushtia circle · Bottail from Calculator · other SS manual by assigned
          operators
        </p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <CircleLoadView />
      </div>
    </div>
  );
}
