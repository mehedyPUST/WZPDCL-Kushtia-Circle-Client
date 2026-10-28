"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_META } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import toast from "react-hot-toast";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/calculator", label: "Calculator", icon: "calc" },
  { href: "/loadshed", label: "Load Shed", icon: "shed" },
  { href: "/manual", label: "Manual", icon: "manual" },
  { href: "/history", label: "History", icon: "hist" },
  { href: "/max-load", label: "Max Load", icon: "max" },
  { href: "/statistics", label: "Statistics", icon: "stats" },
];

function NavIcon({ name, className = "w-4 h-4" }) {
  const c = className;
  switch (name) {
    case "home":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
        </svg>
      );
    case "calc":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path strokeLinecap="round" d="M8 7h8M8 11h2m2 0h2m2 0h2M8 15h2m2 0h2m2 0h2" />
        </svg>
      );
    case "shed":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "manual":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    case "hist":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "max":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M13 7h8v8" />
        </svg>
      );
    case "stats":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    default:
      return null;
  }
}

function MenuIcon({ open }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function SiteNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated, login, logout, loading } = useAuth();

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Prevent body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const visibleLinks = NAV_LINKS.filter(
    (link) => link.href !== "/manual" || isAuthenticated
  );

  const renderSidebarNav = (onNavigate) => (
    <div className="flex flex-col h-full min-h-0">
      {/* App identity — top of sidebar */}
      <div className="px-4 pt-4 pb-3 border-b border-app shrink-0">
        <div className="text-[13px] font-bold text-app tracking-tight leading-snug">
          WZPDCL · Bottail
        </div>
        <div className="text-[10px] text-accent font-semibold mt-0.5 uppercase tracking-[0.14em] font-mono">
          Load Management
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Primary">
        {visibleLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-emerald-600 text-white shadow-md font-semibold"
                  : "text-muted hover:text-app hover:bg-surface-3"
              }`}
            >
              <NavIcon name={link.icon} className="w-4 h-4 shrink-0 opacity-90" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-app shrink-0">
        {loading ? (
          <span className="text-xs text-muted px-2">…</span>
        ) : isAuthenticated ? (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-secondary hover:text-app bg-surface-2 hover:bg-surface-3 border border-app transition-colors shadow-xs"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Top company bar ── */}
      <header className="sticky top-0 z-50 w-full bg-surface/95 backdrop-blur-xl border-b border-app shadow-xs">
        <div
          className="h-full w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6 flex items-center gap-3"
          style={{ height: "var(--site-nav-h)", minHeight: "var(--site-nav-h)" }}
        >
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-secondary hover:text-app hover:bg-surface-3 border border-app shrink-0 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <MenuIcon open={mobileOpen} />
          </button>

          {/* Company brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1"
            onClick={() => setMobileOpen(false)}
          >
            <img
              src={APP_META.logoUrl}
              alt="WZPDCL"
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain bg-white rounded-full p-[3px] shadow-sm ring-1 ring-emerald-500/25 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[12px] sm:text-[13px] md:text-[14px] font-bold text-app tracking-tight leading-tight truncate">
                West Zone Power Distribution Company Limited
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted font-medium mt-0.5 leading-tight truncate">
                Sales &amp; Distribution Division-1, Kushtia
              </div>
            </div>
          </Link>

          {/* Desktop auth shortcut in top bar (sidebar also has it) */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {loading ? null : isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-secondary hover:text-app hover:bg-surface-3 border border-app transition-colors shadow-xs"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 z-40 bg-surface border-r border-app"
        style={{
          top: "var(--site-nav-h)",
          width: "var(--app-sidebar-w)",
          height: "calc(100dvh - var(--site-nav-h))",
        }}
        aria-label="Sidebar"
      >
        {renderSidebarNav()}
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-surface border-r border-app shadow-2xl flex flex-col"
            style={{ paddingTop: "var(--site-nav-h)" }}
          >
            {renderSidebarNav(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={async (username, password) => {
          await login(username, password);
          setShowLogin(false);
        }}
      />
    </>
  );
}
