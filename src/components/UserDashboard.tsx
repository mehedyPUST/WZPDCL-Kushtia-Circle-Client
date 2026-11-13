"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  Clock,
  FileText,
  History,
  Moon,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  changePassword,
  fetchCalculations,
  trashCalculation,
  updateProfile,
} from "@/lib/api";
import {
  computeDashboardMetrics,
  filterDashboardRows,
  formatDhakaDateTime,
  getCurrentShiftInfo,
  recordLoadShedMW,
  todayYmdDhaka,
  type DashboardCalcRow,
  type DashboardFilter,
} from "@/lib/dashboardStats";
import { toDayKey } from "@/lib/logsheetSlots";
import ConfirmModal from "./ConfirmModal";
import DashboardAccountPanel from "./DashboardAccountPanel";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  duty: "Duty Operator",
  "circle-load-input": "Circle Load Input",
  viewer: "Viewer",
};

type WorkspaceTab = "overview" | "account";

export default function UserDashboard() {
  const router = useRouter();
  const {
    admin,
    isAuthenticated,
    loading: authLoading,
    role,
    shiftLogoutAt,
    canWrite,
    isAdmin,
    logout,
    applyAdminUpdate,
  } = useAuth();

  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [rows, setRows] = useState<DashboardCalcRow[]>([]);
  const [totalMine, setTotalMine] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [query, setQuery] = useState("");
  const [trashId, setTrashId] = useState<string | null>(null);
  const [trashing, setTrashing] = useState(false);

  // Client-hydrated Dhaka shift info to avoid SSR/client mismatch
  const [shiftInfo, setShiftInfo] = useState(() => ({
    id: "A",
    label: "A Shift",
    window: "09:00 – 14:00",
    timeLabel: "",
    dateLabel: "",
    todayYmd: "",
  }));

  // Profile & password state
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setShiftInfo(getCurrentShiftInfo(new Date()));
    const id = setInterval(() => {
      setShiftInfo(getCurrentShiftInfo(new Date()));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const loadMine = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setLoadError("");
    try {
      const res = await fetchCalculations({ mine: true, limit: 25, page: 1 });
      setRows(res.data || []);
      setTotalMine(res.total ?? (res.data || []).length);
    } catch (err: any) {
      const msg = err?.message || "Failed to load your activity";
      setLoadError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    loadMine();
  }, [authLoading, isAuthenticated, loadMine, router]);

  const adminId = admin?.id || "";
  const adminDisplayName = admin?.displayName || "";
  const adminEmail = admin?.email || "";

  useEffect(() => {
    if (!adminId) return;
    setDisplayNameDraft(adminDisplayName);
    setEmailDraft(adminEmail);
  }, [adminId, adminDisplayName, adminEmail]);

  const effectiveTodayYmd = shiftInfo.todayYmd || todayYmdDhaka();

  const metrics = useMemo(
    () => computeDashboardMetrics(rows, totalMine, effectiveTodayYmd),
    [rows, totalMine, effectiveTodayYmd]
  );

  const filteredRows = useMemo(
    () =>
      filterDashboardRows(rows, {
        filter,
        query,
        todayYmd: effectiveTodayYmd,
      }),
    [rows, filter, query, effectiveTodayYmd]
  );

  const roleLabel = ROLE_LABELS[role || "viewer"] || "Viewer";
  const displayName = admin?.displayName || admin?.username || "Operator";
  const initial = String(displayName).charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextDisplayName = displayNameDraft.trim();
    const nextEmail = emailDraft.trim().toLowerCase();
    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await updateProfile({
        displayName: nextDisplayName,
        email: nextEmail,
      });
      if (applyAdminUpdate && res?.data) {
        applyAdminUpdate(res.data);
      }
      if (res?.data) {
        setDisplayNameDraft(res.data.displayName || "");
        setEmailDraft(res.data.email || "");
      }
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmTrash = async () => {
    if (!trashId) return;
    setTrashing(true);
    try {
      await trashCalculation(trashId);
      toast.success("Moved to History trash");
      setTrashId(null);
      await loadMine(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not move to trash");
    } finally {
      setTrashing(false);
    }
  };

  if (authLoading || (!isAuthenticated && loading)) {
    return (
      <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="h-24 rounded-xl bg-white dark:bg-surface border border-zinc-200 dark:border-app animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-surface border border-zinc-200 dark:border-app animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white dark:bg-surface border border-zinc-200 dark:border-app animate-pulse" />
      </div>
    );
  }

  const slotCoveragePct = Math.min(
    100,
    Math.round((metrics.todaySlotsCount / 26) * 100)
  );
  const maxTrendMw = Math.max(
    1,
    ...metrics.recentTrend.map((pt) => pt.mw + pt.lsMw)
  );

  const workflowLinks = [
    {
      href: "/calculator",
      label: "Record Hourly Load",
      detail: "Compute feeder MW and bus kV",
      icon: Calculator,
    },
    ...(canWrite
      ? [
          {
            href: "/loadshed",
            label: "Load Shed Sheet",
            detail: "Update feeder allotments & LS",
            icon: Zap,
          },
          {
            href: "/night-logs",
            label: "Night Log Generator",
            detail: "Prepare overnight 22–08h slots",
            icon: Moon,
          },
        ]
      : []),
    {
      href: "/history",
      label: "Full History Ledger",
      detail: "Search, audit & restore logs",
      icon: History,
    },
    {
      href: "/max-load",
      label: "Peak Demand Report",
      detail: "Monthly feeder peak breakdown",
      icon: TrendingUp,
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "User & Settings Admin",
            detail: "Accounts, limits & defaults",
            icon: Shield,
          },
        ]
      : []),
  ];

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
      {/* Executive Header */}
      <header className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-4 sm:p-5 shadow-xs dark:shadow-[var(--app-shadow)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/14 dark:border-emerald-400/35 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="text-xl sm:text-2xl font-bold font-mono">
                {initial}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-white tracking-tight font-display truncate">
                {displayName}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {roleLabel}
                </span>
                <span aria-hidden="true" className="text-zinc-400 dark:text-slate-500">
                  ·
                </span>
                <span className="font-mono text-zinc-700 dark:text-slate-200">
                  @{admin?.username || "—"}
                </span>
                <span aria-hidden="true" className="text-zinc-400 dark:text-slate-500">
                  ·
                </span>
                <span>
                  {admin?.assignedStation || "Bottail 33/11 kV Substation"}
                </span>
                <span aria-hidden="true" className="text-zinc-400 dark:text-slate-500">
                  ·
                </span>
                <span className="font-mono tabular-nums text-zinc-700 dark:text-slate-300">
                  {shiftInfo.label} ({shiftInfo.window})
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => loadMine(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-app bg-white dark:bg-surface-2 text-zinc-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-surface-3 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <Link
              href="/calculator"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Calculator className="w-3.5 h-3.5" />
              Open Calculator
            </Link>
          </div>
        </div>

        {/* Workspace Tab Bar + Dhaka Operational Date */}
        <div className="mt-4 pt-3.5 border-t border-zinc-200 dark:border-app/70 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-surface-2 border border-zinc-200 dark:border-app"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "overview"}
              onClick={() => setTab("overview")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === "overview"
                  ? "bg-white dark:bg-emerald-500 text-zinc-800 dark:text-[#031d16] shadow-xs"
                  : "text-zinc-600 dark:text-slate-300 hover:text-zinc-800 dark:hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "account"}
              onClick={() => setTab("account")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === "account"
                  ? "bg-white dark:bg-emerald-500 text-zinc-800 dark:text-[#031d16] shadow-xs"
                  : "text-zinc-600 dark:text-slate-300 hover:text-zinc-800 dark:hover:text-white"
              }`}
            >
              Account &amp; Security
            </button>
          </div>

          <div className="text-xs text-zinc-600 dark:text-slate-300 font-mono tabular-nums flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400 shrink-0" />
            <span suppressHydrationWarning>
              {shiftInfo.dateLabel
                ? `${shiftInfo.dateLabel} · ${shiftInfo.timeLabel} BST`
                : "Asia/Dhaka Operational Clock"}
            </span>
          </div>
        </div>
      </header>

      {tab === "account" ? (
        <DashboardAccountPanel
          username={admin?.username || ""}
          roleLabel={roleLabel}
          assignedStation={admin?.assignedStation || ""}
          lastLoginLabel={formatDhakaDateTime(admin?.lastLogin)}
          shiftLogoutAt={shiftLogoutAt}
          canWrite={canWrite}
          isAdmin={isAdmin}
          displayNameDraft={displayNameDraft}
          emailDraft={emailDraft}
          savingProfile={savingProfile}
          onChangeDisplayName={setDisplayNameDraft}
          onChangeEmail={setEmailDraft}
          onSaveProfile={handleSaveProfile}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          savingPassword={savingPassword}
          onChangeCurrentPassword={setCurrentPassword}
          onChangeNewPassword={setNewPassword}
          onChangeConfirmPassword={setConfirmPassword}
          onChangePassword={handleChangePassword}
          onLogout={handleLogout}
        />
      ) : (
        <>
          {/* 4-Column Operational KPI Strip */}
          <section
            aria-label="Key operator metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-4 sm:p-5 shadow-xs dark:shadow-[var(--app-shadow)] dark:hover:border-app-strong transition-colors">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-600 dark:text-slate-300">
                  My Total Logs
                </p>
                <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 dark:bg-sky-500/12 dark:border-sky-400/25 dark:text-sky-400 inline-flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl sm:text-3xl font-bold text-zinc-800 dark:text-white font-mono tabular-nums tracking-tight">
                {metrics.totalMine}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-slate-400 font-mono tabular-nums">
                {metrics.hourlyCount} hourly in latest 25
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-4 sm:p-5 shadow-xs dark:shadow-[var(--app-shadow)] dark:hover:border-app-strong transition-colors">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-600 dark:text-slate-300">
                  Today&apos;s Coverage
                </p>
                <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/12 dark:border-emerald-400/25 dark:text-emerald-400 inline-flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl sm:text-3xl font-bold text-zinc-800 dark:text-white font-mono tabular-nums tracking-tight">
                {metrics.todaySlotsCount}
                <span className="text-base font-semibold text-zinc-500 dark:text-slate-400">
                  {" "}
                  / 26
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--app-accent)] transition-all"
                    style={{ width: `${slotCoveragePct}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-zinc-600 dark:text-slate-300">
                  {metrics.todayCount} saves
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-4 sm:p-5 shadow-xs dark:shadow-[var(--app-shadow)] dark:hover:border-app-strong transition-colors">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-600 dark:text-slate-300">
                  Latest Recorded Load
                </p>
                <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/12 dark:border-emerald-400/25 dark:text-emerald-400 inline-flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
                {metrics.latestMw === "—" ? "—" : `${metrics.latestMw} MW`}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-slate-400 font-mono tabular-nums">
                Slot {metrics.latestSlot}
                {metrics.latestLsMw > 0
                  ? ` · ${metrics.latestLsMw.toFixed(1)} MW shed`
                  : " · Nominal"}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-4 sm:p-5 shadow-xs dark:shadow-[var(--app-shadow)] dark:hover:border-app-strong transition-colors">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-600 dark:text-slate-300">
                  Recent Peak Load
                </p>
                <span className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-orange-500 dark:bg-amber-500/12 dark:border-amber-400/25 dark:text-amber-400 inline-flex items-center justify-center shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl sm:text-3xl font-bold text-zinc-800 dark:text-white font-mono tabular-nums tracking-tight">
                {metrics.peakMw === "—" ? "—" : `${metrics.peakMw} MW`}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-slate-400 font-mono tabular-nums">
                Mean {metrics.avgMw === "—" ? "—" : `${metrics.avgMw} MW`} ·{" "}
                {metrics.totalLsEntries} LS events
              </p>
            </div>
          </section>

          {/* 12-Col Main Operational Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 8 Columns: Personal Activity Ledger */}
            <section
              aria-label="Personal activity log"
              className="lg:col-span-8 rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface overflow-hidden shadow-xs dark:shadow-[var(--app-shadow)]"
            >
              <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-app/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-800 dark:text-white font-display">
                      Recent Activity Ledger
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
                      Personal calculation entries · soft-delete moves items to History trash
                    </p>
                  </div>
                  <Link
                    href="/history"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Full history <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Filter + Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div
                    role="group"
                    aria-label="Filter activity"
                    className="inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-surface-2 border border-zinc-200 dark:border-app self-start"
                  >
                    {(
                      [
                        { id: "all", label: "All" },
                        { id: "today", label: "Today" },
                        { id: "loadshed", label: "With Loadshed" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilter(opt.id)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          filter === opt.id
                            ? opt.id === "loadshed"
                              ? "bg-orange-500 dark:bg-amber-500 text-white dark:text-[#1c1002] shadow-xs"
                              : opt.id === "today"
                                ? "bg-blue-500 dark:bg-sky-500 text-white dark:text-[#041827] shadow-xs"
                                : "bg-white dark:bg-emerald-500 text-zinc-800 dark:text-[#031d16] shadow-xs"
                            : "text-zinc-600 dark:text-slate-300 hover:text-zinc-800 dark:hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter slot, note, or MW…"
                      aria-label="Filter recent activity"
                      className="w-full h-9 rounded-lg border border-zinc-200 dark:border-app bg-zinc-50 dark:bg-surface-2 pl-8 pr-3 text-xs text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-emerald-500/25 focus:border-emerald-600 dark:focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {loadError ? (
                <div className="px-5 py-4 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3">
                  <span>{loadError}</span>
                  <button
                    type="button"
                    onClick={() => loadMine()}
                    className="font-semibold underline shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="p-5 space-y-2.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-11 rounded-lg bg-zinc-100 dark:bg-surface-2/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Activity className="w-9 h-9 text-zinc-400 dark:text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-zinc-800 dark:text-white">
                    No recorded entries yet
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Hourly saves and manual entries you create while signed in appear in this ledger.
                  </p>
                  <Link
                    href="/calculator"
                    className="btn-primary inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg text-xs font-semibold"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Log First Entry
                  </Link>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-white">
                    No matching entries
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-slate-400 mt-1">
                    No records match the current filter or search term.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                    className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-app text-zinc-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-surface-2 cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-slate-300 border-b border-zinc-200 dark:border-app bg-zinc-50 dark:bg-surface-2/80">
                        <th className="px-4 py-2.5">Timestamp (BST)</th>
                        <th className="px-3 py-2.5">Slot</th>
                        <th className="px-3 py-2.5 text-right hidden sm:table-cell">
                          Bus 1 / 2 (kV)
                        </th>
                        <th className="px-3 py-2.5 text-right">Total MW</th>
                        <th className="px-3 py-2.5 text-right">LS MW</th>
                        <th className="px-3 py-2.5 hidden md:table-cell">Note</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-[var(--app-border)]">
                      {filteredRows.map((r) => {
                        const ls = recordLoadShedMW(r);
                        const dayParam = toDayKey(
                          r.calculatedAt || r.createdAt || ""
                        );
                        return (
                          <tr
                            key={r._id}
                            className="hover:bg-zinc-50 dark:hover:bg-surface-2/55 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap font-mono tabular-nums text-zinc-700 dark:text-slate-300">
                              {formatDhakaDateTime(
                                r.calculatedAt || r.createdAt
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap font-mono font-semibold text-zinc-800 dark:text-white">
                              {r.hourSlot || "Manual"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular-nums hidden sm:table-cell">
                              <span className="text-blue-600 dark:text-sky-300 font-semibold">
                                {r.busVoltages?.bus1 ?? "—"}
                              </span>
                              <span className="text-zinc-400 mx-1">/</span>
                              <span className="text-orange-600 dark:text-amber-300 font-semibold">
                                {r.busVoltages?.bus2 ?? "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                              {Number(r.totalMW || 0).toFixed(1)}
                            </td>
                            <td
                              className={`px-3 py-3 text-right font-mono tabular-nums font-semibold ${
                                ls > 0
                                  ? "text-orange-600 dark:text-amber-300"
                                  : "text-zinc-400 dark:text-slate-500"
                              }`}
                            >
                              {ls > 0 ? ls.toFixed(1) : "—"}
                            </td>
                            <td className="px-3 py-3 text-zinc-600 dark:text-slate-300 truncate max-w-[160px] hidden md:table-cell">
                              {r.note || "—"}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <Link
                                  href={`/history?id=${r._id}`}
                                  className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline"
                                >
                                  View
                                </Link>
                                {canWrite && dayParam ? (
                                  <Link
                                    href={`/manual-input?day=${dayParam}`}
                                    className="text-xs font-semibold text-zinc-600 dark:text-slate-300 hover:text-zinc-900 dark:hover:text-white hover:underline"
                                  >
                                    Sheet
                                  </Link>
                                ) : null}
                                {canWrite ? (
                                  <button
                                    type="button"
                                    onClick={() => setTrashId(r._id)}
                                    aria-label={`Move entry ${r.hourSlot || r._id} to trash`}
                                    className="p-1 rounded text-zinc-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Right 4 Columns: Recent Load Trend + Operational Workflows */}
            <aside className="lg:col-span-4 space-y-5">
              {/* Mini Recent Trend Strip */}
              <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-5 shadow-xs dark:shadow-[var(--app-shadow)]">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-app/70">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-800 dark:text-white font-display">
                      Recent Load Profile
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                      Last {metrics.recentTrend.length || 0} personal readings (MW)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-[var(--app-accent)]" />
                      Load
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-orange-500 dark:bg-amber-400" />
                      LS
                    </span>
                  </div>
                </div>

                {metrics.recentTrend.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500 dark:text-slate-400">
                    Save readings in Calculator to see your trend bars here.
                  </p>
                ) : (
                  <div className="pt-4 space-y-2.5">
                    {metrics.recentTrend.map((pt) => {
                      const loadPct = Math.max(
                        4,
                        Math.round((pt.mw / maxTrendMw) * 100)
                      );
                      const lsPct =
                        pt.lsMw > 0
                          ? Math.max(3, Math.round((pt.lsMw / maxTrendMw) * 100))
                          : 0;
                      return (
                        <div key={pt.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                            <span className="font-semibold text-zinc-700 dark:text-slate-200">
                              {pt.label}
                            </span>
                            <span className="text-zinc-600 dark:text-slate-300">
                              <strong className="text-emerald-700 dark:text-emerald-400">
                                {pt.mw.toFixed(1)}
                              </strong>
                              {pt.lsMw > 0 ? (
                                <span className="text-orange-600 dark:text-amber-300 ml-1.5">
                                  +{pt.lsMw.toFixed(1)} LS
                                </span>
                              ) : null}{" "}
                              MW
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100 dark:bg-surface-2 overflow-hidden flex">
                            <div
                              className="h-full bg-[var(--app-accent)]"
                              style={{ width: `${loadPct}%` }}
                            />
                            {lsPct > 0 ? (
                              <div
                                className="h-full bg-orange-500 dark:bg-amber-400"
                                style={{ width: `${lsPct}%` }}
                              />
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Focused Station Workflows */}
              <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-surface p-5 shadow-xs dark:shadow-[var(--app-shadow)]">
                <div className="pb-3 border-b border-zinc-200 dark:border-app/70">
                  <h2 className="text-sm font-semibold text-zinc-800 dark:text-white font-display">
                    Station Operations
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                    Primary substation worksheets &amp; reports
                  </p>
                </div>

                <nav
                  aria-label="Station workflows"
                  className="divide-y divide-zinc-100 dark:divide-[var(--app-border)]"
                >
                  {workflowLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center justify-between gap-3 py-3 hover:bg-zinc-50 dark:hover:bg-surface-2/60 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-surface-2 border border-zinc-200 dark:border-app inline-flex items-center justify-center shrink-0 group-hover:border-emerald-300 dark:group-hover:border-emerald-500/35 transition-colors">
                            <Icon className="w-4 h-4 text-blue-500 dark:text-emerald-400" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-slate-400 truncate">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>
          </div>
        </>
      )}

      <ConfirmModal
        open={!!trashId}
        title="Move entry to trash?"
        message="This record will be soft-deleted and can be restored from History → Trash."
        confirmLabel={trashing ? "Moving…" : "Move to trash"}
        loading={trashing}
        onConfirm={confirmTrash}
        onCancel={() => !trashing && setTrashId(null)}
        danger
      />
    </div>
  );
}
