"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AllOvertimePanel from "@/components/AllOvertimePanel";

export default function MonthlyOvertimePage() {
  const router = useRouter();
  const { isAuthenticated, loading, role, isAdmin } = useAuth();

  const normalizedRole = String(role || "").toLowerCase();
  const allowed =
    isAdmin ||
    normalizedRole === "duty" ||
    normalizedRole === "admin" ||
    normalizedRole === "duty-person" ||
    normalizedRole === "operator";

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, allowed, router]);

  if (loading || !isAuthenticated || !allowed) {
    return (
      <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
        <div className="h-28 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
      <AllOvertimePanel />
    </div>
  );
}
