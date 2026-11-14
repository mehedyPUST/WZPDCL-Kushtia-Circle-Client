"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  CircleDot,
  ClipboardEdit,
  Clock3,
  History,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Moon,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  BOTTAIL_11KV_IDS,
  FEEDERS,
  feederAllowsRing,
  POWER_FACTOR,
} from "@/lib/constants";
import { dhakaNowParts, SHIFT_META, shiftFromHour, type ShiftId } from "@/lib/dutyShifts";
import { useAuth } from "@/hooks/useAuth";

const MODULE_TONES = {
  teal: {
    card: "bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 hover:border-emerald-400 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 dark:hover:border-teal-400/50",
    icon: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-500/30",
    accent: "text-emerald-700 dark:text-teal-300",
    divider: "border-emerald-200/70 dark:border-teal-500/20",
  },
  sky: {
    card: "bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border-blue-200 hover:border-blue-400 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25 dark:hover:border-sky-400/50",
    icon: "bg-blue-100/80 text-blue-700 border-blue-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-500/30",
    accent: "text-blue-700 dark:text-sky-300",
    divider: "border-blue-200/70 dark:border-sky-500/20",
  },
  amber: {
    card: "bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200 hover:border-orange-400 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 dark:hover:border-amber-400/50",
    icon: "bg-orange-100/80 text-orange-700 border-orange-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-500/30",
    accent: "text-orange-700 dark:text-amber-300",
    divider: "border-orange-200/70 dark:border-amber-500/20",
  },
  emerald: {
    card: "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200 hover:border-emerald-400 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-emerald-500/25 dark:hover:border-emerald-400/50",
    icon: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-500/30",
    accent: "text-emerald-700 dark:text-emerald-300",
    divider: "border-emerald-200/70 dark:border-emerald-500/20",
  },
  purple: {
    card: "bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border-purple-200 hover:border-purple-400 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-purple-500/25 dark:hover:border-purple-400/50",
    icon: "bg-purple-100/80 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-500/30",
    accent: "text-purple-700 dark:text-purple-300",
    divider: "border-purple-200/70 dark:border-purple-500/20",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40 border-rose-200 hover:border-rose-400 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-rose-500/25 dark:hover:border-rose-400/50",
    icon: "bg-rose-100/80 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-500/30",
    accent: "text-rose-700 dark:text-rose-300",
    divider: "border-rose-200/70 dark:border-rose-500/20",
  },
} as const;

type ModuleTone = keyof typeof MODULE_TONES;

const FEATURES: {
  href: string;
  title: string;
  desc: string;
  icon: typeof Calculator;
  authOnly?: boolean;
  writeOnly?: boolean;
  highlight: string;
  tone: ModuleTone;
}[] = [
    {
      href: "/dashboard",
      title: "Operator Dashboard",
      desc: "Personal shift summary, recent feeder entries, role permissions, and account controls.",
      icon: LayoutDashboard,
      authOnly: true,
      highlight: "Personal command hub",
      tone: "teal",
    },
    {
      href: "/station-notes",
      title: "Station Notes",
      desc: "Leave handover directives, review read receipts, acknowledge alerts, and forward unresolved notes.",
      icon: MessageSquare,
      authOnly: true,
      highlight: "Shift handover log",
      tone: "sky",
    },
    {
      href: "/calculator",
      title: "Load Calculator",
      desc: "Compute feeder MW from BUS-1 / BUS-2 kV voltages and line amperes with hourly slot logging.",
      icon: Calculator,
      highlight: "Real-time MW calculation",
      tone: "emerald",
    },
    {
      href: "/kushtia-district-load",
      title: "District Load",
      desc: "24-hour operational matrix (23:00 → 22:00) tracking Bottail & Bheramara SS demand and load shed.",
      icon: MapPin,
      highlight: "District demand matrix",
      tone: "sky",
    },
    {
      href: "/circle-load",
      title: "Circle Load Overview",
      desc: "Multi-substation grid sheet across Kushtia Circle with automatic Bottail telemetry sync.",
      icon: CircleDot,
      highlight: "Circle substation sheet",
      tone: "teal",
    },
    {
      href: "/loadshed",
      title: "Load Shed Entry",
      desc: "Record shed MW per feeder slot or enter grid allotment to distribute shortages proportionally.",
      icon: Zap,
      writeOnly: true,
      highlight: "Proportional shed planner",
      tone: "rose",
    },
    {
      href: "/manual-input",
      title: "Manual Entry",
      desc: "Backfill missed hourly logsheet slots by date with automatic bi-directional Amps and MW sync.",
      icon: ClipboardEdit,
      writeOnly: true,
      highlight: "Bi-directional slot fill",
      tone: "amber",
    },
    {
      href: "/night-logs",
      title: "Night Logs",
      desc: "Generate structured overnight logsheets and verify hourly C-shift continuity records.",
      icon: Moon,
      writeOnly: true,
      highlight: "Overnight sheet builder",
      tone: "purple",
    },
    {
      href: "/history",
      title: "History & Logs",
      desc: "Search saved hourly calculations, inspect bus totals, edit readings, and manage soft-deleted rows.",
      icon: History,
      highlight: "Audit & record archive",
      tone: "purple",
    },
    {
      href: "/max-load",
      title: "Max Load Analysis",
      desc: "Top five monthly peak demands per feeder, prioritizing regular hourly and special-slot saves.",
      icon: TrendingUp,
      highlight: "5-peak monthly ranking",
      tone: "amber",
    },
    {
      href: "/statistics",
      title: "Station Statistics",
      desc: "Aggregate averages, peak station totals, and per-feeder load distribution charts.",
      icon: BarChart3,
      highlight: "Substation analytics",
      tone: "sky",
    },
  ];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const },
  },
};

function feederCategory(id: number): string {
  if (id === 1 || id === 2) return "Industrial 33 kV";
  if (BOTTAIL_11KV_IDS.includes(id)) return "11 kV Transformer";
  return "33 kV Outgoing";
}

export default function HomePage() {
  const { isAuthenticated, canWrite } = useAuth();
  const [activeShiftId, setActiveShiftId] = useState<ShiftId | null>(null);
  const [dhakaTime, setDhakaTime] = useState<string>("");

  useEffect(() => {
    const updateShiftClock = () => {
      const parts = dhakaNowParts();
      setActiveShiftId(shiftFromHour(parts.hour));
      setDhakaTime(
        `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} BST`
      );
    };
    updateShiftClock();
    const id = window.setInterval(updateShiftClock, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const modules = FEATURES.filter((f) => {
    if (f.writeOnly && !(isAuthenticated && canWrite)) return false;
    if (f.authOnly && !isAuthenticated) return false;
    return true;
  });

  const bus1Feeders = FEEDERS.filter((f) => f.bus === 1);
  const bus2Feeders = FEEDERS.filter((f) => f.bus === 2);
  const activeShiftMeta = activeShiftId ? SHIFT_META[activeShiftId] : null;

  return (
    <div className="w-full min-w-0">
      {/* Executive Substation Hero */}
      <section className="relative border-b border-app overflow-hidden">
        <div
          data-keep-dark="true"
          className="relative w-full min-h-[300px] lg:min-h-[360px] overflow-hidden bg-[#070d18]"
        >
          <img
            src="/hero-banner.jpg"
            alt="Bottail–Kushtia 33/11 kV Substation switchyard"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-75"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(7,13,24,0.96) 0%, rgba(7,13,24,0.88) 48%, rgba(7,13,24,0.72) 100%)",
            }}
          />

          <div className="relative z-10 w-full max-w-none px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Left Headline & Actions */}
              <div className="lg:col-span-7 max-w-2xl">
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs font-mono font-semibold text-[#93c5fd] tracking-wide mb-2.5"
                >
                  West Zone Power Distribution Co. Ltd. · S&amp;D Division-1, Kushtia
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.04 }}
                  className="text-2xl sm:text-4xl lg:text-[2.65rem] font-bold text-white tracking-tight leading-[1.12] [text-wrap:balance]"
                >
                  Bottail–Kushtia 33/11 kV Substation
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.28, delay: 0.08 }}
                  className="mt-3 text-sm sm:text-base text-[#e2e8f0] leading-relaxed max-w-xl"
                >
                  Operational workspace for hourly feeder MW calculations, load-shed
                  allotment, Kushtia Circle reporting, and verified shift handover logs.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.12 }}
                  className="mt-6 flex flex-wrap items-center gap-3"
                >
                  <Link
                    href="/calculator"
                    className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-black/25 transition-transform hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap"
                  >
                    <Calculator className="w-4 h-4 shrink-0" />
                    Open Calculator
                  </Link>
                  <Link
                    href={isAuthenticated ? "/station-notes" : "/max-load"}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#ffffff]/25 bg-[#121e33]/85 backdrop-blur-md text-white text-xs sm:text-sm font-semibold hover:bg-[#1a2944] transition-colors whitespace-nowrap"
                  >
                    {isAuthenticated ? (
                      <>
                        <MessageSquare className="w-4 h-4 text-[#5eead4] shrink-0" />
                        Station Notes
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-[#93c5fd] shrink-0" />
                        Max Load Report
                      </>
                    )}
                  </Link>
                </motion.div>
              </div>

              {/* Right Operational Specification Panel */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="lg:col-span-5"
              >
                <div className="rounded-2xl border border-[#ffffff]/15 bg-[#0b1322]/90 backdrop-blur-md p-4 sm:p-5 shadow-xl">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#ffffff]/10">
                    <div>
                      <p className="text-xs font-semibold text-[#5eead4]">
                        Substation Operations Brief
                      </p>
                      <p className="text-[11px] text-[#cbd5e1] mt-0.5">
                        SBA-Bottail · Asia/Dhaka Clock
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-white tabular-nums">
                      <Clock3 className="w-3.5 h-3.5 text-[#5eead4] shrink-0" />
                      {dhakaTime || "BST"}
                    </span>
                  </div>

                  <dl className="divide-y divide-[#ffffff]/10 text-xs mt-1">
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="text-[#cbd5e1]">Active Duty Shift</dt>
                      <dd className="font-semibold text-white font-mono tabular-nums text-right">
                        {activeShiftMeta
                          ? `${activeShiftMeta.label} (${activeShiftMeta.window})`
                          : "A / B / C Rotation"}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="text-[#cbd5e1]">Bus Configuration</dt>
                      <dd className="font-semibold text-white font-mono tabular-nums text-right">
                        BUS-1 ({bus1Feeders.length}) · BUS-2 ({bus2Feeders.length})
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="text-[#cbd5e1]">Shift Handover Cutoffs</dt>
                      <dd className="font-semibold text-[#fcd34d] font-mono tabular-nums text-right">
                        08:30 · 14:30 · 20:30 BST
                      </dd>
                    </div>
                    <div className="pt-2.5 flex items-center justify-between gap-3">
                      <dt className="text-[#cbd5e1]">MW Conversion Formula</dt>
                      <dd className="font-semibold text-[#93c5fd] font-mono tabular-nums text-right">
                        (√3 × V × {POWER_FACTOR} × I) / 1000
                      </dd>
                    </div>
                  </dl>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Workspace */}
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* 4-Column Substation Specification Cards (Station Notes Palette) */}
        <section aria-label="Substation baseline parameters" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700 dark:text-teal-300">
              Voltage Class
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-app font-mono tabular-nums tracking-tight">
              33 / 11 kV
            </p>
            <p className="text-xs text-muted mt-0.5">
              Dual-bus substation architecture
            </p>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-blue-700 dark:text-sky-300">
              Monitored Feeders
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-app font-mono tabular-nums tracking-tight">
              {FEEDERS.length} Lines
            </p>
            <p className="text-xs text-muted mt-0.5">
              7 × 33 kV feeders + H-3 &amp; T-3 TX
            </p>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border-purple-200 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-purple-500/25 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Shift Cycle
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-app font-mono tabular-nums tracking-tight">
              3 Shifts
            </p>
            <p className="text-xs text-muted mt-0.5">
              A, B &amp; C continuous duty coverage
            </p>
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-orange-700 dark:text-amber-300">
              Power Factor Basis
            </p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-app font-mono tabular-nums tracking-tight">
              {POWER_FACTOR.toFixed(2)} PF
            </p>
            <p className="text-xs text-muted mt-0.5">
              Standard WZPDCL feeder constant
            </p>
          </div>
        </section>

        {/* System Modules Grid */}
        <section aria-labelledby="home-modules-heading">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-teal-300 mb-1">
                Operations &amp; Control
              </p>
              <h2
                id="home-modules-heading"
                className="text-xl sm:text-2xl font-bold text-app tracking-tight font-display"
              >
                System Modules
              </h2>
              <p className="text-sm text-muted mt-1 max-w-2xl leading-relaxed">
                Select an operational workspace to calculate feeder loads, inspect historical logsheets, or coordinate shift handovers.
              </p>
            </div>
            <p className="text-xs font-mono tabular-nums text-muted shrink-0">
              {modules.length} {modules.length === 1 ? "module" : "modules"} available
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {modules.map((f, idx) => {
              const Icon = f.icon;
              const tone = MODULE_TONES[f.tone];
              const stepNum = String(idx + 1).padStart(2, "0");
              return (
                <motion.div key={f.href} variants={cardVariants}>
                  <Link
                    href={f.href}
                    className={`module-card group !bg-none !bg-gradient-to-br ${tone.card}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border group-hover:scale-105 transition-transform ${tone.icon}`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-mono font-bold text-faint tabular-nums">
                        {stepNum}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-app transition-colors tracking-tight">
                      {f.title}
                    </h3>

                    <p className="mt-2 text-[13px] text-muted leading-relaxed flex-1">
                      {f.desc}
                    </p>

                    <div
                      className={`mt-5 pt-3 border-t ${tone.divider} flex items-center justify-between gap-2 text-xs`}
                    >
                      <span className={`text-xs font-medium ${tone.accent} truncate`}>
                        {f.highlight}
                      </span>
                      <span
                        className={`font-semibold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0 whitespace-nowrap ${tone.accent}`}
                      >
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Structured Feeder Topology Schedule (Bus-1 & Bus-2) */}
        <section aria-labelledby="feeder-topology-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-teal-300 mb-1">
                Substation Switchyard Schedule
              </p>
              <h2
                id="feeder-topology-heading"
                className="text-lg sm:text-xl font-bold text-app tracking-tight font-display"
              >
                Monitored Feeders · Bottail SS
              </h2>
            </div>
            <p className="text-xs text-muted font-mono tabular-nums">
              {FEEDERS.length} active lines · BUS-1 &amp; BUS-2 metering
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* BUS-1 Schedule Card */}
            <div className="rounded-xl border bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 border-blue-200 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-sky-500/25 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-blue-200/80 dark:border-sky-500/20 bg-blue-50/75 dark:bg-sky-950/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-700 dark:text-sky-300 shrink-0" />
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-sky-200">
                    BUS-1 Metering Group
                  </h3>
                </div>
                <span className="text-xs font-mono tabular-nums text-blue-700 dark:text-sky-300 font-semibold">
                  {bus1Feeders.length} Feeders
                </span>
              </div>
              <div className="divide-y divide-blue-200/60 dark:divide-sky-500/15">
                {bus1Feeders.map((f) => (
                  <div
                    key={f.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-blue-700 dark:text-sky-300 tabular-nums w-6 shrink-0">
                        {String(f.id).padStart(2, "0")}
                      </span>
                      <span className="font-semibold text-app truncate">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted shrink-0">
                      <span>{feederCategory(f.id)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {feederAllowsRing(f.id) ? "Ring-capable" : "Radial"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BUS-2 Schedule Card */}
            <div className="rounded-xl border bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-orange-200/80 dark:border-amber-500/20 bg-orange-50/75 dark:bg-amber-950/35 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-700 dark:text-amber-300 shrink-0" />
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-amber-200">
                    BUS-2 Metering Group
                  </h3>
                </div>
                <span className="text-xs font-mono tabular-nums text-orange-700 dark:text-amber-300 font-semibold">
                  {bus2Feeders.length} Feeders
                </span>
              </div>
              <div className="divide-y divide-orange-200/60 dark:divide-amber-500/15">
                {bus2Feeders.map((f) => (
                  <div
                    key={f.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-orange-700 dark:text-amber-300 tabular-nums w-6 shrink-0">
                        {String(f.id).padStart(2, "0")}
                      </span>
                      <span className="font-semibold text-app truncate">
                        {f.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted shrink-0">
                      <span>{feederCategory(f.id)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">
                        {feederAllowsRing(f.id) ? "Ring-capable" : "Radial"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
