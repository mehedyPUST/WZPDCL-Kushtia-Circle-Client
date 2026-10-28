"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ManualEntryView from "@/components/ManualEntryView";
import LoginModal from "@/components/LoginModal";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonLogsheet } from "@/components/SkeletonTable";

function ManualInner() {
  const searchParams = useSearchParams();
  const initialDay = searchParams.get("day") || undefined;
  const editId = searchParams.get("edit") || undefined;
  const { login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="shrink-0 px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-1.5">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight">
          Manual Input
        </h1>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          Hourly slots · BUS voltages · Amps / MW · ring flags
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-none mx-auto px-2 sm:px-5 lg:px-6 pb-2">
        <div className="h-[calc(100dvh-var(--shell-chrome-h,0px)-5.5rem)] sm:h-[calc(100dvh-var(--shell-chrome-h,0px)-6.25rem)] md:h-[calc(100dvh-var(--shell-chrome-h,0px)-6.75rem)]">
          <ManualEntryView initialDay={initialDay} editRecordId={editId} />
        </div>
      </div>
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={async (u, p) => {
          await login(u, p);
          setShowLogin(false);
        }}
      />
    </div>
  );
}

function ManualFallback() {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full px-2 sm:px-5 lg:px-6 pt-3 pb-2">
      <SkeletonLogsheet rows={12} />
    </div>
  );
}

export default function ManualPage() {
  return (
    <Suspense fallback={<ManualFallback />}>
      <ManualInner />
    </Suspense>
  );
}