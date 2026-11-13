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
    neutral: "bg-surface-2 dark:bg-surface-3/80 border-app text-app",
    slate: "bg-purple-500/10 dark:bg-purple-950/50 border-purple-500/30 text-purple-800 dark:text-purple-200",
    danger: "bg-rose-500/10 dark:bg-rose-950/70 border-rose-500/30 text-rose-800 dark:text-rose-200",
    ok: "bg-emerald-500/10 dark:bg-emerald-950/70 border-emerald-500/35 text-emerald-800 dark:text-emerald-200",
    warn: "bg-amber-500/10 dark:bg-amber-950/70 border-amber-500/30 text-amber-800 dark:text-amber-200",
    accent: "bg-sky-500/10 dark:bg-sky-950/60 border-sky-500/30 text-sky-800 dark:text-sky-200",
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
