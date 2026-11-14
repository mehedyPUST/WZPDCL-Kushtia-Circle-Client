"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isCalculator =
    pathname === "/calculator" || pathname.startsWith("/calculator/");

  // Calculator displays its own inline OfflineBadge with pending sync status
  if (!mounted || online || isCalculator) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 px-3 sm:px-5 py-1.5 bg-amber-500/15 border-b border-amber-500/35 flex items-center justify-between gap-2 text-xs"
    >
      <div className="flex items-center gap-2 min-w-0 text-amber-900 dark:text-amber-100 font-medium">
        <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate">
          Offline mode active — basic load calculations are available locally.
        </span>
      </div>
      <Link
        href="/calculator"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 border border-amber-500/40 transition-colors whitespace-nowrap"
      >
        <Calculator className="w-3 h-3 shrink-0" />
        Open Calculator
      </Link>
    </div>
  );
}
