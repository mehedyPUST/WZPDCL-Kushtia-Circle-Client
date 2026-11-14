"use client";

import { Suspense, useState } from "react";
import LoadShedEntryView from "@/components/LoadShedEntryView";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "@/components/LoginModal";
import SkeletonTable from "@/components/SkeletonTable";

function LoadShedInner() {
  const { isAuthenticated, loading, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="page-frame">
        <SkeletonTable rows={8} columns={6} dark />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-h-0 max-w-lg mx-auto w-full px-4 py-16 text-center">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 p-8 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-3">
            Restricted
          </p>
          <h1 className="text-xl font-semibold text-app tracking-tight">
            Sign in required
          </h1>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Load-shed entry and allotment changes are only available to
            authenticated operators.
          </p>
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="btn-primary mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition-colors"
          >
            Sign in
          </button>
        </div>
        <LoginModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onLogin={async (username, password) => {
            await login(username, password);
            setShowLogin(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="shrink-0 px-3 sm:px-5 lg:px-6 pt-2 sm:pt-3 pb-1.5">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight">
          Load Shed Entry
        </h1>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          Enter grid allotment and LS MW per feeder for each time slot. Demand = Total + LS.
        </p>
      </div>
      <div className="flex-1 min-h-0 w-full max-w-none mx-auto px-2 sm:px-5 lg:px-6 pb-2 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          <LoadShedEntryView />
        </div>
      </div>
    </div>
  );
}

export default function LoadShedPage() {
  return (
    <Suspense
      fallback={
        <div className="page-frame">
          <SkeletonTable rows={8} columns={6} dark />
        </div>
      }
    >
      <LoadShedInner />
    </Suspense>
  );
}