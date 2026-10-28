"use client";

import KushtiaDistrictLoadView from "@/components/KushtiaDistrictLoadView";

export default function KushtiaDistrictLoadPage() {
  return (
    <div className="page-frame">
      <div className="mb-2 shrink-0">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight">
          Kushtia District Load
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Operational day · Bottail + Bheramara · Circle Load rules
        </p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <KushtiaDistrictLoadView />
      </div>
    </div>
  );
}
