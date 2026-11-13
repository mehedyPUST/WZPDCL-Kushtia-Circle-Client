"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  X,
  AlertCircle,
  Zap,
  Activity,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { APP_META } from "@/lib/constants";

interface LoginModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onLogin: (u: string, p: string) => Promise<any>;
  loading?: boolean;
}

export default function LoginModal({
  open,
  isOpen,
  onClose,
  onLogin,
  loading: externalLoading,
}: LoginModalProps) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(busy || externalLoading)) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, busy, externalLoading, onClose]);

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
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
    } catch (err: any) {
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !disabled) onClose?.();
      }}
    >
      <div className="w-full max-w-[54rem] max-h-[min(92dvh,39rem)] bg-white dark:bg-[#092532] rounded-3xl shadow-2xl border border-zinc-200 dark:border-[rgba(0,237,100,0.2)] overflow-hidden flex flex-col md:flex-row transition-all relative">
        {/* Left Presentation Panel — White/Zinc Base in Light Mode / MongoDB Forest Slate in Dark Mode */}
        <aside className="relative md:w-[44%] shrink-0 bg-zinc-50 dark:bg-gradient-to-br dark:from-[#001E2B] dark:via-[#092532] dark:to-[#00684A] border-b md:border-b-0 md:border-r border-zinc-200 dark:border-white/10 p-6 sm:p-7 md:p-8 flex flex-col justify-between overflow-hidden">
          {/* Subtle Ambient Lighting */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-emerald-100/70 dark:bg-[#00ED64]/15 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-52 h-52 rounded-full bg-blue-100/60 dark:bg-[#0496FF]/15 blur-3xl" />
          </div>

          {/* Substation Logo & Title */}
          <div className="relative">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md border border-zinc-200 dark:border-white/20 shrink-0 flex items-center justify-center">
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
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-[#00ED64] font-mono leading-tight">
                  WZPDCL · Kushtia
                </span>
                <span className="block text-xs text-zinc-600 dark:text-white/80 font-semibold leading-tight mt-0.5">
                  S&amp;D Division-1
                </span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-zinc-800 dark:text-white font-display">
              Bottail Substation
            </h2>
            <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-200">
              33/11 kV SCADA Control Console
            </p>
            <p className="mt-2 text-xs text-zinc-600 dark:text-white/75 leading-relaxed">
              Sign in to record hourly feeder calculations, manage loadshed plans,
              and maintain official shift logs.
            </p>
          </div>

          {/* Features */}
          <div className="relative my-5 md:my-0 space-y-2">
            {[
              { icon: Zap, text: "Real-time feeder MW calculation", tone: "emerald" },
              { icon: Activity, text: "Loadshed planner & allotment", tone: "orange" },
              { icon: FileSpreadsheet, text: "Official logs & night sheets", tone: "blue" },
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
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-800 dark:text-white/95 shadow-xs"
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${iconBox}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <span>{text}</span>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="relative hidden sm:block text-[11px] text-zinc-500 dark:text-white/60 font-semibold">
            Authorized personnel only · S&amp;D-1 Kushtia
          </p>
        </aside>

        {/* Right Form Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#092532] relative">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-40 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-9 flex flex-col justify-center">
            <div className="w-full max-w-sm mx-auto">
              {/* Header Kicker & Title */}
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-[#00ED64] font-mono mb-2">
                  Operator Login
                </p>
                <h3
                  id="login-modal-title"
                  className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-white tracking-tight font-display"
                >
                  Sign in
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-slate-400 leading-relaxed">
                  Enter your Bottail SS credentials to continue.
                </p>
              </div>

              {/* Error banner */}
              {error ? (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/50 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-start gap-2 shadow-xs"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              ) : null}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="modal-login-username"
                    className="block text-xs font-bold text-zinc-800 dark:text-slate-200 uppercase tracking-wide mb-1"
                  >
                    Username or email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 dark:text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="modal-login-username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={disabled}
                      className="w-full h-10.5 pl-10 pr-3.5 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-[#0D3349] text-sm font-semibold text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-all shadow-xs disabled:opacity-60"
                      placeholder="Enter username"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="modal-login-password"
                    className="block text-xs font-bold text-zinc-800 dark:text-slate-200 uppercase tracking-wide mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 dark:text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="modal-login-password"
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={disabled}
                      className="w-full h-10.5 pl-10 pr-11 rounded-xl border border-zinc-300 dark:border-slate-700 bg-white dark:bg-[#0D3349] text-sm font-semibold text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-all shadow-xs disabled:opacity-60"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-700/60 transition-colors"
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
                  disabled={disabled}
                  className="w-full h-11 mt-1 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-[#00ED64] dark:text-[#001E2B] dark:hover:bg-[#00c753] shadow-emerald-600/20 dark:shadow-[#00ED64]/20"
                >
                  {disabled ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white dark:border-[#001E2B] border-t-transparent animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 text-white dark:text-[#001E2B]" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-zinc-500 dark:text-slate-400">
                Need an account? Contact{" "}
                <span className="font-semibold text-zinc-800 dark:text-slate-200">
                  Bottail SS Admin
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
