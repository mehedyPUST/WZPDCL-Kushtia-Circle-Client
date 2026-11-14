"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HomePage from "@/components/HomePage";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Mobile + signed in: open Calculator first (duty workflow)
    const mobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches;
    if (mobile && isAuthenticated) {
      router.replace("/calculator");
      return;
    }
    setReady(true);
  }, [router, loading, isAuthenticated]);

  if (loading || !ready) {
    return (
      <div className="flex-1 flex flex-col w-full animate-in fade-in duration-150 bg-app">
        <div className="w-full h-[260px] sm:h-[320px] bg-surface-2 animate-pulse border-b border-app" />
        <div className="w-full max-w-none px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-surface border border-app animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <HomePage />
      <SiteFooter />
    </>
  );
}
