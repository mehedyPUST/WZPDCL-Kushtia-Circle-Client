"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_META } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import ThemeToggle from "./ThemeToggle";
import toast from "react-hot-toast";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/calculator", label: "Calculator" },
  { href: "/loadshed", label: "Load Shed" },
  { href: "/manual", label: "Manual Input", authOnly: true },
  { href: "/history", label: "History" },
  { href: "/max-load", label: "Max Load" },
  { href: "/statistics", label: "Statistics" },
];

import { LogOut, Menu, X } from "lucide-react";

export default function StationHeader({ tagline }) {
  const pathname = usePathname();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, login, logout, loading } = useAuth();
  const displayTagline = tagline ?? APP_META.tagline;

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Mark session so mobile Home no longer force-redirects to calculator
  useEffect(() => {
    try {
      sessionStorage.setItem("ss_calc_session", "1");
    } catch {
      /* ignore */
    }
  }, []);

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <>
      <div className="relative flex-shrink-0 z-30">
        <header
          className="bg-elevated text-app grid grid-cols-[auto_1fr_auto] items-center border-b border-app shadow-xs"
          style={{
            paddingLeft: "var(--calc-section-px, 0.75rem)",
            paddingRight: "var(--calc-section-px, 0.75rem)",
            paddingTop: "var(--calc-header-py, 0.5rem)",
            paddingBottom: "var(--calc-header-py, 0.5rem)",
            gap: "var(--calc-gap, 0.5rem)",
          }}
        >
          {/* Logo only on mobile — navbar already shows brand on large screens */}
          <div className="flex items-center justify-start self-center md:invisible md:pointer-events-none">
            <img
              src={APP_META.logoUrl}
              alt="WZPDCL Logo"
              referrerPolicy="no-referrer"
              className="object-contain bg-white rounded-full p-0.5 shadow-sm ring-1 ring-emerald-500/30 shrink-0"
              style={{
                width: "var(--calc-logo, 2.5rem)",
                height: "var(--calc-logo, 2.5rem)",
              }}
            />
          </div>

          <div className="flex flex-col items-center justify-center text-center min-w-0 overflow-hidden gap-0 self-center">
            <h1
              className="font-bold tracking-tight text-app leading-tight whitespace-nowrap"
              style={{ fontSize: "var(--calc-title, 0.8125rem)" }}
            >
              {APP_META.shortTitle}
            </h1>
            <p
              className="text-muted font-medium leading-tight whitespace-nowrap"
              style={{ fontSize: "var(--calc-sub, 0.6875rem)" }}
            >
              {APP_META.subtitle}
            </p>
            <p
              className="font-bold tracking-wide text-accent uppercase leading-tight whitespace-nowrap font-mono"
              style={{ fontSize: "var(--calc-tag, 0.5625rem)" }}
            >
              {displayTagline}
            </p>
          </div>

          {/* Theme toggle + Logout / Login + mobile hamburger */}
          <div className="flex items-center justify-end gap-1.5">
            <ThemeToggle compact />
            {loading ? (
              <span className="font-medium text-accent px-1" style={{ fontSize: "var(--calc-sub)" }}>
                …
              </span>
            ) : isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
                className="p-1.5 rounded-md bg-surface-2 hover:bg-surface-3 text-secondary hover:text-app transition-colors border border-app cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition-colors cursor-pointer shadow-xs"
                style={{ fontSize: "var(--calc-sub)" }}
              >
                Login
              </button>
            )}

            {/* Mobile nav hamburger — sits beside logout */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-secondary hover:text-app bg-surface-2 hover:bg-surface-3 border border-app transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile menu drawer — sits under station header */}
        {mobileOpen && (
          <div className="md:hidden absolute left-0 right-0 top-full z-40 border-b border-app bg-elevated shadow-lg">
            <nav className="px-3 py-2" aria-label="Mobile">
              <ul className="flex flex-col gap-0.5">
                {NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated).map((link) => {
                  const active = isActive(link.href);
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                          active
                            ? "bg-emerald-600 text-white font-semibold"
                            : "text-secondary hover:bg-surface-2 hover:text-app"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
                <li className="pt-2 mt-1 border-t border-app">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-secondary hover:bg-surface-2 hover:text-app"
                    >
                      Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        setShowLogin(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-md text-sm font-semibold text-accent hover:bg-surface-2"
                    >
                      Sign in
                    </button>
                  )}
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      <LoginModal
        open={showLogin}
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLogin={login}
      />
    </>
  );
}
