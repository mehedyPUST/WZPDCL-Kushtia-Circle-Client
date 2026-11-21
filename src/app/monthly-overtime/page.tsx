"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AllOvertimePanel from "@/components/AllOvertimePanel";

export default function MonthlyOvertimePage() {
  const router = useRouter();
  const { isAuthenticated, loading, role, isAdmin } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    // Allow duty + admin (and legacy duty-person / operator via normalized role)
    const r = String(role || "").toLowerCase();
    const allowed =
      isAdmin || r === "duty" || r === "admin" || r === "duty-person" || r === "operator";
    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, role, isAdmin, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6">
      <AllOvertimePanel />
    </div>
  );
}
