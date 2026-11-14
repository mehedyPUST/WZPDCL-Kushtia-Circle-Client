"use client";

import { APP_META } from "@/lib/constants";

/** Compact footer used by AppShell on all non-calculator pages */
export default function AppNarrowFooter() {
  return (
    <footer className="shrink-0 border-t border-app bg-surface">
      <div className="w-full max-w-none mx-auto px-3 sm:px-5 lg:px-6 py-2 flex items-center justify-between gap-3 min-h-[2rem]">
        <p className="text-[11px] sm:text-[12px] text-muted truncate">
          {APP_META.footer}
        </p>
        <p className="text-[11px] text-faint whitespace-nowrap shrink-0">
          Bottail–Kushtia · Internal
        </p>
      </div>
    </footer>
  );
}
