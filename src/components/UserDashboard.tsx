"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  User,
  Activity,
  Calculator,
  History,
  Zap,
  ClipboardEdit,
  TrendingUp,
  BarChart3,
  Shield,
  Clock,
  ArrowRight,
  RefreshCw,
  LayoutDashboard,
  MapPin,
  CircleDot,
  Moon,
  LogOut,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchCalculations, trashCalculation } from "@/lib/api";
import toast from "react-hot-toast";
import ConfirmModal from "./ConfirmModal";

const ROLE_META = {
  admin: {
    label: "Administrator",
    color: "text-emerald-600 text-accent",
    bg: "bg-emerald-500/10 border-accent",
  },
  duty: {
    label: "Duty Operator",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/25",
  },
  "circle-load-input": {
    label: "Circle Load Input",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/25",
  },
  viewer: {
    label: "Viewer",
    color: "text-muted text-muted",
    bg: "bg-surface-20/10 border-slate-500/25",
  },
};

const QUICK_ACTIONS = [
  {
    href: "/calculator",
    title: "Load Calculator",
    desc: "Record feeder MW & voltages",
    icon: Calculator,
    write: false,
  },
  {
    href: "/loadshed",
    title: "Load Shed",
    desc: "Enter LS by feeder & slot",
    icon: Zap,
    write: true,
  },
  {
    href: "/manual",
    title: "Manual Entry",
    desc: "Fill empty hourly slots",
    icon: ClipboardEdit,
    write: true,
  },
  {
    href: "/history",
    title: "Full History",
    desc: "Search, edit, restore logs",
    icon: History,
    write: false,
  },
  {
    href: "/max-load",
    title: "Max Load",
    desc: "Monthly peak analysis",
    icon: TrendingUp,
    write: false,
  },
  {
    href: "/statistics",
    title: "Statistics",
    desc: "Station averages & peaks",
    icon: BarChart3,
    write: false,
  },
  {
    href: "/kushtia-district-load",
    title: "District Load",
    desc: "24h Kushtia demand matrix",
    icon: MapPin,
    write: false,
  },
  {
    href: "/circle-load",
    title: "Circle Load",
    desc: "Multi-SS circle overview",
    icon: CircleDot,
    write: false,
  },
  {
    href: "/generate-night-log",
    title: "Night Logs",
    desc: "Generate overnight sheets",
    icon: Moon,
    write: true,
  },
];

function formatDhaka(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function todayYmdDhaka() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function UserDashboard() {
  const router = useRouter();
  const {
    admin,
    isAuthenticated,
    loading: authLoading,
    role,
    canWrite,
    isAdmin,
    logout,
  } = useAuth();

  const [rows, setRows] = useState([]);
  const [totalMine, setTotalMine] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trashId, setTrashId] = useState(null);
  const [trashing, setTrashing] = useState(false);

  const loadMine = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetchCalculations({ mine: true, limit: 25, page: 1 });
      setRows(res.data || []);
      setTotalMine(res.total ?? (res.data || []).length);
    } catch (err) {
      console.error(err);
      if (!silent) toast.error(err.message || "Failed to load your activity");
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

  const stats = useMemo(() => {
    const today = todayYmdDhaka();
    let todayCount = 0;
    let hourlyCount = 0;
    let totalMwSum = 0;
    for (const r of rows) {
      const d = (r.calculatedAt || r.createdAt || "").toString().slice(0, 10);
      // approximate local day from ISO — good enough for dashboard card
      try {
        const local = new Date(r.calculatedAt || r.createdAt).toLocaleDateString(
          "en-CA",
          { timeZone: "Asia/Dhaka" }
        );
        if (local === today) todayCount++;
      } catch {
        if (d === today) todayCount++;
      }
      if (r.isHourly || r.hourSlot) hourlyCount++;
      totalMwSum += Number(r.totalMW) || 0;
    }
    return {
      todayCount,
      hourlyCount,
      avgMw:
        rows.length > 0 ? (totalMwSum / rows.length).toFixed(2) : "—",
      totalMine,
    };
  }, [rows, totalMine]);

  const roleMeta = ROLE_META[role] || ROLE_META.viewer;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      router.replace("/login");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const confirmTrash = async () => {
    if (!trashId) return;
    setTrashing(true);
    try {
      await trashCalculation(trashId);
      toast.success("Moved to trash");
      setTrashId(null);
      await loadMine(true);
    } catch (err) {
      toast.error(err.message || "Could not move to trash");
    } finally {
      setTrashing(false);
    }
  };

  const visibleActions = QUICK_ACTIONS.filter(
    (a) => !a.write || canWrite
  ).concat(
    isAdmin
      ? [
          {
            href: "/admin",
            title: "Admin Panel",
            desc: "Users & app settings",
            icon: Shield,
            write: false,
          },
        ]
      : []
  );

  if (authLoading || (!isAuthenticated && loading)) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-surface-2 border border-app" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-2 border border-app" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-surface-2 border border-app" />
      </div>
    );
  }

  const displayName =
    admin?.displayName || admin?.username || "Operator";
  const initial = String(displayName).charAt(0).toUpperCase();

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-app bg-surface shadow-[var(--app-shadow)]"
      >
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, var(--app-accent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 p-5 sm:p-6">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 shadow-inner">
              <span className="text-2xl sm:text-3xl font-bold text-accent font-mono">
                {initial}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight truncate">
                  {displayName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleMeta.bg} ${roleMeta.color}`}
                >
                  <LayoutDashboard className="w-3 h-3" />
                  {roleMeta.label}
                </span>
              </div>
              <p className="text-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  @{admin?.username || "—"}
                </span>
                {admin?.assignedStation ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Station: {admin.assignedStation}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accent" />
                  My activity dashboard
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadMine(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-app text-secondary hover:text-app hover:bg-surface-3/70 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-app text-secondary hover:text-danger hover:border-danger/40 hover:bg-danger/5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "My total saves",
            value: stats.totalMine,
            icon: FileText,
            hint: "All-time records you created",
          },
          {
            label: "Today (Dhaka)",
            value: stats.todayCount,
            icon: Clock,
            hint: "Entries dated today",
          },
          {
            label: "Hourly slots",
            value: stats.hourlyCount,
            icon: CheckCircle2,
            hint: "In recent page of your data",
          },
          {
            label: "Avg MW (recent)",
            value: stats.avgMw,
            icon: Activity,
            hint: "Mean total MW on this page",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.28 }}
            className="rounded-xl border border-app bg-surface p-4 sm:p-5 shadow-sm hover:border-accent/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
                {s.label}
              </p>
              <s.icon className="w-4 h-4 text-accent shrink-0" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-app font-mono tabular-nums tracking-tight">
              {s.value}
            </p>
            <p className="text-[11px] text-faint mt-1.5 leading-snug">{s.hint}</p>
          </motion.div>
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-app uppercase tracking-wider">
            Quick actions
          </h2>
          <Link
            href="/"
            className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            All modules <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleActions.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={a.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i, duration: 0.25 }}
              >
                <Link
                  href={a.href}
                  className="group flex items-start gap-3 rounded-xl border border-app bg-surface p-4 hover:border-accent/40 hover:bg-surface-2/80 transition-all shadow-sm h-full"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-app group-hover:text-accent transition-colors">
                        {a.title}
                      </h3>
                      <ArrowRight className="w-3.5 h-3.5 text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">
                      {a.desc}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* My recent activity */}
      <section className="rounded-2xl border border-app bg-surface overflow-hidden shadow-[var(--app-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-app bg-surface-2/50">
          <div>
            <h2 className="text-sm font-bold text-app flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              My recent activity
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              Calculations you saved · soft-delete moves them to History trash
            </p>
          </div>
          <Link
            href="/history"
            className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            Open full history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-surface-2 animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Activity className="w-10 h-10 text-faint mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold text-secondary">
              No personal activity yet
            </p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Saves from the Calculator (and other write tools) will appear here
              once you record data while signed in.
            </p>
            <Link
              href="/calculator"
              className="btn-primary inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Calculator className="w-4 h-4" />
              Open Calculator
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted border-b border-app bg-surface-2/40">
                  <th className="px-4 sm:px-5 py-2.5 font-semibold">When</th>
                  <th className="px-3 py-2.5 font-semibold">Slot</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Total MW</th>
                  <th className="px-3 py-2.5 font-semibold text-right hidden sm:table-cell">
                    Bus 1 / 2
                  </th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">
                    Note
                  </th>
                  <th className="px-4 sm:px-5 py-2.5 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className="border-b border-app/60 hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap font-mono text-xs text-secondary">
                      {formatDhaka(r.calculatedAt || r.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      {r.hourSlot ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono bg-accent/10 text-accent border border-accent/20">
                          {r.hourSlot}
                        </span>
                      ) : (
                        <span className="text-faint text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-app tabular-nums">
                      {Number(r.totalMW || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-muted tabular-nums hidden sm:table-cell">
                      {r.busVoltages?.bus1 ?? "—"} / {r.busVoltages?.bus2 ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted truncate max-w-[160px] hidden md:table-cell">
                      {r.note || "—"}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/history?id=${r._id}`}
                          className="text-[11px] font-semibold text-accent hover:underline px-2 py-1 rounded-md hover:bg-accent/10"
                        >
                          View
                        </Link>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => setTrashId(r._id)}
                            className="text-[11px] font-semibold text-danger/80 hover:text-danger px-2 py-1 rounded-md hover:bg-danger/10"
                          >
                            Trash
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] text-faint pb-4">
        WZPDCL · Bottail-Kushtia 33/11 kV · User action centre
      </p>

      <ConfirmModal
        open={!!trashId}
        title="Move to trash?"
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
