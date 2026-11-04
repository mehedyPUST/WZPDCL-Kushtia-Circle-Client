"use client";

import { navigateInputsByArrow } from "@/lib/inputNav";

function Field({
  label,
  value,
  onChange,
  handleWheel,
  handleKeyDown,
  placeholder = "-",
  unit,
  tone = "emerald",
  required = false,
  navRow = 0,
  navCol = 0,
}) {
  const cardCls =
    tone === "amber"
      ? "bg-amber-500/10 dark:bg-amber-950/35 border-amber-500/30 hover:border-amber-500/60"
      : tone === "purple"
        ? "bg-purple-500/10 dark:bg-purple-950/25 border-purple-500/30 hover:border-purple-500/60"
        : tone === "sky"
          ? "bg-sky-500/10 dark:bg-sky-950/25 border-sky-500/30 hover:border-sky-500/60"
          : "bg-surface-2 bg-surface-3/70 border-app hover:border-emerald-500/50";

  const labelCls =
    tone === "amber"
      ? "text-amber-800 dark:text-amber-300"
      : tone === "purple"
        ? "text-purple-800 dark:text-purple-300"
        : tone === "sky"
          ? "text-sky-800 dark:text-sky-300"
          : "text-slate-800 text-secondary";

  const inputCls =
    tone === "amber"
      ? "bg-app border-[var(--app-highlight-border)] text-app focus:ring-[var(--app-highlight)]/35 focus:border-[var(--app-highlight)]"
      : tone === "purple"
        ? "bg-app border-[var(--app-violet-border)] text-app focus:ring-[var(--app-violet)]/35 focus:border-[var(--app-violet)]"
        : tone === "sky"
          ? "bg-app border-[var(--bus-1-border)] text-app focus:ring-[var(--bus-1)]/35 focus:border-[var(--bus-1)]"
          : "bg-app border-app text-app focus:ring-[var(--app-focus-ring)] focus:border-accent";

  return (
    <div
      className={`relative flex items-center justify-between rounded-xl shadow-xs border transition-all duration-200 group ${cardCls}`}
      style={{
        paddingLeft: "0.45rem",
        paddingRight: "0.45rem",
        paddingTop: "calc(var(--calc-bus-py) * 0.45)",
        paddingBottom: "calc(var(--calc-bus-py) * 0.45)",
      }}
    >
      <label
        className={`font-bold tracking-wide mr-1 shrink-0 ${labelCls}`}
        style={{ fontSize: "var(--calc-bus-label)" }}
      >
        {label}
        {required && (
          <span className="text-rose-500 dark:text-rose-400 ml-0.5" title="Mandatory field" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="decimal"
          data-nav="1"
          data-nav-row={navRow}
          data-nav-col={navCol}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          aria-required={required || undefined}
          onWheel={handleWheel}
          onKeyDown={(e) => {
            if (navigateInputsByArrow(e)) return;
            handleKeyDown?.(e);
          }}
          className={`border rounded-md text-center font-bold placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:ring-2 focus:bg-surface transition-all font-mono tabular-nums ${inputCls}`}
          style={{
            width: "calc(var(--calc-bus-h) * 2.1)",
            height: "var(--calc-bus-h)",
            fontSize: "var(--calc-bus-input)",
            paddingRight: unit ? "1.35rem" : "0.25rem",
          }}
          aria-label={label}
        />
        {unit && (
          <span
            className="absolute right-1.5 font-bold text-muted pointer-events-none"
            style={{ fontSize: "calc(var(--calc-bus-label) * 0.9)" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BusVoltagePanel({
  busVoltages,
  onChange,
  handleWheel,
  handleKeyDown,
  mode = "normal",
  allotment = "",
  onAllotmentChange,
}) {
  const isLS = mode === "loadShed";

  return (
    <section
      className="border-b border-app bg-surface-2"
      style={{
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        paddingTop: "var(--calc-bus-py)",
        paddingBottom: "var(--calc-bus-py)",
      }}
    >
      <div
        className={`grid ${isLS ? "grid-cols-3" : "grid-cols-2"}`}
        style={{ gap: "var(--calc-gap)" }}
      >
        <Field
          label="BUS-2"
          value={busVoltages.bus2}
          onChange={(v) => onChange("bus2", v)}
          handleWheel={handleWheel}
          handleKeyDown={handleKeyDown}
          placeholder="-"
          unit="kV"
          tone="purple"
          required
          navRow={-1}
          navCol={0}
        />
        <Field
          label="BUS-1"
          value={busVoltages.bus1}
          onChange={(v) => onChange("bus1", v)}
          handleWheel={handleWheel}
          handleKeyDown={handleKeyDown}
          placeholder="-"
          unit="kV"
          tone="sky"
          required
          navRow={-1}
          navCol={1}
        />
        {isLS && (
          <Field
            label="Allot"
            value={allotment}
            onChange={(v) => onAllotmentChange?.(v)}
            handleWheel={handleWheel}
            handleKeyDown={handleKeyDown}
            placeholder="-"
            unit="MW"
            tone="amber"
            required
            navRow={-1}
            navCol={2}
          />
        )}
      </div>
    </section>
  );
}
