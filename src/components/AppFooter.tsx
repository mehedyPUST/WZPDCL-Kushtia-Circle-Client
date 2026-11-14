"use client";

import { APP_META } from "@/lib/constants";

/** Compact footer inside Calculator shell */
export default function AppFooter() {
  return (
    <footer
      className="bg-elevated/90 text-muted text-center font-medium tracking-wide border-t border-app mt-auto"
      style={{
        paddingTop: "var(--calc-footer-py)",
        paddingBottom: "var(--calc-footer-py)",
        fontSize: "var(--calc-footer-size)",
      }}
    >
      {APP_META.footer}
    </footer>
  );
}
