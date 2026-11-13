"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Home,
  AlertCircle,
  Zap,
  Activity,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonShimmer } from "@/components/SkeletonTable";
import { APP_META } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, loading, role } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/");
    }
  }, [loading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const data = await login(username.trim(), password);
      const r = data?.data?.role || role;
      toast.success(
        r
          ? `Signed in as ${String(r).replace("-", " ")}`
          : "Signed in successfully"
      );
      router.replace("/");
    } catch (err: any) {
      const msg = err?.message || "Sign in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-[calc(100dvh-var(--site-nav-h,3.5rem))] flex items-center justify-center bg-slate-50 dark:bg-[#001E2B] p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white dark:bg-[#092532] border border-slate-200 dark:border-[rgba(0,237,100,0.18)] space-y-4 shadow-xl">
          <SkeletonShimmer className="h-10 w-10 mx-auto rounded-full" />
          <SkeletonShimmer className="h-6 w-36 mx-auto rounded-lg" />
          <SkeletonShimmer className="h-4 w-48 mx-auto rounded-md" />
          <div className="space-y-3 pt-4">
            <SkeletonShimmer className="h-11 w-full rounded-xl" />
            <SkeletonShimmer className="h-11 w-full rounded-xl" />
            <SkeletonShimmer className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-[calc(100dvh-var(--site-nav-h,3.5rem))] bg-zinc-50 dark:bg-[#001E2B] flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <div className="w-full max-w-[56rem] bg-white dark:bg-[#092532] rounded-3xl shadow-xl border border-zinc-200 dark:border-[rgba(0,237,100,0.2)] overflow-hidden flex flex-col md:flex-row transition-all">
        {/* Left Presentation Panel — Clean White/Zinc Base in Light Mode / MongoDB Forest Slate in Dark Mode */}
        <aside className="relative md:w-[44%] shrink-0 bg-zinc-50 dark:bg-gradient-to-br dark:from-[#001E2B] dark:via-[#092532] dark:to-[#00684A] border-b md:border-b-0 md:border-r border-zinc-200 dark:border-white/10 p-6 sm:p-8 md:p-9 flex flex-col justify-between overflow-hidden">
          {/* Subtle Ambient Lighting */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-emerald-100/70 dark:bg-[#00ED64]/15 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-52 h-52 rounded-full bg-blue-100/60 dark:bg-[#0496FF]/15 blur-3xl" />
          </div>

          {/* Substation Logo & Title */}
          <div className="relative">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md border border-zinc-200 dark:border-white/20 shrink-0 flex items-center justify-center">
                <img
                  src={APP_META.logoUrl}
                  alt="WZPDCL Logo"
                  onError={(e) => {
                    if (
                      APP_META.logoFallbackUrl &&
                      e.currentTarget.src !== APP_META.logoFallbackUrl
                    ) {
                      e.currentTarget.src = APP_META.logoFallbackUrl;
                    }
                  }}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-[#00ED64] font-mono leading-tight">
                  WZPDCL · Kushtia
                </span>
                <span className="block text-xs text-zinc-600 dark:text-white/80 font-semibold leading-tight mt-0.5">
                  S&amp;D Division-1
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight leading-tight text-zinc-800 dark:text-white font-display">
              Bottail Substation
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-200">
              33/11 kV Power Transmission &amp; Control
            </p>
            <p className="mt-2.5 text-xs text-zinc-600 dark:text-white/75 leading-relaxed max-w-[19rem]">
              Authorized operations portal for control-room duty officers,
              hourly power calculations, and circle load coordination.
            </p>
          </div>

          {/* Operational Feature Badges */}
          <div className="relative my-6 md:my-0 space-y-2.5">
            {[
              {
                icon: Zap,
                text: "Real-time MW calculation & power telemetry",
                tone: "emerald",
              },
              {
                icon: Activity,
                text: "Loadshed planner with proportional allotment",
                tone: "orange",
              },
              {
                icon: FileSpreadsheet,
                text: "Operational day sheets & night-log generation",
                tone: "blue",
              },
              {
                icon: ShieldCheck,
                text: "Role-based access: Viewer · Duty Officer · Admin",
                tone: "emerald",
              },
            ].map(({ icon: Icon, text, tone }, i) => {
              const iconBox =
                tone === "orange"
                  ? "bg-orange-50 border-orange-200 text-orange-500 dark:bg-[#00ED64]/20 dark:border-[#00ED64]/40 dark:text-[#00ED64]"
                  : tone === "blue"
                  ? "bg-blue-50 border-blue-200 text-blue-500 dark:bg-[#00ED64]/20 dark:border-[#00ED64]/40 dark:text-[#00ED64]"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-[#00ED64]/20 dark:border-[#00ED64]/40 dark:text-[#00ED64]";
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10 shadow-xs text-xs font-semibold text-zinc-800 dark:text-white/95"
                >
                  <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${iconBox}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="leading-snug">{text}</span>
                </div>
              );
            })}
          </div>

          {/* Security & Organization Footer */}
          <div className="relative pt-4 border-t border-zinc-200 dark:border-white/15 text-[11px] text-zinc-500 dark:text-white/60 font-semibold flex items-center justify-between">
            <span>Control Room Console</span>
            <span className="font-mono text-zinc-800 dark:text-white/80">v2.4 Online</span>
          </div>
        </aside>

        {/* Right Form Panel */}
        <div className="flex-1 flex flex-col justify-center min-h-0 bg-white dark:bg-[#092532] p-6 sm:p-9 md:p-10">
          <div className="w-full max-w-md mx-auto">
            {/* Header Kicker & Title */}
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-[#00ED64] font-mono mb-2">
                Operator Portal
              </p>
              <h2 className="text-2xl sm:text-[1.75rem] font-bold text-zinc-800 dark:text-white tracking-tight font-display">
                Sign in to console
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-zinc-600 dark:text-slate-400 leading-relaxed">
                Enter your credentials to record feeder loads, modify allotments,
                or save hourly logsheets.
              </p>
            </div>

            {/* Error banner */}
            {error ? (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-start gap-2.5 shadow-xs"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            ) : null}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="page-login-user"
                  className="block text-xs font-bold text-zinc-800 dark:text-slate-200 uppercase tracking-wide mb-1.5"
                >
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 dark:text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="page-login-user"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={busy}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-[#0D3349] text-sm font-semibold text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-all shadow-xs disabled:opacity-60"
                    placeholder="Enter operator username"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="page-login-pass"
                  className="block text-xs font-bold text-zinc-800 dark:text-slate-200 uppercase tracking-wide mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 dark:text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="page-login-pass"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className="w-full h-11 pl-10 pr-11 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-[#0D3349] text-sm font-semibold text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-all shadow-xs disabled:opacity-60"
                    placeholder="Enter account password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-700/60 transition-colors"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 mt-2 rounded-xl text-sm font-bold tracking-wide shadow-md transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-[#00ED64] dark:text-[#001E2B] dark:hover:bg-[#00c753] shadow-emerald-600/20 dark:shadow-[#00ED64]/20"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white dark:border-[#001E2B] border-t-transparent animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-white dark:text-[#001E2B]" />
                    <span>Sign in to Console</span>
                  </>
                )}
              </button>
            </form>

            {/* Guest Navigation & Info */}
            <div className="mt-7 pt-5 border-t border-zinc-200 dark:border-slate-800">
              <p className="text-center text-xs font-semibold text-zinc-600 dark:text-slate-400 mb-3">
                No account credentials?
              </p>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl text-xs sm:text-sm font-bold text-zinc-800 dark:text-slate-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#0D3349] dark:hover:bg-[#133E56] border border-zinc-200 dark:border-slate-700 transition-colors shadow-xs"
              >
                <Home className="w-3.5 h-3.5 text-zinc-600 dark:text-slate-300" />
                <span>Continue as Guest on Homepage</span>
              </Link>
              <p className="mt-3 text-center text-[11px] text-zinc-500 dark:text-slate-400 leading-relaxed font-medium">
                Guests can freely use the Calculator (compute &amp; copy MW). Sign
                in is only required for saving logs and loadshed data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
