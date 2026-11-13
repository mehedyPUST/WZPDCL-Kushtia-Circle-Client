"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchDutyRoster } from "@/lib/api";
import {
  formatShiftCount,
  SHIFT_META,
  type DutyRosterDay,
  type DutyRosterResult,
  type PersonDayCell,
  type ShiftId,
} from "@/lib/dutyShifts";

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

const SHIFT_IDS: ShiftId[] = ["A", "B", "C"];

const SHIFT_SOLID_CLASS: Record<ShiftId, string> = {
  A: "bg-blue-500 text-white border-blue-600 dark:border-blue-400/60",
  B: "bg-orange-500 text-white border-orange-600 dark:border-orange-400/60",
  C: "bg-[#059669] dark:bg-emerald-600 text-white border-[#047857] dark:border-emerald-400/40",
};

const SHIFT_SOFT_CLASS: Record<ShiftId, string> = {
  A: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  B: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
  C: "bg-emerald-500/10 text-[#047857] dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-400/35",
};

const SHIFT_CARD_ACCENT: Record<ShiftId, string> = {
  A: "border-l-4 border-l-blue-500",
  B: "border-l-4 border-l-orange-500",
  C: "border-l-4 border-l-[#059669] dark:border-l-emerald-400",
};

function ShiftTag({ shift }: { shift: ShiftId }) {
  const meta = SHIFT_META[shift];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${SHIFT_SOFT_CLASS[shift]}`}
    >
      {meta?.label || shift}
    </span>
  );
}

/** Cell: duty shift markers for an operator on a given day (supports shared 0.5 ties) */
function ShiftLettersCell({
  cell,
  day,
  person,
  rowTone,
}: {
  cell?: PersonDayCell;
  day: DutyRosterDay;
  person: string;
  rowTone: string;
}) {
  const border = "border border-[var(--app-border)]";
  if (!cell?.shifts?.length) {
    return (
      <td
        className={`px-2 py-2 text-center ${border} ${rowTone} text-[var(--app-text-faint)]`}
      >
        <span className="font-mono text-xs tabular-nums">—</span>
      </td>
    );
  }

  return (
    <td className={`px-2 py-2 text-center ${border} ${rowTone}`}>
      <div className="inline-flex flex-wrap items-center justify-center gap-1">
        {cell.shifts.map((s) => {
          const isShared = cell.sharedShifts?.includes(s);
          const countInShift = day.breakdown?.[s]?.[person] ?? cell.entries;
          const rankInfo = day[s];
          const winnersText = Array.isArray(rankInfo?.winners)
            ? rankInfo.winners.join(" & ")
            : "";
          const tooltip = isShared
            ? `Shared ${SHIFT_META[s].label} (${SHIFT_META[s].window}) · Tied at ${countInShift} entr${countInShift === 1 ? "y" : "ies"}${winnersText ? ` (${winnersText})` : ""}`
            : `Duty ${SHIFT_META[s].label} (${SHIFT_META[s].window}) · ${countInShift} entr${countInShift === 1 ? "y" : "ies"}`;
          return (
            <span
              key={s}
              className={`inline-flex items-center justify-center min-w-[1.65rem] h-6 px-1.5 rounded border text-[11px] font-bold uppercase font-mono tracking-wide ${SHIFT_SOLID_CLASS[s]} ${
                isShared
                  ? "ring-2 ring-amber-400/80 border-dashed"
                  : ""
              }`}
              title={tooltip}
            >
              {s.toLowerCase()}
              {isShared ? (
                <span className="ml-0.5 text-[9px] font-semibold opacity-90">
                  ½
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </td>
  );
}

export default function DutyRosterView() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();

  const dhakaNow = useMemo(() => {
    try {
      const ymd = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Dhaka",
      });
      const [y, m] = ymd.split("-").map(Number);
      return { year: y, month: m, ymd };
    } catch {
      const n = new Date();
      return {
        year: n.getFullYear(),
        month: n.getMonth() + 1,
        ymd: n.toISOString().slice(0, 10),
      };
    }
  }, []);

  const [year, setYear] = useState(dhakaNow.year);
  const [month, setMonth] = useState(dhakaNow.month);
  const [data, setData] = useState<DutyRosterResult | null>(null);
  const [meta, setMeta] = useState<{
    from?: string;
    to?: string;
    todayYmd?: string;
    recordCount?: number;
    unattributed?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFutureDays, setShowFutureDays] = useState(false);
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);
      try {
        const res = await fetchDutyRoster({ year, month });
        setData(res.data || null);
        setMeta(res.meta || null);
      } catch (err: unknown) {
        console.error(err);
        const msg =
          err instanceof Error ? err.message : "Failed to load duty roster";
        setLoadError(msg);
        toast.error(msg);
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

  const isViewingCurrentMonth =
    year === dhakaNow.year && month === dhakaNow.month;

  // Reset selected day & future visibility nicely when switching months
  useEffect(() => {
    setSelectedYmd(null);
    setShowFutureDays(false);
  }, [year, month]);

  const visibleDays = useMemo(() => {
    if (!data?.days) return [];
    if (!isViewingCurrentMonth || showFutureDays) return data.days;
    return data.days.filter((d) => !d.isFuture);
  }, [data, isViewingCurrentMonth, showFutureDays]);

  const futureCount = useMemo(() => {
    if (!data?.days || !isViewingCurrentMonth) return 0;
    return data.days.filter((d) => d.isFuture).length;
  }, [data, isViewingCurrentMonth]);

  // Default selected day: today (if active), else latest day with entries, else first visible day
  const activeDay = useMemo<DutyRosterDay | null>(() => {
    if (!visibleDays.length) return null;
    if (selectedYmd) {
      const found = visibleDays.find((d) => d.ymd === selectedYmd);
      if (found) return found;
    }
    const todayRow = visibleDays.find((d) => d.isToday);
    if (todayRow) return todayRow;
    const lastActive = [...visibleDays]
      .reverse()
      .find((d) => d.totalEntries > 0);
    return lastActive || visibleDays[0];
  }, [visibleDays, selectedYmd]);

  const prevMonth = () => {
    if (month <= 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (year > dhakaNow.year) return;
    if (year === dhakaNow.year && month >= dhakaNow.month) return;
    if (month >= 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

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

  const maxLeaderboardShifts = useMemo(() => {
    if (!data?.leaderboard?.length) return 1;
    return Math.max(1, ...data.leaderboard.map((r) => r.shifts || 0));
  }, [data]);

  if (authLoading || (!isAuthenticated && loading)) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 animate-pulse space-y-4">
        <div className="h-24 rounded-2xl bg-surface-2 border border-app" />
        <div className="h-96 rounded-2xl bg-surface-2 border border-app" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-app bg-surface p-5 shadow-[var(--app-shadow)]"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#059669]/10 dark:bg-emerald-500/12 border border-[#059669]/25 dark:border-emerald-400/30 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-[#059669] dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-[var(--app-text)] tracking-tight">
                  Monthly Duty Roster
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#059669]/30 dark:border-emerald-400/35 bg-[#059669]/10 dark:bg-emerald-500/12 text-[#059669] dark:text-emerald-400">
                  <Shield className="w-3 h-3" />
                  Admin Audit
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted leading-relaxed mt-1 max-w-3xl">
                Duty is awarded to the operator with the highest hourly calculation entries in each shift window.
                Exact ties share equal <strong className="text-secondary">0.5 shift</strong> credit (marked{" "}
                <span className="font-mono font-semibold text-secondary">½</span>);{" "}
                <span className="text-muted">
                  aliases <code className="text-[11px] text-secondary">admin</code>,{" "}
                  <code className="text-[11px] text-secondary">Bottail SS Admin</code>, and{" "}
                  <code className="text-[11px] text-secondary">bottail.mehedy</code> unify under Mehedy.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-app text-secondary hover:text-app hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin Panel
            </Link>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#059669] dark:bg-emerald-600 text-white border border-[#047857] dark:border-emerald-400/40 hover:brightness-105 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Shift legend strip */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {SHIFT_IDS.map((s) => (
            <div
              key={s}
              className={`rounded-xl border border-app bg-surface-2/50 px-3 py-2 flex items-center justify-between gap-2 ${SHIFT_CARD_ACCENT[s]}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded border font-mono font-bold text-xs shrink-0 ${SHIFT_SOLID_CLASS[s]}`}
                >
                  {s}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-800 dark:text-[var(--app-text)]">
                    {SHIFT_META[s].label}
                  </p>
                  <p className="text-[11px] text-muted font-mono">
                    {SHIFT_META[s].window}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                {s === "C" ? "00–08 prev day" : "Same day"}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Month navigator + scope controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-xl border border-app bg-surface hover:bg-surface-2 text-secondary hover:text-app transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-[var(--app-text)] tabular-nums min-w-[10.5rem] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isCurrentOrFutureMonth}
            className="p-2 rounded-xl border border-app bg-surface hover:bg-surface-2 text-secondary hover:text-app transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Next month"
            title={
              isCurrentOrFutureMonth ? "Cannot view future months" : "Next month"
            }
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isViewingCurrentMonth && futureCount > 0 ? (
            <div
              className="inline-flex rounded-xl border border-app bg-surface p-0.5"
              role="group"
              aria-label="Row date scope"
            >
              <button
                type="button"
                onClick={() => setShowFutureDays(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  !showFutureDays
                    ? "bg-[#059669] dark:bg-emerald-600 text-white"
                    : "text-muted hover:text-app"
                }`}
              >
                Up to today ({data?.days ? data.days.length - futureCount : 0}d)
              </button>
              <button
                type="button"
                onClick={() => setShowFutureDays(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  showFutureDays
                    ? "bg-[#059669] dark:bg-emerald-600 text-white"
                    : "text-muted hover:text-app"
                }`}
              >
                Full month ({data?.days?.length || 0}d)
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
            <span>Asia/Dhaka</span>
            {meta?.recordCount != null ? (
              <span className="font-mono text-secondary">
                · {meta.recordCount} records
              </span>
            ) : null}
            {data?.unattributed ? (
              <span
                className="font-mono text-orange-600 dark:text-amber-300"
                title="Legacy pre-auth records without operator username are excluded from rankings"
              >
                · {data.unattributed} legacy unattributed excluded
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Load error state */}
      {loadError ? (
        <div className="rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-orange-700 dark:text-orange-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:brightness-105 transition-all"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Coverage & Shift Leaders strip */}
      {data?.coverage ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Shift coverage card */}
          <div className="rounded-xl border border-app bg-surface p-4 shadow-sm border-l-4 border-l-[#059669] dark:border-l-emerald-400">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Shift Coverage
              </span>
              {(data.coverage.uncoveredShiftSlots ?? 0) === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-zinc-800 dark:text-[var(--app-text)] tabular-nums">
                {data.coverage.coveragePct ?? 0}%
              </p>
              <span className="text-xs font-mono text-muted tabular-nums">
                {data.coverage.filledShiftSlots ?? 0}/
                {data.coverage.totalShiftSlots ?? 0} slots
              </span>
            </div>
            <p className="text-xs mt-1 text-muted">
              {(data.coverage.uncoveredShiftSlots ?? 0) > 0 ? (
                <span className="text-orange-600 dark:text-orange-400 font-semibold">
                  {data.coverage.uncoveredShiftSlots} uncovered gap
                  {data.coverage.uncoveredShiftSlots === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[#059669] dark:text-emerald-400 font-semibold">
                  All elapsed shifts covered
                </span>
              )}
              {(data.coverage.tiedShiftSlots ?? 0) > 0 ? (
                <span className="text-faint">
                  {" "}
                  · {data.coverage.tiedShiftSlots} tied
                </span>
              ) : null}
            </p>
          </div>

          {/* Per-shift leaders */}
          {SHIFT_IDS.map((s) => {
            const lead = data.shiftLeaders?.[s];
            const shiftCountLabel = lead?.entries
              ? `${formatShiftCount(lead.entries)} shift${lead.entries === 1 ? "" : "s"}`
              : "No data";
            const runner = lead?.runnersUp?.[0];
            return (
              <div
                key={s}
                className={`rounded-xl border border-app bg-surface p-4 shadow-sm ${SHIFT_CARD_ACCENT[s]}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <ShiftTag shift={s} />
                  <Trophy className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                </div>
                <p
                  className="text-lg font-bold text-zinc-800 dark:text-[var(--app-text)] truncate mt-1"
                  title={lead?.person || "—"}
                >
                  {lead?.person || "—"}
                </p>
                <p className="text-xs text-muted font-mono mt-0.5 tabular-nums">
                  {shiftCountLabel}
                  {runner
                    ? ` · next: ${runner.person} (${formatShiftCount(runner.entries)})`
                    : ""}
                </p>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Matrix + Day Shift Audit Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* Date × person matrix */}
        <section className="rounded-2xl border border-app bg-surface shadow-[var(--app-shadow)] overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-app bg-surface-2/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-zinc-800 dark:text-[var(--app-text)] uppercase tracking-wide">
                Daily Duty Matrix
              </p>
              <p className="text-[11px] text-muted">
                Click any date row to inspect operator entry counts per shift
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-secondary">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded border font-mono font-bold text-[10px] ${SHIFT_SOLID_CLASS.A}`}
                >
                  A
                </span>
                09–14
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded border font-mono font-bold text-[10px] ${SHIFT_SOLID_CLASS.B}`}
                >
                  B
                </span>
                15–20
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded border font-mono font-bold text-[10px] ${SHIFT_SOLID_CLASS.C}`}
                >
                  C
                </span>
                21–08
              </span>
              <span className="inline-flex items-center gap-1 text-muted">
                <span className="inline-flex items-center justify-center px-1 h-5 rounded border border-dashed border-amber-500 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px]">
                  ½
                </span>
                Shared tie
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-2.5 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : !visibleDays.length || !(data?.persons?.length > 0) ? (
            <div className="px-6 py-16 text-center">
              <Activity className="w-10 h-10 text-faint mx-auto mb-3 opacity-60" />
              <p className="text-sm font-semibold text-secondary">
                No attributed roster data
              </p>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                {data?.unattributed
                  ? `${data.unattributed} legacy unattributed records exist for this month, but no operator-attributed logs were found.`
                  : "No calculation history found for this month. Duty is derived from saves under each operator's username."}
              </p>
            </div>
          ) : (
            <div className="duty-roster-scroll max-h-[min(68vh,680px)] overflow-auto relative">
              <table className="w-full text-sm border-collapse min-w-[540px] table-fixed">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky top-0 left-0 z-30 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-[var(--app-text)] border border-[var(--app-border-strong)] bg-[var(--app-surface-3)] w-[9.25rem]"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 z-20 px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-800 dark:text-[var(--app-text)] border border-[var(--app-border-strong)] bg-[var(--app-surface-3)] w-[5.75rem]"
                      title="Shifts A, B, C coverage per day"
                    >
                      A · B · C
                    </th>
                    {data.persons.map((p) => (
                      <th
                        key={p.person}
                        scope="col"
                        title={`${formatShiftCount(p.shifts)} duty shifts · ${p.entries} calc entries this month`}
                        className="sticky top-0 z-20 px-2 py-2.5 text-center border border-[var(--app-border-strong)] bg-[var(--app-surface-3)] min-w-[6.75rem]"
                      >
                        <span className="block text-[13px] font-bold text-zinc-800 dark:text-[var(--app-text)] truncate px-0.5">
                          {p.person}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-mono font-semibold text-muted tabular-nums">
                          {formatShiftCount(p.shifts)} sh · {p.entries} ent
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleDays.map((row) => {
                    const isOddDay = row.day % 2 === 1;
                    const isSelected = activeDay?.ymd === row.ymd;
                    const rowTone = isSelected
                      ? "bg-[#059669]/10 dark:bg-emerald-500/12"
                      : isOddDay
                        ? "bg-[var(--duty-row-odd)]"
                        : "bg-[var(--duty-row-even)]";
                    const dateTone = isSelected
                      ? "bg-emerald-50 dark:bg-emerald-950/60"
                      : isOddDay
                        ? "bg-[var(--duty-row-odd-sticky)]"
                        : "bg-[var(--duty-row-even-sticky)]";

                    return (
                      <tr
                        key={row.ymd}
                        onClick={() => setSelectedYmd(row.ymd)}
                        className="group cursor-pointer"
                      >
                        <th
                          scope="row"
                          className={`sticky left-0 z-10 px-3 py-2 text-left border border-[var(--app-border)] whitespace-nowrap transition-colors ${dateTone} ${
                            row.isToday
                              ? "border-l-[3px] border-l-[#059669] dark:border-l-emerald-400"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[12px] sm:text-[13px] font-bold text-zinc-800 dark:text-[var(--app-text)] tabular-nums leading-tight">
                              {row.dateLabel}
                            </span>
                            {row.isToday ? (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#059669] dark:text-emerald-400">
                                Today
                              </span>
                            ) : null}
                          </div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted mt-0.5">
                            {row.weekday}
                            {row.totalEntries > 0
                              ? ` · ${row.totalEntries} ent`
                              : ""}
                          </span>
                        </th>

                        {/* A·B·C Coverage column */}
                        <td
                          className={`px-1.5 py-2 text-center border border-[var(--app-border)] ${rowTone}`}
                        >
                          <div className="inline-flex items-center justify-center gap-1">
                            {SHIFT_IDS.map((sh) => {
                              const covered = Boolean(row.coveredShifts?.includes(sh));
                              const missingPast = Boolean(row.missingShifts?.includes(sh));
                              return (
                                <span
                                  key={sh}
                                  title={
                                    covered
                                      ? `${SHIFT_META[sh].label}: covered`
                                      : missingPast
                                        ? `${SHIFT_META[sh].label}: missing / 0 entries`
                                        : `${SHIFT_META[sh].label}: upcoming`
                                  }
                                  className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-mono font-bold border ${
                                    covered
                                      ? SHIFT_SOFT_CLASS[sh]
                                      : missingPast
                                        ? "border-orange-400/60 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                        : "border-[var(--app-border)] text-faint"
                                  }`}
                                >
                                  {covered ? sh : "·"}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {data.persons.map((p) => (
                          <ShiftLettersCell
                            key={p.person}
                            cell={row.byPerson?.[p.person]}
                            day={row}
                            person={p.person}
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

        {/* Day Shift Audit Breakdown Panel */}
        <aside className="rounded-2xl border border-app bg-surface p-4 shadow-[var(--app-shadow)] lg:sticky lg:top-20 space-y-3.5">
          {activeDay ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-app">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-800 dark:text-[var(--app-text)] tabular-nums">
                      {activeDay.dateLabel}
                    </h3>
                    <span className="text-xs font-semibold uppercase text-muted">
                      {activeDay.weekday}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 tabular-nums">
                    {activeDay.coveredShifts?.length ?? 0}/3 shifts covered ·{" "}
                    {activeDay.totalEntries ?? 0} total entries
                  </p>
                </div>
                <Link
                  href={`/history?date=${activeDay.ymd}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-app text-[#059669] dark:text-emerald-400 hover:bg-surface-2 transition-colors shrink-0"
                >
                  History
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5">
                {SHIFT_IDS.map((sh) => {
                  const rank = activeDay[sh];
                  const counts = activeDay.breakdown?.[sh] || {};
                  const entries = Object.entries(counts).sort(
                    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
                  );
                  const maxShiftEntries = entries[0]?.[1] || 1;
                  const missingPast = activeDay.missingShifts?.includes(sh);
                  const isUpcoming = activeDay.upcomingShifts?.includes(sh);

                  return (
                    <div
                      key={sh}
                      className={`rounded-xl border border-app bg-surface-2/40 p-3 ${SHIFT_CARD_ACCENT[sh]}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <ShiftTag shift={sh} />
                          <span className="text-[11px] font-mono text-muted">
                            {SHIFT_META[sh].hours}h
                          </span>
                        </div>
                        {rank?.isTie ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Tied · 0.5 each
                          </span>
                        ) : rank?.person ? (
                          <span className="text-[11px] font-semibold text-zinc-800 dark:text-[var(--app-text)]">
                            {rank.person}
                          </span>
                        ) : missingPast ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                            Uncovered
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-muted">
                            Upcoming
                          </span>
                        )}
                      </div>

                      {entries.length === 0 ? (
                        <p className="text-xs text-muted">
                          {isUpcoming
                            ? "Shift window has not started yet."
                            : "No attributed calculation entries logged."}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {entries.map(([op, count]) => {
                            const isWinner = rank?.winners?.includes(op);
                            const pct = Math.max(
                              12,
                              Math.round((count / maxShiftEntries) * 100)
                            );
                            return (
                              <div key={op} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span
                                    className={
                                      isWinner
                                        ? "font-bold text-zinc-800 dark:text-[var(--app-text)]"
                                        : "text-muted"
                                    }
                                  >
                                    {op}
                                    {isWinner && rank.isTie ? " (tie)" : ""}
                                  </span>
                                  <span className="font-mono font-semibold text-secondary tabular-nums">
                                    {count} entr{count === 1 ? "y" : "ies"}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      sh === "A"
                                        ? "bg-blue-500"
                                        : sh === "B"
                                          ? "bg-orange-500"
                                          : "bg-[#059669] dark:bg-emerald-400"
                                    } ${isWinner ? "opacity-100" : "opacity-45"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeDay.unattributedEntries > 0 ? (
                <p className="text-[11px] text-orange-600 dark:text-amber-300 border-t border-app pt-2.5">
                  {activeDay.unattributedEntries} pre-auth unattributed record
                  {activeDay.unattributedEntries === 1 ? "" : "s"} excluded on{" "}
                  {activeDay.dateLabel}.
                </p>
              ) : null}
            </>
          ) : (
            <div className="py-10 text-center text-xs text-muted">
              Select a day row to inspect operator counts per shift.
            </div>
          )}
        </aside>
      </div>

      {/* Monthly leaderboard */}
      {data?.leaderboard?.length ? (
        <section className="rounded-2xl border border-app bg-surface p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-zinc-800 dark:text-[var(--app-text)] uppercase tracking-wider">
                Month Leaderboard · Weighted Duty Shifts
              </h2>
            </div>
            <span className="text-xs text-muted font-mono">
              {data.leaderboard.length} active operator
              {data.leaderboard.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.leaderboard.slice(0, 12).map((row, i) => {
              const barPct = Math.max(
                8,
                Math.round(((row.shifts || 0) / maxLeaderboardShifts) * 100)
              );
              return (
                <div
                  key={row.person}
                  className="rounded-xl border border-app bg-surface-2/40 px-3.5 py-2.5 space-y-1.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#059669]/10 dark:bg-emerald-500/12 border border-[#059669]/25 dark:border-emerald-400/30 flex items-center justify-center text-xs font-bold text-[#059669] dark:text-emerald-400 font-mono shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-800 dark:text-[var(--app-text)] truncate">
                        {row.person}
                      </p>
                      <p className="text-[11px] text-muted font-mono tabular-nums">
                        {formatShiftCount(row.shifts)} duty shift
                        {row.shifts === 1 ? "" : "s"} · {row.entries} entries
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#059669] dark:bg-emerald-400"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-faint mt-3">
            Ranked by duty shifts won (tied shifts split equally by{" "}
            <span className="font-mono">1/n</span>) · {data.classified} attributed
            records classified
            {data.unattributed
              ? ` · ${data.unattributed} legacy unattributed records excluded`
              : ""}
            {data.skipped
              ? ` · ${data.skipped} outside month / missing timestamp`
              : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}
