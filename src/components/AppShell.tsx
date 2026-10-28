"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Calculator,
  Zap,
  ClipboardEdit,
  Moon,
  History,
  CircleDot,
  MapPin,
  TrendingUp,
  BarChart3,
  Shield,
  Clock,
  LogOut,
  LogIn,
  Menu,
  X,
  Radio,
} from "lucide-react";
import { APP_META } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import AppNarrowFooter from "./AppNarrowFooter";
import ThemeToggle from "./ThemeToggle";
import toast from "react-hot-toast";
import { useLiveClock } from "@/hooks/useLiveClock";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/loadshed", label: "Loadshed", icon: Zap },
  { href: "/manual", label: "Manual Input", icon: ClipboardEdit },
  { href: "/generate-night-log", label: "Generate Night Logs", icon: Moon },
  { href: "/history", label: "History", icon: History },
  { href: "/circle-load", label: "Circle Load", icon: CircleDot },
  { href: "/kushtia-district-load", label: "Kushtia District Load", icon: MapPin },
  { href: "/max-load", label: "MAX Load", icon: TrendingUp },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Shield },
];

function TopbarLiveClock() {
  const currentTime = useLiveClock();
  return (
    <div
      className="hidden md:flex items-center shrink-0 ml-auto mr-3"
      title="Substation operational time"
    >
      <div className="inline-flex items-center gap-2 rounded-lg border border-accent bg-elevated/80 px-3 py-1.5 font-mono text-xs sm:text-sm font-bold tracking-wider text-accent tabular-nums shadow-inner">
        <Radio className="w-3.5 h-3.5 text-accent animate-pulse" />
        <span suppressHydrationWarning>{currentTime ?? "—"}</span>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, login, logout, loading, canWrite, isAdmin } = useAuth();
  const isCalculator =
    pathname === "/calculator" || pathname.startsWith("/calculator/");
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");

  // Guests: home + calculator + login only; other routes need sign-in
  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;
    if (isLoginPage) return;
    if (pathname === "/" || pathname === "") return;
    if (pathname === "/calculator" || pathname.startsWith("/calculator/")) return;
    router.replace("/login");
  }, [loading, isAuthenticated, isLoginPage, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
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
      router.replace("/login");
    } catch {
      toast.error("Sign out failed");
      router.replace("/login");
    }
  };

  const visibleLinks = NAV_LINKS.filter((link) => {
    const href = link.href;
    if (!isAuthenticated) {
      return href === "/" || href === "/calculator";
    }
    if (href === "/admin") return isAdmin;
    if (
      href === "/manual" ||
      href === "/loadshed" ||
      href === "/generate-night-log"
    ) {
      return canWrite;
    }
    return true;
  });

  return (
    <div className="app-grid-shell">
      {/* ── Grid 1: App identity ── */}
      <div className="app-grid-1">
        <div className="flex items-center gap-2.5 min-w-0 h-full px-4">
          <Link href="/" className="min-w-0 flex-1 group">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse" />
              <div className="text-[13px] sm:text-[14px] font-bold text-app tracking-tight leading-tight group-hover:text-accent transition-colors">
                WZPDCL · Bottail SS
              </div>
            </div>
            <div className="text-[11px] sm:text-[12px] text-accent font-semibold mt-0.5 uppercase tracking-[0.12em] font-mono">
              Load Management
            </div>
          </Link>
        </div>
      </div>

      {/* ── Grid 2: Company Top Bar ── */}
      <div className="app-grid-2 px-3 sm:px-5">
        <Link
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 h-full group"
        >
          <img
            src={APP_META.logoUrl}
            alt="WZPDCL"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain bg-white rounded-full p-[3px] shadow-md shadow-black/40 ring-1 ring-emerald-500/30 shrink-0 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] sm:text-[13px] md:text-[14px] font-semibold text-app tracking-tight leading-tight truncate group-hover:text-accent transition-colors">
              West Zone Power Distribution Company Limited
            </div>
            <div className="text-[11px] sm:text-[12px] text-muted font-medium mt-0.5 leading-tight truncate">
              Sales &amp; Distribution Division-1, Kushtia · 33/11 kV Substation
            </div>
          </div>
        </Link>

        {/* Station Live Clock */}
        <TopbarLiveClock />

        {/* Theme Toggle + Auth Button */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <ThemeToggle />
          {loading ? (
            <div className="h-8 w-24 rounded-lg bg-surface-3 animate-pulse" />
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-secondary hover:text-app hover:bg-surface-3/80 border border-app transition-all hover:border-app-strong shadow-sm whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* ── Grid 3: Nav links (Desktop Sidebar) ── */}
      <aside
        className="app-grid-3 flex flex-col justify-between"
        aria-label="Sidebar"
      >
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleLinks.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${active
                    ? "font-semibold"
                    : "text-muted hover:text-app hover:bg-surface-3/50"
                  }`}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-tab"
                    className="absolute inset-0 rounded-xl shadow-md border border-accent"
                    style={{ background: "var(--app-accent)", color: "var(--app-accent-ink)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span
                  className="relative z-10 flex items-center gap-3 min-w-0 flex-1"
                  style={active ? { color: "var(--app-accent-ink)" } : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${active
                        ? ""
                        : "text-muted group-hover:text-accent"
                      }`}
                  />
                  <span className="truncate">{link.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="px-3 py-3 border-t border-app bg-elevated/40 shrink-0">
          {loading ? (
            <div className="h-9 rounded-lg bg-surface-3 animate-pulse" />
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-secondary bg-surface-3/40 hover:bg-rose-500/10 hover:text-rose-400 border border-app transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="btn-primary w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* ── Grid 4: Page Content + Mobile Drawer ── */}
      <main className="app-grid-4 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Topbar */}
        {!isCalculator && (
          <header className="lg:hidden sticky top-0 z-40 flex items-center gap-2.5 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 bg-surface/95 backdrop-blur-md border-b border-app shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-app bg-surface-3/60 active:bg-surface-3 border border-app shadow-sm transition-transform active:scale-95"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-emerald-400" />
            </button>
            <Link href="/" className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-app tracking-tight leading-tight truncate">
                WZPDCL · Bottail SS
              </div>
              <div className="text-[11px] text-accent font-semibold uppercase tracking-[0.12em] font-mono">
                Load Management
              </div>
            </Link>
            <ThemeToggle compact />
            {isAuthenticated ? (
              <Link
                href="/"
                className="shrink-0 min-h-[34px] inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/35 hover:bg-emerald-900/50"
              >
                Home
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn-primary shrink-0 min-h-[34px] inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm"
              >
                Sign in
              </Link>
            )}
          </header>
        )}

        {/* Mobile Slide-Over Drawer */}
        <AnimatePresence>
          {mobileOpen && !isCalculator && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
                aria-hidden
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="relative z-10 w-[min(19rem,88vw)] h-full max-h-[100dvh] bg-surface border-r border-app flex flex-col shadow-2xl safe-pb"
              >
                <div className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-app">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-app tracking-tight">
                      Bottail Substation
                    </div>
                    <div className="text-[10px] text-accent uppercase tracking-[0.14em] font-semibold font-mono">
                      Navigation Menu
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ThemeToggle compact />
                    <button
                      type="button"
                      onClick={() => setMobileOpen(false)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-app hover:bg-surface-3 border border-app transition-colors"
                      aria-label="Close menu"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <nav className="flex-1 overflow-y-auto overscroll-contain py-3 px-2.5 space-y-1">
                  {visibleLinks.map((link) => {
                    const active = isActive(link.href);
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active
                            ? "btn-primary font-semibold shadow-md"
                            : "text-muted hover:text-app hover:bg-surface-3"
                          }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-app bg-elevated/40">
                  {loading ? null : isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-[13px] font-semibold text-secondary bg-surface-3/40 border border-app hover:bg-surface-3"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        setShowLogin(true);
                      }}
                      className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl text-[13px] font-semibold shadow-lg"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign in
                    </button>
                  )}
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="flex-1 min-h-0 overflow-auto flex flex-col"
        >
          {children}
        </motion.div>

        {!isCalculator && <AppNarrowFooter />}
      </main>

      {/* Global Login Modal */}
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