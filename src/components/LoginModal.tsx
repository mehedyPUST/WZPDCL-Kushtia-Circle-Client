"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/**
 * Modern professional sign-in (split layout inspired by app-style login pages).
 * Props: open | isOpen (both supported)
 */
export default function LoginModal({
  open,
  isOpen,
  onClose,
  onLogin,
  loading: externalLoading,
}) {
  const router = useRouter();
  const visible = open ?? isOpen ?? false;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setError("");
      setUsername("");
      setPassword("");
      setShowPass(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !(busy || externalLoading)) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, busy, externalLoading, onClose]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter username and password.");
      return;
    }
    setBusy(true);
    try {
      await onLogin(username.trim(), password);
      toast.success("Signed in successfully");
      setUsername("");
      setPassword("");
      onClose?.();
      router.replace("/");
    } catch (err) {
      const msg = err?.message || "Sign in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || externalLoading;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-elevated/90 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose?.();
      }}
    >
      <div className="w-full max-w-[52rem] max-h-[min(92dvh,40rem)] bg-surface-2 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/60 border border-app overflow-hidden flex flex-col sm:flex-row">
        {/* Brand panel */}
        <aside
          data-keep-dark
          className="relative sm:w-[42%] shrink-0 bg-gradient-to-br from-[#001e2b] via-[#023430] to-[#00684a]/50 border-b sm:border-b-0 sm:border-r border-app text-white px-6 py-7 sm:px-8 sm:py-10 flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-[rgba(0,237,100,0.18)] blur-3xl" />
            <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:22px_22px]" />
          </div>

          <div className="relative">
            <p className="text-xs font-semibold tracking-wide text-accent mb-3">
              WZPDCL · Bottail Control Room
            </p>
            <h2 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight leading-tight">
              Bottail Substation
            </h2>
            <p className="mt-2 text-sm text-secondary leading-relaxed max-w-[18rem]">
              Load management for control-room operators — calculate, log, and
              coordinate feeder data.
            </p>
          </div>

          <ul className="relative mt-8 sm:mt-0 space-y-3 text-[12px] text-secondary">
            {[
              "Hourly load & bus voltage logs",
              "Loadshed planning with allotment",
              "History, MAX load & night logs",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-dim text-accent border border-accent">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <span className="leading-snug font-medium">{line}</span>
              </li>
            ))}
          </ul>

          <p className="relative hidden sm:block mt-8 text-[11px] text-faint font-medium">
            Authorized personnel only · Contact Bottail SS for access
          </p>
        </aside>

        {/* Form panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-2 relative">
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-10 sm:py-9">
            <p className="section-kicker mb-2">
              Operator Portal
            </p>
            <h3
              id="login-title"
              className="text-xl sm:text-2xl font-semibold text-app tracking-tight font-display"
            >
              Sign in
            </h3>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">
              Use your Bottail SS operator account to continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error ? (
                <div
                  role="alert"
                  className="text-sm font-medium text-rose-700 bg-rose-50 dark:text-rose-200 dark:bg-rose-950/50 border border-rose-500/30 rounded-xl px-3.5 py-2.5 leading-snug"
                >
                  {error}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="login-username"
                  className="block field-label"
                >
                  Username or email
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={disabled}
                  className="w-full h-11 px-3.5 rounded-xl border border-app bg-surface text-[15px] font-medium text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-shadow disabled:opacity-60"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block field-label"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={disabled}
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-app bg-surface text-[15px] font-medium text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-shadow disabled:opacity-60"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={disabled}
                className="w-full h-11 mt-1 rounded-xl text-[14px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {disabled ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[12px] text-slate-400 leading-relaxed">
              Need an account? Contact{" "}
              <span className="font-semibold text-slate-200">Bottail SS</span>{" "}
              administration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
