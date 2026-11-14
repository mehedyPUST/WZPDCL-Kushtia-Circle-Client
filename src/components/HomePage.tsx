"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Calculator,
  Zap,
  ClipboardEdit,
  History,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Activity,
  Layers,
  Cpu,
  MapPin,
  CircleDot,
} from "lucide-react";
import { FEEDERS } from "@/lib/constants";
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
  step: string;
  icon: typeof Calculator;
  authOnly?: boolean;
  highlight: string;
  tone: ModuleTone;
}[] = [
  {
    href: "/dashboard",
    title: "My Dashboard",
    desc: "Your personal action centre — recent saves, role summary, quick tools, and manage your own records.",
    step: "00",
    icon: Activity,
    authOnly: true,
    highlight: "Personal activity hub",
    tone: "teal",
  },
  {
    href: "/calculator",
    title: "Load Calculator",
    desc: "Compute feeder MW from bus voltages and amperes. Save readings with hourly time slots.",
    step: "01",
    icon: Calculator,
    highlight: "Real-time MW calculation",
    tone: "emerald",
  },
  {
    href: "/kushtia-district-load",
    title: "Kushtia District Load",
    desc: "24-Hour operational day matrix (23:00 → 22:00) tracking Bottail & Bheramara SS consumption, LS, and net district demand.",
    step: "02",
    icon: MapPin,
    highlight: "Daily District Demand & LS",
    tone: "sky",
  },
  {
    href: "/circle-load",
    title: "Circle Load Overview",
    desc: "Multi-substation grid monitoring across Kushtia Circle with Bottail auto-sync.",
    step: "03",
    icon: CircleDot,
    highlight: "Grid Circle Substation Sheet",
    tone: "teal",
  },
  {
    href: "/loadshed",
    title: "Load Shed Entry",
    desc: "Record LS per feeder and time slot. Set grid allotment; auto-distribute shortage proportionally.",
    step: "04",
    icon: Zap,
    highlight: "Proportional shed planner",
    tone: "rose",
  },
  {
    href: "/manual-input",
    title: "Manual Entry",
    desc: "Fill empty hourly slots by date. Enter Amps or MW; the other is calculated automatically.",
    step: "05",
    icon: ClipboardEdit,
    authOnly: true,
    highlight: "Bi-directional slot fill",
    tone: "amber",
  },
  {
    href: "/history",
    title: "History & Logs",
    desc: "Search and manage saved calculations. Soft-delete, restore, edit, and export records.",
    step: "06",
    icon: History,
    highlight: "Search & soft-delete",
    tone: "purple",
  },
  {
    href: "/max-load",
    title: "Max Load Analysis",
    desc: "Top five monthly peaks per feeder, prioritising hourly and special-slot saves.",
    step: "07",
    icon: TrendingUp,
    highlight: "5-Peak monthly ranking",
    tone: "amber",
  },
  {
    href: "/statistics",
    title: "Station Statistics",
    desc: "Aggregate averages, station peak total, and per-feeder mean load from recent data.",
    step: "08",
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
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const modules = FEATURES.filter((f) => !f.authOnly || isAuthenticated);

  return (
    <div className="w-full">
      {/* Professional Hero Section */}
      <section className="relative border-b border-app overflow-hidden">
        <div
          data-keep-dark="true"
          className="relative w-full h-[240px] sm:h-[300px] md:h-[360px] lg:h-[400px] overflow-hidden bg-app"
        >
          <img
            src="/hero-banner.jpg"
            alt="Bottail–Kushtia 33/11 kV Substation"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center brightness-90"
          />
          {/* High-legibility gradient scrim */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(8,13,23,0.95) 0%, rgba(8,13,23,0.82) 42%, rgba(8,13,23,0.45) 75%, rgba(8,13,23,0.2) 100%)",
            }}
          />
          <div className="hero-bottom-fade absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--app-bg)] to-transparent" />

          {/* Hero Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full max-w-none px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 mb-2.5"
                >
                  <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.16em] text-[#93c5fd] font-mono">
                    West Zone Power Distribution Co. Ltd.
                  </p>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.12]"
                >
                  Bottail–Kushtia
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="mt-1 text-sm sm:text-base text-white/90 font-medium"
                >
                  33/11 kV Substation · SBA-Bottail
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="mt-3 text-xs sm:text-sm text-white/75 leading-relaxed max-w-lg hidden sm:block"
                >
                  High-precision electrical load calculations, hourly logsheet records,
                  peak feeder analysis, and district intelligence in one workspace.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3"
                >
                  <Link
                    href="/calculator"
                    className="btn-primary inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-black/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Calculator className="w-4 h-4" />
                    Open Calculator
                  </Link>
                  <Link
                    href="/max-load"
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl border border-white/35 bg-white/12 backdrop-blur-md text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <TrendingUp className="w-4 h-4 text-sky-300" />
                    Max Load Report
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Substation Telemetry Banner Strip */}
        <div className="home-telemetry w-full bg-surface-2 border-y border-app px-4 sm:px-6 lg:px-8 py-3">
          <div className="w-full max-w-none flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-secondary">
              <Activity className="w-4 h-4 text-success" />
              <span className="font-semibold text-app">System Status:</span>
              <span className="text-success font-mono font-medium">Nominal / Online</span>
            </div>
            <div className="flex items-center gap-2 text-secondary">
              <Layers className="w-4 h-4 text-info" />
              <span>Bus Configuration:</span>
              <span className="text-app font-mono font-semibold">BUS-1 &amp; BUS-2</span>
            </div>
            <div className="flex items-center gap-2 text-secondary">
              <Cpu className="w-4 h-4 text-warning" />
              <span>Power Factor:</span>
              <span className="text-app font-mono font-semibold">0.95 Standard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="home-modules-section w-full max-w-none px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <p className="section-kicker mb-1.5">
            Operations &amp; Control
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-app tracking-tight font-display">
            System Modules
          </h2>
          <p className="text-sm text-muted mt-1 max-w-xl leading-relaxed">
            Select a module below to calculate, review historical logs, or generate
            reports. Operators must sign in to save records to the database.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {modules.map((f) => {
            const Icon = f.icon;
            const tone = MODULE_TONES[f.tone];
            return (
              <motion.div key={f.href} variants={cardVariants}>
                <Link
                  href={f.href}
                  className={`module-card group !bg-none !bg-gradient-to-br ${tone.card}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border group-hover:scale-105 transition-transform ${tone.icon}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-bold text-faint">
                      {f.step}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-app transition-colors tracking-tight">
                    {f.title}
                  </h3>

                  <p className="mt-2 text-[13px] text-muted leading-relaxed flex-1">
                    {f.desc}
                  </p>

                  <div className={`mt-5 pt-3 border-t ${tone.divider} flex items-center justify-between text-xs`}>
                    <span className={`text-[11px] font-mono font-semibold ${tone.accent}`}>
                      {f.highlight}
                    </span>
                    <span className={`font-semibold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform ${tone.accent}`}>
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Feeder Configuration Strip */}
      <section className="border-t border-app bg-surface/70 backdrop-blur-sm">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-kicker">
              Monitored Feeders · Bottail SS (9 Lines)
            </h2>
            <span className="text-[11px] text-muted">
              Formula: (√3 × V_kV × PF × I_A) / 1000
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEEDERS.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-app text-[13px] font-medium text-app hover:border-accent transition-colors shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {f.name}
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${f.bus === 1 ? "bg-bus-1-soft text-bus-1 border-bus-1" : "bg-bus-2-soft text-bus-2 border-bus-2" }`}
                >
                  BUS-{f.bus}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
