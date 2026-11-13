"use client";

function Metric({ label, value, unit, tone = "neutral" }) {
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
      className={`rounded-lg border flex flex-col items-center justify-center px-1 shadow-xs ${tones[tone]}`}
      style={{ height: "var(--calc-badge-h)", minHeight: "1.75rem" }}
    >
      <span
        className="font-semibold uppercase tracking-wide opacity-85 leading-none text-[10px]"
        style={{ fontSize: "var(--calc-badge-label)" }}
      >
        {label}
      </span>
      <span
        className="font-black font-mono tabular-nums leading-tight"
        style={{ fontSize: "var(--calc-badge-text)" }}
      >
        {value}
        {unit ? (
          <span
            className="opacity-75 ml-0.5 font-bold"
            style={{ fontSize: "var(--calc-badge-label)" }}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Compact metrics strip in portrait; 2x2 KPI grid in landscape rail */
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
  if (!hasPlan) return null;

  const over = plan.needsShed;
  const protectedMW = plan.protectedMW ?? 0;
  const available = Math.max(0, (plan.allotment ?? 0) - protectedMW);
  const isLandscape = layout === "landscape";

  return (
    <section
      className={
        isLandscape
          ? "px-3 py-2.5 border-b border-app bg-surface-2/40"
          : "border-b border-app bg-surface-2/60 dark:bg-surface/70"
      }
      style={
        isLandscape
          ? undefined
          : {
              paddingLeft: "var(--calc-section-px)",
              paddingRight: "var(--calc-section-px)",
              paddingTop: "calc(var(--calc-gap) * 0.7)",
              paddingBottom: "calc(var(--calc-gap) * 0.7)",
            }
      }
    >
      {isLandscape && (
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted font-mono">
            LS Plan Summary
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
              over
                ? "badge-danger"
                : "badge-success"
            }`}
          >
            {over ? "Shed Needed" : "Within Allot"}
          </span>
        </div>
      )}
      <div
        className={`grid ${isLandscape ? "grid-cols-2 gap-2" : "grid-cols-4"}`}
        style={isLandscape ? undefined : { gap: "var(--calc-gap)" }}
      >
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
