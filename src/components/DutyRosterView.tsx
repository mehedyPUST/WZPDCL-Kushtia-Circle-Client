"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Shield,
  Users,
  Clock,
  Trophy,
  ArrowLeft,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchDutyRoster } from "@/lib/api";
import { SHIFT_META } from "@/lib/dutyShifts";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ShiftBadge({ shift }) {
  const meta = SHIFT_META[shift];
  const colors = {
    A: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30",
    B: "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/30",
    C: "bg-violet-500/15 text-violet-900 dark:text-violet-300 border-violet-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors[shift]}`}
    >
      {meta?.label || shift}
    </span>
  );
}

/** Cell: duty shift letters (max-entry person only) */
function ShiftLettersCell({ cell, rowTone }) {
  const border = "border border-[var(--app-border)]";
  if (!cell?.shifts?.length) {
    return (
      <td
        className={`px-2 py-2.5 text-center ${border} ${rowTone} text-[var(--app-text-faint)]`}
      >
        <span className="font-mono text-sm tabular-nums">—</span>
      </td>
    );
  }
  const colors = {
    A: "bg-sky-600 text-white border-sky-700",
    B: "bg-amber-600 text-white border-amber-700",
    C: "bg-violet-700 text-white border-violet-800",
  };
  return (
    <td className={`px-2 py-2.5 text-center ${border} ${rowTone}`}>
      <div className="inline-flex flex-wrap items-center justify-center gap-1">
        {cell.shifts.map((s) => (
          <span
            key={s}
            className={`inline-flex items-center justify-center min-w-[1.6rem] h-7 px-1.5 rounded border text-[12px] font-bold uppercase font-mono tracking-wide ${colors[s]}`}
            title={`Duty ${SHIFT_META[s]?.label || s} (${SHIFT_META[s]?.window}) · ${cell.entries} entr${cell.entries === 1 ? "y" : "ies"}`}
          >
            {s.toLowerCase()}
          </span>
        ))}
      </div>
    </td>
  );
}

export default function DutyRosterView() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();

  const dhakaNow = useMemo(() => {
    try {
      const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
      const [y, m] = s.split("-").map(Number);
      return { year: y, month: m };
    } catch {
      const n = new Date();
      return { year: n.getFullYear(), month: n.getMonth() + 1 };
    }
  }, []);

  const [year, setYear] = useState(dhakaNow.year);
  const [month, setMonth] = useState(dhakaNow.month);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetchDutyRoster({ year, month });
        setData(res.data || null);
        setMeta(res.meta || null);
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to load duty roster");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [year, month]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/dashboard");
      toast.error("Admin access required");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, isAdmin, load, router]);

  const isCurrentOrFutureMonth =
    year > dhakaNow.year ||
    (year === dhakaNow.year && month >= dhakaNow.month);

  const prevMonth = () => {
    if (month <= 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    // Do not navigate into future months (Dhaka calendar)
    if (year > dhakaNow.year) return;
    if (year === dhakaNow.year && month >= dhakaNow.month) return;
    if (month >= 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  // Clamp if state ever lands on a future month
  useEffect(() => {
    if (year > dhakaNow.year) {
      setYear(dhakaNow.year);
      setMonth(dhakaNow.month);
      return;
    }
    if (year === dhakaNow.year && month > dhakaNow.month) {
      setMonth(dhakaNow.month);
    }
  }, [year, month, dhakaNow.year, dhakaNow.month]);

  if (authLoading || (!isAuthenticated && loading)) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 animate-pulse space-y-4">
        <div className="h-24 rounded-2xl bg-surface-2 border border-app" />
        <div className="h-96 rounded-2xl bg-surface-2 border border-app" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-app bg-surface p-5 sm:p-6 shadow-[var(--app-shadow)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight">
                  Monthly Duty Roster
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-accent/10 border-accent/30 text-accent">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed max-w-2xl">
                Each cell shows the shift letter only for the{" "}
                <strong className="text-secondary">duty person</strong> — the
                operator with the <strong className="text-secondary">most calculation entries</strong>{" "}
                in that shift window.{" "}
                <span className="text-faint">
                  Logins <code className="text-[11px]">admin</code> and{" "}
                  <code className="text-[11px]">bottail.mehedy</code> count as the same person (Mehedy).
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-app text-secondary hover:text-app hover:bg-surface-3/70 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin
            </Link>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-app text-secondary hover:text-app hover:bg-surface-3/70 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Shift legend */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["A", "B", "C"]).map((s) => (
            <div
              key={s}
              className="rounded-xl border border-app bg-surface-2/60 px-3 py-2.5 flex items-center gap-2"
            >
              <ShiftBadge shift={s} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-app">{SHIFT_META[s].label}</p>
                <p className="text-[11px] text-muted font-mono">
                  {SHIFT_META[s].window}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Month navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-xl border border-app hover:bg-surface-2 text-secondary hover:text-app transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-app tabular-nums min-w-[10rem] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isCurrentOrFutureMonth}
            className="p-2 rounded-xl border border-app hover:bg-surface-2 text-secondary hover:text-app transition-colors disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent"
            aria-label="Next month"
            title={
              isCurrentOrFutureMonth
                ? "Cannot view future months"
                : "Next month"
            }
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Clock className="w-3.5 h-3.5" />
          Asia/Dhaka · C shift 00–08 counts on previous duty day
          {meta?.recordCount != null ? (
            <span className="font-mono text-secondary">
              · {meta.recordCount} records scanned
            </span>
          ) : null}
        </div>
      </div>

      {/* Month shift leaders */}
      {data?.shiftLeaders ? (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["A", "B", "C"]).map((s) => {
            const lead = data.shiftLeaders[s];
            return (
              <div
                key={s}
                className="rounded-xl border border-app bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <ShiftBadge shift={s} />
                  <Trophy className="w-4 h-4 text-accent" />
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                  Most duty shifts this month
                </p>
                <p className="text-lg font-bold text-app mt-1 truncate">
                  {lead?.person || "—"}
                </p>
                <p className="text-xs text-muted font-mono mt-0.5">
                  {lead?.entries
                    ? `${lead.entries} shift${lead.entries === 1 ? "" : "s"}`
                    : "No data"}
                </p>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Date × person matrix — classic sticky table */}
      <section className="rounded-xl border-2 border-[var(--app-border-strong)] bg-surface shadow-[var(--app-shadow)] overflow-hidden">
        <div className="px-4 sm:px-5 py-2.5 border-b-2 border-[var(--app-border)] bg-[var(--app-surface-2)] flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-app uppercase tracking-wide">
            Monthly duty table
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[var(--app-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-sky-700 bg-sky-600 text-white font-mono font-bold text-[11px]">
                a
              </span>
              09–14
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-amber-700 bg-amber-600 text-white font-mono font-bold text-[11px]">
                b
              </span>
              15–20
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-violet-800 bg-violet-700 text-white font-mono font-bold text-[11px]">
                c
              </span>
              21–08
            </span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : !data?.days?.length || !(data.persons?.length > 0) ? (
          <div className="px-6 py-16 text-center">
            <Activity className="w-10 h-10 text-faint mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold text-secondary">No roster data</p>
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">
              No calculation history found for this month. Duty is inferred from
              saves under each operator&apos;s username.
            </p>
          </div>
        ) : (
          <div className="duty-roster-scroll max-h-[min(70vh,720px)] overflow-auto relative">
            <table className="w-full text-sm border-collapse min-w-[560px] table-fixed">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-0 left-0 z-30 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--app-text)] border border-[var(--app-border-strong)] bg-[var(--app-surface-3)] min-w-[9.5rem] w-[9.5rem] shadow-[2px_2px_0_0_rgba(0,0,0,0.04)]"
                  >
                    Date
                  </th>
                  {data.persons.map((p) => (
                    <th
                      key={p.person}
                      scope="col"
                      title={`${p.shifts ?? 0} duty shifts · ${p.entries} calc entries this month`}
                      className="sticky top-0 z-20 px-2 py-3 text-center border border-[var(--app-border-strong)] bg-[var(--app-surface-3)] min-w-[7rem] shadow-[0_2px_0_0_rgba(0,0,0,0.04)]"
                    >
                      <span className="block text-[13px] font-bold text-[var(--app-text)] truncate px-0.5">
                        {p.person}
                      </span>
                      <span className="mt-1 block text-[10px] font-mono font-semibold text-[var(--app-text-muted)]">
                        {p.shifts ?? 0} shifts
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((row) => {
                  const isOddDay = row.day % 2 === 1;
                  /* Solid alternating tones for light + dark readability */
                  const rowTone = isOddDay
                    ? "bg-[var(--duty-row-odd)]"
                    : "bg-[var(--duty-row-even)]";
                  const dateTone = isOddDay
                    ? "bg-[var(--duty-row-odd-sticky)]"
                    : "bg-[var(--duty-row-even-sticky)]";
                  return (
                    <tr key={row.ymd} className="group">
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 px-3 py-2.5 text-left border border-[var(--app-border)] whitespace-nowrap ${dateTone} group-hover:brightness-[0.97] dark:group-hover:brightness-110`}
                      >
                        <span className="block text-[13px] font-bold text-[var(--app-text)] tabular-nums leading-tight">
                          {row.dateLabel ||
                            `${row.day} ${MONTH_NAMES[month - 1]?.slice(0, 3)} ${year}`}
                        </span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)] mt-0.5">
                          {row.weekday}
                        </span>
                      </th>
                      {data.persons.map((p) => (
                        <ShiftLettersCell
                          key={p.person}
                          cell={row.byPerson?.[p.person]}
                          rowTone={rowTone}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly leaderboard */}
      {data?.leaderboard?.length > 0 ? (
        <section className="rounded-2xl border border-app bg-surface p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-app uppercase tracking-wider">
              Month leaderboard · duty shifts
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.leaderboard.slice(0, 12).map((row, i) => (
              <div
                key={row.person}
                className="flex items-center gap-3 rounded-xl border border-app bg-surface-2/40 px-3 py-2"
              >
                <span className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent font-mono">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-app truncate">
                    {row.person}
                  </p>
                  <p className="text-[11px] text-muted font-mono">
                    {row.shifts ?? row.entries} duty shift
                    {(row.shifts ?? row.entries) === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {data.classified != null ? (
            <p className="text-[11px] text-faint mt-3">
              Ranked by shifts assigned (max entries per day/shift) ·{" "}
              {data.classified} calc records scanned
              {data.skipped
                ? ` · ${data.skipped} skipped (no time / outside month)`
                : ""}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
