"use client";

function Metric({
  label,
  value,
  unit,
  tone = "neutral",
  landscape = false,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
  landscape?: boolean;
}) {
  const tones = {
    neutral: "bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] border-emerald-200 dark:border-teal-500/25 text-app",
    slate: "bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 dark:from-purple-950/50 dark:via-[#0f1726] dark:to-[#0f1726] border-purple-200 dark:border-purple-500/25 text-purple-800 dark:text-purple-200",
    danger: "bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-[#0f1726] border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-200",
    ok: "bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/55 dark:via-[#0f1726] dark:to-[#0f1726] border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-200",
    warn: "bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] border-orange-200 dark:border-amber-500/25 text-orange-800 dark:text-amber-200",
    accent: "bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 dark:from-sky-950/50 dark:via-[#0f1726] dark:to-[#0f1726] border-blue-200 dark:border-sky-500/25 text-blue-800 dark:text-sky-200",
  };
  return (
    <div
      className={`rounded-lg border flex flex-col items-center justify-center px-2 shadow-xs ${tones[tone]} ${landscape ? "h-11 min-w-[6.25rem]" : ""}`}
      style={landscape ? undefined : { height: "var(--calc-badge-h)", minHeight: "1.75rem" }}
    >
      <span
        className={`font-semibold uppercase tracking-wide opacity-85 leading-none ${landscape ? "text-[10px]" : "text-[10px]"}`}
        style={landscape ? undefined : { fontSize: "var(--calc-badge-label)" }}
      >
        {label}
      </span>
      <span
        className={`font-black font-mono tabular-nums leading-tight ${landscape ? "text-sm sm:text-base mt-0.5" : ""}`}
        style={landscape ? undefined : { fontSize: "var(--calc-badge-text)" }}
      >
        {value}
        {unit ? (
          <span
            className={`opacity-75 ml-0.5 font-bold ${landscape ? "text-[11px]" : ""}`}
            style={landscape ? undefined : { fontSize: "var(--calc-badge-label)" }}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Compact metrics strip in portrait; 4-column KPI bar in landscape dock */
export default function LoadShedPanel({
  plan,
  calculated,
  layout = "portrait",
}: {
  plan: any;
  calculated: boolean;
  layout?: "portrait" | "landscape";
}) {
  const hasPlan = calculated && plan?.valid;
  const isLandscape = layout === "landscape";

  if (!hasPlan) {
    if (!isLandscape) return null;
    return (
      <p className="text-xs text-muted">
        Enter allotment MW and feeder amps, then click{" "}
        <span className="font-semibold text-warning">Calculate LS</span>.
      </p>
    );
  }

  const over = plan.needsShed;
  const protectedMW = plan.protectedMW ?? 0;
  const available = Math.max(0, (plan.allotment ?? 0) - protectedMW);

  if (isLandscape) {
    return (
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Metric landscape label="Running" value={(Math.round((plan.totalMW + Number.EPSILON) * 10) / 10).toFixed(1)} unit="MW" tone="neutral" />
        <Metric
          landscape
          label="Cur LS"
          value={(Math.round(((plan.totalCurrentLsMW ?? 0) + Number.EPSILON) * 10) / 10).toFixed(1)}
          unit="MW"
          tone="slate"
        />
        <Metric
          landscape
          label="For others"
          value={(Math.round((available + Number.EPSILON) * 10) / 10).toFixed(1)}
          unit="MW"
          tone="accent"
        />
        <Metric
          landscape
          label="More LS"
          value={over ? (Math.round((plan.shedTotalMW + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0"}
          unit="MW"
          tone={over ? "danger" : "ok"}
        />
      </section>
    );
  }

  return (
    <section
      className="border-b border-app bg-surface-2/60 dark:bg-surface/70"
      style={{
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        paddingTop: "calc(var(--calc-gap) * 0.7)",
        paddingBottom: "calc(var(--calc-gap) * 0.7)",
      }}
    >
      <div className="grid grid-cols-4" style={{ gap: "var(--calc-gap)" }}>
        <Metric label="Running" value={(Math.round((plan.totalMW + Number.EPSILON) * 10) / 10).toFixed(1)} unit="MW" tone="neutral" />
        <Metric
          label="Cur LS"
          value={(Math.round(((plan.totalCurrentLsMW ?? 0) + Number.EPSILON) * 10) / 10).toFixed(1)}
          unit="MW"
          tone="slate"
        />
        <Metric
          label="For others"
          value={(Math.round((available + Number.EPSILON) * 10) / 10).toFixed(1)}
          unit="MW"
          tone="accent"
        />
        <Metric
          label="More LS"
          value={over ? (Math.round((plan.shedTotalMW + Number.EPSILON) * 10) / 10).toFixed(1) : "0.0"}
          unit="MW"
          tone={over ? "danger" : "ok"}
        />
      </div>
    </section>
  );
}
