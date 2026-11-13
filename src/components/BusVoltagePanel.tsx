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
      ? "bg-orange-50/90 dark:bg-amber-950/35 border-orange-200 dark:border-amber-500/30 hover:border-orange-400 dark:hover:border-amber-500/60"
      : tone === "purple"
        ? "bg-purple-500/10 dark:bg-purple-950/25 border-purple-500/30 hover:border-purple-500/60"
        : tone === "sky"
          ? "bg-blue-50/90 dark:bg-sky-950/25 border-blue-200 dark:border-sky-500/30 hover:border-blue-400 dark:hover:border-sky-500/60"
          : "bg-surface-2 border-app hover:border-accent";

  const labelCls =
    tone === "amber"
      ? "text-orange-700 dark:text-amber-300"
      : tone === "purple"
        ? "text-purple-800 dark:text-purple-300"
        : tone === "sky"
          ? "text-blue-700 dark:text-sky-300"
          : "text-secondary";

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
  layout = "portrait",
  bus1MW = 0,
  bus2MW = 0,
  ringCount = 0,
  calculated = false,
}: {
  busVoltages: { bus1: string; bus2: string };
  onChange: (bus: string, value: string) => void;
  handleWheel?: (e: any) => void;
  handleKeyDown?: (e: any) => void;
  mode?: string;
  allotment?: string;
  onAllotmentChange?: (value: string) => void;
  layout?: "portrait" | "landscape";
  bus1MW?: number;
  bus2MW?: number;
  ringCount?: number;
  calculated?: boolean;
}) {
  const isLS = mode === "loadShed";
  const isLandscape = layout === "landscape";

  if (isLandscape) {
    const b1Val = parseFloat(String(busVoltages.bus1 ?? "").trim());
    const b2Val = parseFloat(String(busVoltages.bus2 ?? "").trim());
    const b1Down = Number.isFinite(b1Val) && b1Val === 0;
    const b2Down = Number.isFinite(b2Val) && b2Val === 0;

    return (
      <section className="border-b border-app bg-surface-2/75 px-3 sm:px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-[10.5rem]">
              <Field
                label="BUS-2"
                value={busVoltages.bus2}
                onChange={(v) => onChange("bus2", v)}
                handleWheel={handleWheel}
                handleKeyDown={handleKeyDown}
                placeholder="-"
                unit="kV"
                tone="amber"
                required
                navRow={-1}
                navCol={0}
              />
            </div>
            <div className="w-[10.5rem]">
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
            </div>
            {isLS && (
              <div className="w-[12.25rem]">
                <Field
                  label="Allotment"
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
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center divide-x divide-app text-xs font-mono tabular-nums">
            <div className="pr-3.5 flex flex-col items-end">
              <span className="text-[10px] font-sans font-semibold text-muted uppercase tracking-wider">
                BUS-2 Feeders
              </span>
              <span className={`font-bold ${b2Down ? "text-danger" : "text-bus-2"}`}>
                {b2Down
                  ? "Shutdown"
                  : calculated
                    ? `${(Math.round((bus2MW + Number.EPSILON) * 10) / 10).toFixed(1)} MW`
                    : "— MW"}
              </span>
            </div>
            <div className="px-3.5 flex flex-col items-end">
              <span className="text-[10px] font-sans font-semibold text-muted uppercase tracking-wider">
                BUS-1 Feeders
              </span>
              <span className={`font-bold ${b1Down ? "text-danger" : "text-bus-1"}`}>
                {b1Down
                  ? "Shutdown"
                  : calculated
                    ? `${(Math.round((bus1MW + Number.EPSILON) * 10) / 10).toFixed(1)} MW`
                    : "— MW"}
              </span>
            </div>
            <div className="pl-3.5 flex flex-col items-end">
              <span className="text-[10px] font-sans font-semibold text-muted uppercase tracking-wider">
                Ring Lines
              </span>
              <span className={`font-bold ${ringCount > 0 ? "text-warning" : "text-secondary"}`}>
                {ringCount > 0 ? `${ringCount} Active` : "None"}
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
          tone="amber"
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
