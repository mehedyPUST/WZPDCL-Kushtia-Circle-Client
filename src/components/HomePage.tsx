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

const FEATURES = [
  {
    href: "/calculator",
    title: "Load Calculator",
    desc: "Compute feeder MW from bus voltages and amperes. Save readings with hourly time slots.",
    step: "01",
    icon: Calculator,
    highlight: "Real-time MW calculation",
  },
  {
    href: "/kushtia-district-load",
    title: "Kushtia District Load",
    desc: "24-Hour operational day matrix (23:00 → 22:00) tracking Bottail & Bheramara SS consumption, LS, and net district demand.",
    step: "02",
    icon: MapPin,
    highlight: "Daily District Demand & LS",
  },
  {
    href: "/circle-load",
    title: "Circle Load Overview",
    desc: "Multi-substation grid monitoring across Kushtia Circle with Bottail auto-sync.",
    step: "03",
    icon: CircleDot,
    highlight: "Grid Circle Substation Sheet",
  },
  {
    href: "/loadshed",
    title: "Load Shed Entry",
    desc: "Record LS per feeder and time slot. Set grid allotment; auto-distribute shortage proportionally.",
    step: "04",
    icon: Zap,
    highlight: "Proportional shed planner",
  },
  {
    href: "/manual",
    title: "Manual Entry",
    desc: "Fill empty hourly slots by date. Enter Amps or MW; the other is calculated automatically.",
    step: "05",
    icon: ClipboardEdit,
    authOnly: true,
    highlight: "Bi-directional slot fill",
  },
  {
    href: "/history",
    title: "History & Logs",
    desc: "Search and manage saved calculations. Soft-delete, restore, edit, and export records.",
    step: "06",
    icon: History,
    highlight: "Search & soft-delete",
  },
  {
    href: "/max-load",
    title: "Max Load Analysis",
    desc: "Top five monthly peaks per feeder, prioritising hourly and special-slot saves.",
    step: "07",
    icon: TrendingUp,
    highlight: "5-Peak monthly ranking",
  },
  {
    href: "/statistics",
    title: "Station Statistics",
    desc: "Aggregate averages, station peak total, and per-feeder mean load from recent data.",
    step: "08",
    icon: BarChart3,
    highlight: "Substation analytics",
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
    transition: { duration: 0.35, ease: "easeOut" },
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
          className="relative w-full h-[240px] sm:h-[300px] md:h-[360px] lg:h-[400px] overflow-hidden bg-slate-950"
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
          <div className="hero-bottom-fade absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090e17] to-transparent" />

          {/* Hero Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 mb-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
                  <p className="text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-400 font-mono">
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
                  className="mt-1 text-sm sm:text-base text-slate-300 font-medium"
                >
                  33/11 kV Substation · SBA-Bottail
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg hidden sm:block"
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
                    className="btn-primary inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Calculator className="w-4 h-4" />
                    Open Calculator
                  </Link>
                  <Link
                    href="/max-load"
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md text-white text-xs sm:text-sm font-medium hover:bg-white/15 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Max Load Report
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Substation Telemetry Banner Strip */}
        <div className="w-full bg-surface-2 border-y border-app px-4 sm:px-6 lg:px-8 py-3">
          <div className="w-full max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-secondary">
              <Activity className="w-4 h-4 text-accent" />
              <span className="font-semibold text-app">System Status:</span>
              <span className="text-accent font-mono font-medium">Nominal / Online</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Bus Configuration:</span>
              <span className="text-app font-mono font-semibold">BUS-1 &amp; BUS-2</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Power Factor:</span>
              <span className="text-app font-mono font-semibold">0.95 Standard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid */}
      <section className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
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
            return (
              <motion.div key={f.href} variants={cardVariants}>
                <Link
                  href={f.href}
                  className="module-card group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="module-card-icon group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-mono font-bold text-faint">
                      {f.step}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-app group-hover:text-accent transition-colors tracking-tight">
                    {f.title}
                  </h3>

                  <p className="mt-2 text-[13px] text-muted leading-relaxed flex-1">
                    {f.desc}
                  </p>

                  <div className="mt-5 pt-3 border-t border-app flex items-center justify-between text-xs">
                    <span className="text-[11px] font-mono text-accent/80">
                      {f.highlight}
                    </span>
                    <span className="font-semibold text-accent inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-app text-[13px] font-medium text-app hover:border-accent transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {f.name}
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${f.bus === 1
                    ? "bg-sky-950/80 text-sky-300 border border-sky-800/60"
                    : "bg-violet-950/80 text-violet-300 border border-violet-800/60"
                    }`}
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
