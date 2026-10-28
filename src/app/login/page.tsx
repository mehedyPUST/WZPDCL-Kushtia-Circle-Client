"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonShimmer } from "@/components/SkeletonTable";

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter username and password.");
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
    } catch (err) {
      const msg = err?.message || "Sign in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-full flex items-center justify-center bg-[#090e17] p-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
          <SkeletonShimmer className="h-6 w-36 mx-auto rounded-lg" />
          <SkeletonShimmer className="h-4 w-48 mx-auto rounded-md" />
          <div className="space-y-3 pt-4">
            <SkeletonShimmer className="h-10 w-full rounded-lg" />
            <SkeletonShimmer className="h-10 w-full rounded-lg" />
            <SkeletonShimmer className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-full bg-[#090e17] flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-[52rem] max-h-[min(94dvh,42rem)] bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/60 border border-white/10 overflow-hidden flex flex-col sm:flex-row">
        <aside
          data-keep-dark="true"
          className="relative sm:w-[42%] shrink-0 bg-gradient-to-br from-[#070c16] via-[#0d1526] to-emerald-950/70 border-b sm:border-b-0 sm:border-r border-white/10 text-white px-6 py-7 sm:px-8 sm:py-10 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:22px_22px]" />
          </div>
          <div className="relative">
            <p className="text-xs font-semibold tracking-wide text-emerald-400 mb-3">
              WZPDCL · Bottail Control Room
            </p>
            <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight leading-tight">
              Bottail Substation
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-[18rem]">
              Sign in to save load data and open all tools. Guests may use Home
              and Calculator without an account.
            </p>
          </div>
          <ul className="relative mt-8 sm:mt-0 space-y-3 text-[12px] text-slate-300">
            {[
              "Role-based access: Viewer · Duty · Admin",
              "Hourly logs, loadshed & night data",
              "Secure cookie session",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <span className="leading-snug font-medium">{line}</span>
              </li>
            ))}
          </ul>
          <p className="relative hidden sm:block mt-8 text-[11px] text-slate-500 font-medium">
            Authorized personnel only · Contact Bottail SS for accounts
          </p>
        </aside>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-10 sm:py-9">
            <p className="text-xs font-semibold tracking-wide text-emerald-400 mb-2">
              Operator Portal
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-app tracking-tight font-display">
              Sign in
            </h2>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">
              Use your Bottail SS account. Your role controls the sidebar and
              save permissions.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error ? (
                <div
                  role="alert"
                  className="text-sm font-medium text-rose-200 bg-rose-950/50 border border-rose-500/30 rounded-xl px-3.5 py-2.5 leading-snug"
                >
                  {error}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="page-login-user"
                  className="block text-[12px] font-medium text-slate-300 mb-1.5"
                >
                  Username or email
                </label>
                <input
                  id="page-login-user"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  className="w-full h-11 px-3.5 rounded-xl border border-white/15 bg-slate-950/90 text-[15px] font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none focus:bg-slate-950 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-60"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label
                  htmlFor="page-login-pass"
                  className="block text-[12px] font-medium text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="page-login-pass"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className="w-full h-11 pl-3.5 pr-14 rounded-xl border border-white/15 bg-slate-950/90 text-[15px] font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none focus:bg-slate-950 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-60"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/10"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl text-[14px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="text-center text-[12px] text-slate-400 mb-3">
                Or continue without an account
              </p>
              <Link
                href="/"
                className="flex items-center justify-center w-full h-11 rounded-xl text-[13px] font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-white/10 transition-colors"
              >
                Visit homepage
              </Link>
              <p className="mt-2.5 text-center text-[11px] text-slate-500 leading-relaxed">
                Guests may use Home and Calculator (calculate / copy only).
                Sign in to save history and open other tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
