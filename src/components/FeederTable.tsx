"use client";

import { useEffect, useRef } from "react";
import { FEEDERS, feederAllowsRing, RING_BY_FEEDER } from "@/lib/constants";
import { navigateInputsByArrow } from "@/lib/inputNav";

const thBase =
  "text-center font-semibold tracking-wide uppercase align-middle whitespace-nowrap";
const tdBase = "text-center align-middle whitespace-nowrap";

/** Clamp helper for dynamic row height (px) */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function isRingOn(ringActive, id) {
  if (!ringActive) return false;
  return !!(ringActive[id] || ringActive[String(id)]);
}

export default function FeederTable({
  amps,
  getDisplayMW,
  onAmpChange,
  onAmpBlur,
  handleWheel,
  handleKeyDown,
  mode = "normal",
  loadShedPlan = null,
  currentLs = null,
  onCurrentLsChange = null,
  onCurrentLsBlur = null,
  ringActive = {},
  onRingToggle = null,
  busVoltages = { bus1: "", bus2: "" },
  layout = "portrait",
}: {
  amps: Record<string, string>;
  getDisplayMW: (id: any) => number | null;
  onAmpChange: (id: any, value: string) => void;
  onAmpBlur: (id: any) => void;
  handleWheel?: (e: any) => void;
  handleKeyDown?: (e: any) => void;
  mode?: string;
  loadShedPlan?: any;
  currentLs?: Record<string, string> | null;
  onCurrentLsChange?: ((id: any, value: string) => void) | null;
  onCurrentLsBlur?: ((id: any) => void) | null;
  ringActive?: Record<string, boolean>;
  onRingToggle?: ((id: any) => void) | null;
  busVoltages?: { bus1: string; bus2: string };
  layout?: "portrait" | "landscape";
}) {
  const isLS = mode === "loadShed";
  const isLandscape = layout === "landscape";

  /** Bus at 0 kV = shut down → amp input locked at 0 */
  const isBusShutdown = (busNum) => {
    const key = busNum === 1 ? "bus1" : "bus2";
    const v = parseFloat(String(busVoltages?.[key] ?? "").trim());
    return Number.isFinite(v) && v === 0;
  };

  const onInputKeyDown = (e) => {
    if (navigateInputsByArrow(e)) return;
    // Keep legacy guard for up/down when already at edge
    handleKeyDown?.(e);
  };

  const planMap = {};
  if (isLS && loadShedPlan?.feeders) {
    loadShedPlan.feeders.forEach((f) => {
      planMap[f.id] = f;
    });
  }

  const scrollRef = useRef(null);
  const theadRef = useRef(null);
  const rowCount = FEEDERS.length; // 9
  const fittingRef = useRef(false);

  // Scale row height so all feeder rows fit in the available height when possible.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const fit = () => {
      if (fittingRef.current) return;
      const available = el.clientHeight;
      if (available <= 0) return;

      fittingRef.current = true;
      try {
        // Measure header with current styles
        const theadH = theadRef.current?.getBoundingClientRect().height || 28;
        const bodySpace = Math.max(0, available - theadH - 1);
        // Prefer fitting all rows; stay usable on tiny screens
        const ideal = bodySpace / rowCount;
        const rowPx = clamp(Math.floor(ideal), isLandscape ? 26 : 28, isLandscape ? 54 : 48);
        const thPy = clamp(Math.round(rowPx * 0.16), 3, 8);
        const rowText = clamp(Math.round(rowPx * 0.42), 12, 16);
        const thSize = clamp(Math.round(rowPx * 0.36), 11, 14);

        el.style.setProperty("--calc-row-h", `${rowPx}px`);
        el.style.setProperty("--calc-row-text", `${rowText}px`);
        el.style.setProperty("--calc-th-py", `${thPy}px`);
        el.style.setProperty("--calc-th-size", `${thSize}px`);

        // Scroll only if even min rows still overflow
        const needsScroll = rowPx * rowCount + theadH > available + 2;
        el.style.overflowY = needsScroll ? "auto" : "hidden";
      } finally {
        // Allow next frame to observe again after layout settles
        requestAnimationFrame(() => {
          fittingRef.current = false;
        });
      }
    };

    fit();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [rowCount, isLS, isLandscape]);

  const thStyle = {
    paddingTop: "var(--calc-th-py)",
    paddingBottom: "var(--calc-th-py)",
    paddingLeft: "2px",
    paddingRight: "2px",
    fontSize: "var(--calc-th-size)",
    lineHeight: 1.15,
  };

  const tdStyle = {
    fontSize: "var(--calc-row-text)",
    height: "var(--calc-row-h)",
    paddingLeft: "2px",
    paddingRight: "2px",
  };

  const inputStyle = {
    fontSize: "var(--calc-row-text)",
    height: "var(--calc-row-h)",
    minHeight: "var(--calc-row-h)",
  };

  if (isLandscape) {
    const rowH = isLS ? "2.15rem" : "2.65rem";
    const rowText = isLS ? "0.8125rem" : "0.875rem";
    const stickyLabelBase =
      "sticky left-0 z-20 text-left font-bold uppercase tracking-wider px-2.5 border-r border-app shadow-[var(--sticky-shadow)] whitespace-nowrap align-middle text-[11px]";

    return (
      <section className="w-full px-2.5 sm:px-4 py-2">
        <div
          className={`rounded-xl shadow-sm overflow-hidden border bg-surface dark:bg-elevated/70 ${
            isLS
              ? "border-orange-300 dark:border-amber-500/25"
              : "border-app"
          }`}
        >
          <div className="overflow-x-auto calc-feeder-scroll">
            <table
              className="calc-feeder-table w-full min-w-[780px] border-collapse table-fixed"
              style={
                {
                  "--calc-row-h": rowH,
                  "--calc-row-text": rowText,
                } as React.CSSProperties
              }
            >
              <colgroup>
                <col style={{ width: "5.75rem" }} />
                {FEEDERS.map((f) => (
                  <col key={f.id} />
                ))}
              </colgroup>

              <thead>
                <tr className="border-b border-app bg-surface-2">
                  <th
                    className={`${stickyLabelBase} z-30 py-2 bg-zinc-100 text-zinc-800 dark:bg-surface-3 dark:text-app`}
                  >
                    Feeder
                  </th>
                  {FEEDERS.map((item) => {
                    const plan = planMap[item.id];
                    const isProtected = !!plan?.protected;
                    return (
                      <th
                        key={item.id}
                        className="py-2 px-1 text-center border-r border-app last:border-r-0 align-middle"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">
                          <span className="text-[11px] sm:text-xs font-bold text-app truncate max-w-full">
                            {item.name}
                          </span>
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                item.bus === 1 ? "text-bus-1" : "text-bus-2"
                              }`}
                            >
                              B{item.bus}
                            </span>
                            {isProtected && (
                              <span className="text-[9px] font-bold text-accent rounded px-1 bg-accent-dim border border-accent">
                                FREE
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {/* Row 1: Ring */}
                <tr className="border-b border-app bg-surface hover:bg-[var(--history-row-hover)] transition-colors">
                  <th
                    scope="row"
                    className={`${stickyLabelBase} bg-orange-50 text-orange-700 dark:bg-[#271e0b] dark:text-amber-300`}
                    style={{ height: rowH }}
                  >
                    Ring
                  </th>
                  {FEEDERS.map((item) => {
                    const active = isRingOn(ringActive, item.id);
                    return (
                      <td
                        key={item.id}
                        className="border-r border-app last:border-r-0 text-center align-middle px-1"
                        style={{ height: rowH }}
                      >
                        {feederAllowsRing(item.id) ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => onRingToggle?.(item.id)}
                            aria-pressed={active}
                            title={RING_BY_FEEDER[item.id]?.partner || "Ring line"}
                            aria-label={`${item.name} ring line`}
                            className={`mx-auto inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase transition-colors cursor-pointer border ${
                              active
                                ? "bg-orange-500 text-white border-orange-600 dark:bg-amber-500 dark:border-amber-600 shadow-xs"
                                : "bg-surface-3 text-muted border-app hover:border-app-strong hover:text-app"
                            }`}
                          >
                            {active ? "ON" : "OFF"}
                          </button>
                        ) : (
                          <span
                            className="text-muted font-bold text-xs"
                            title="No ring line"
                          >
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Row 2: Amps */}
                <tr className="border-b border-app bg-surface-2/60 hover:bg-[var(--history-row-hover)] transition-colors">
                  <th
                    scope="row"
                    className={`${stickyLabelBase} bg-blue-50 text-blue-700 dark:bg-[#0c263b] dark:text-bus-1`}
                    style={{ height: rowH }}
                  >
                    Amps
                  </th>
                  {FEEDERS.map((item, index) => {
                    const busDown = isBusShutdown(item.bus);
                    return (
                      <td
                        key={item.id}
                        className="cell-input border-r border-app last:border-r-0 text-center align-middle"
                        style={{ height: rowH }}
                      >
                        <input
                          type="text"
                          inputMode="decimal"
                          data-nav="1"
                          data-nav-row={0}
                          data-nav-col={index}
                          value={busDown ? "0" : (amps[item.id] ?? "")}
                          placeholder="-"
                          onChange={(e) => onAmpChange(item.id, e.target.value)}
                          onBlur={() => onAmpBlur(item.id)}
                          onWheel={handleWheel}
                          onKeyDown={onInputKeyDown}
                          disabled={busDown}
                          title={
                            busDown
                              ? "Bus shut down (0 kV) — amps locked at 0"
                              : `${item.name} amps`
                          }
                          className={`w-full bg-transparent text-center font-bold font-mono tabular-nums placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-[var(--app-accent-dim)] focus:ring-1 focus:ring-inset focus:ring-[var(--app-accent)] ${
                            busDown
                              ? "text-muted cursor-not-allowed opacity-60"
                              : "text-app"
                          }`}
                          style={{
                            height: rowH,
                            minHeight: rowH,
                            fontSize: rowText,
                          }}
                          aria-label={`${item.name} amps`}
                          aria-disabled={busDown || undefined}
                        />
                      </td>
                    );
                  })}
                </tr>

                {/* Row 3: MW */}
                <tr
                  className={`${isLS ? "border-b border-app" : ""} bg-[var(--app-accent-dim)]`}
                >
                  <th
                    scope="row"
                    className={`${stickyLabelBase} bg-emerald-50 text-emerald-700 dark:bg-[#0b2922] dark:text-accent`}
                    style={{ height: rowH }}
                  >
                    MW
                  </th>
                  {FEEDERS.map((item) => {
                    const mw = getDisplayMW(item.id);
                    return (
                      <td
                        key={item.id}
                        className="border-r border-app last:border-r-0 text-center align-middle font-black font-mono tabular-nums text-accent bg-[var(--app-accent-dim)]"
                        style={{ height: rowH, fontSize: rowText }}
                      >
                        {mw !== null
                          ? (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1)
                          : "—"}
                      </td>
                    );
                  })}
                </tr>

                {isLS && (
                  <>
                    {/* Row 4: Cur LS */}
                    <tr className="border-b border-app bg-surface hover:bg-[var(--history-row-hover)] transition-colors">
                      <th
                        scope="row"
                        className={`${stickyLabelBase} bg-orange-50 text-orange-700 dark:bg-[#271e0b] dark:text-amber-300`}
                        style={{ height: rowH }}
                        title="Already applied LS (MW)"
                      >
                        Cur LS
                      </th>
                      {FEEDERS.map((item, index) => {
                        const plan = planMap[item.id];
                        const isProtected = !!plan?.protected;
                        return (
                          <td
                            key={item.id}
                            className="cell-input border-r border-app last:border-r-0 text-center align-middle bg-app"
                            style={{ height: rowH }}
                          >
                            {isProtected ? (
                              <span className="font-mono text-muted text-xs">—</span>
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                data-nav="1"
                                data-nav-row={1}
                                data-nav-col={index}
                                value={currentLs?.[item.id] ?? ""}
                                placeholder="-"
                                onChange={(e) =>
                                  onCurrentLsChange?.(item.id, e.target.value)
                                }
                                onBlur={() => onCurrentLsBlur?.(item.id)}
                                onWheel={handleWheel}
                                onKeyDown={onInputKeyDown}
                                className="w-full bg-transparent text-center font-bold text-orange-700 dark:text-amber-200 placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-orange-50 dark:focus:bg-amber-950/40 focus:ring-1 focus:ring-inset focus:ring-orange-500 dark:focus:ring-amber-500 font-mono tabular-nums"
                                style={{
                                  height: rowH,
                                  minHeight: rowH,
                                  fontSize: rowText,
                                }}
                                aria-label={`${item.name} current LS MW`}
                                title="Already applied LS (MW)"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 5: More LS */}
                    <tr className="border-b border-app bg-rose-50/50 dark:bg-rose-950/15">
                      <th
                        scope="row"
                        className={`${stickyLabelBase} bg-rose-50 text-rose-700 dark:bg-[#2b131b] dark:text-rose-300`}
                        style={{ height: rowH }}
                        title="Additional LS required (MW)"
                      >
                        More LS
                      </th>
                      {FEEDERS.map((item) => {
                        const plan = planMap[item.id];
                        const showPlan = plan && loadShedPlan?.valid;
                        const isProtected = !!plan?.protected;
                        return (
                          <td
                            key={item.id}
                            className="border-r border-app last:border-r-0 text-center align-middle font-black font-mono tabular-nums text-rose-700 dark:text-rose-400"
                            style={{ height: rowH, fontSize: rowText }}
                          >
                            {showPlan
                              ? isProtected
                                ? "—"
                                : (Math.round((plan.moreLsMW + Number.EPSILON) * 10) / 10).toFixed(1)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 6: Target A */}
                    <tr className="border-b border-app bg-emerald-50/60 dark:bg-emerald-950/15">
                      <th
                        scope="row"
                        className={`${stickyLabelBase} bg-emerald-50 text-emerald-700 dark:bg-[#0b2922] dark:text-accent`}
                        style={{ height: rowH }}
                      >
                        Target A
                      </th>
                      {FEEDERS.map((item) => {
                        const plan = planMap[item.id];
                        const showPlan = plan && loadShedPlan?.valid;
                        const isProtected = !!plan?.protected;
                        return (
                          <td
                            key={item.id}
                            className="border-r border-app last:border-r-0 text-center align-middle font-black font-mono tabular-nums text-accent"
                            style={{ height: rowH, fontSize: rowText }}
                          >
                            {showPlan
                              ? isProtected
                                ? Math.round(plan.amps)
                                : Math.round(plan.targetAmps)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Row 7: Total LS */}
                    <tr className="bg-blue-50/50 dark:bg-teal-950/15">
                      <th
                        scope="row"
                        className={`${stickyLabelBase} bg-sky-50 text-sky-700 dark:bg-[#0c263b] dark:text-teal-300`}
                        style={{ height: rowH }}
                        title="Total LS = Cur + More (MW)"
                      >
                        Total LS
                      </th>
                      {FEEDERS.map((item) => {
                        const plan = planMap[item.id];
                        const showPlan = plan && loadShedPlan?.valid;
                        const isProtected = !!plan?.protected;
                        return (
                          <td
                            key={item.id}
                            className="border-r border-app last:border-r-0 text-center align-middle font-black font-mono tabular-nums text-blue-700 dark:text-teal-300"
                            style={{ height: rowH, fontSize: rowText }}
                          >
                            {showPlan
                              ? isProtected
                                ? "—"
                                : (Math.round((plan.totalLsMW + Number.EPSILON) * 10) / 10).toFixed(1)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="calc-feeder-wrap bg-surface"
      style={
        isLandscape
          ? {
              paddingLeft: "0.5rem",
              paddingRight: "0.5rem",
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
            }
          : {
              paddingLeft: "var(--calc-section-px)",
              paddingRight: "var(--calc-section-px)",
              paddingTop: "calc(var(--calc-gap) * 0.4)",
              paddingBottom: "calc(var(--calc-gap) * 0.4)",
            }
      }
    >
      <div
        className={`rounded-lg shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col border bg-surface dark:bg-elevated/70 ${ isLS ? "border-orange-300 dark:border-amber-500/25" : "border-app" }`}
      >
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto calc-feeder-scroll"
        >
          <table className="calc-feeder-table w-full">
            <colgroup>
              {isLS ? (
                <>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                </>
              ) : (
                <>
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "18%" }} />
                </>
              )}
            </colgroup>

            <thead
              ref={theadRef}
              className="bg-surface-2 text-secondary sticky top-0 z-10 border-b border-app shadow-[var(--sticky-shadow)]"
            >
              <tr className="border-b border-app">
                <th
                  className={`${thBase} border-r border-app bg-blue-50 text-blue-700 dark:bg-[var(--bus-1-bg)] dark:text-bus-1`}
                  style={thStyle}
                >
                  Amps
                </th>
                <th
                  className={`${thBase} border-r border-app bg-zinc-100 text-zinc-800 dark:bg-[var(--app-violet-dim)] dark:text-app`}
                  style={thStyle}
                >
                  Feeder
                </th>
                <th
                  className={`${thBase} bg-[var(--app-accent-dim)] text-accent`}
                  style={thStyle}
                >
                  MW
                </th>
                <th
                  className={`${thBase} border-l border-app bg-[var(--app-highlight-dim)] text-warning`}
                  style={thStyle}
                >
                  Ring
                </th>
                {isLS && (
                  <>
                    <th
                      className={`${thBase} border-l border-app bg-[var(--app-highlight-dim)] text-warning`}
                      style={thStyle}
                      title="Already applied LS (MW)"
                    >
                      Cur LS
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]`}
                      style={thStyle}
                      title="Additional LS required (MW)"
                    >
                      More LS
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-[var(--app-accent-dim)] text-accent`}
                      style={thStyle}
                    >
                      Target A
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-[var(--app-accent-dim)] text-accent`}
                      style={thStyle}
                      title="Total LS = Cur + More (MW)"
                    >
                      Total LS
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {FEEDERS.map((item, index) => {
                const mw = getDisplayMW(item.id);
                const plan = planMap[item.id];
                const showPlan = isLS && plan && loadShedPlan?.valid;
                const isProtected = !!plan?.protected;
                const rowBg = isProtected
                  ? "bg-surface-3"
                  : index % 2 === 0
                    ? "bg-surface"
                    : "bg-surface-2/80";

                return (
                  <tr
                    key={item.id}
                    className={`${rowBg} border-b border-app last:border-b-0 transition-colors hover:bg-[var(--history-row-hover)]`}
                  >
                    {/* Amps */}
                    <td
                      className={`cell-input border-r border-app ${tdBase}`}
                      style={tdStyle}
                    >
                      {(() => {
                        const busDown = isBusShutdown(item.bus);
                        return (
                      <input
                        type="text"
                        inputMode="decimal"
                        data-nav="1"
                        data-nav-row={index}
                        data-nav-col={0}
                        value={busDown ? "0" : (amps[item.id] ?? "")}
                        placeholder="-"
                        onChange={(e) => onAmpChange(item.id, e.target.value)}
                        onBlur={() => onAmpBlur(item.id)}
                        onWheel={handleWheel}
                        onKeyDown={onInputKeyDown}
                        disabled={busDown}
                        title={busDown ? "Bus shut down (0 kV) — amps locked at 0" : undefined}
                        className={`w-full bg-transparent text-center font-bold font-mono tabular-nums placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-[var(--app-accent-dim)] focus:ring-1 focus:ring-inset focus:ring-[var(--app-accent)] ${
                          busDown
                            ? "text-muted cursor-not-allowed opacity-60"
                            : "text-app"
                        }`}
                        style={inputStyle}
                        aria-label={`${item.name} amps`}
                        aria-disabled={busDown || undefined}
                      />
                        );
                      })()}
                    </td>

                    {/* Feeder */}
                    <td
                      className={`border-r border-app ${tdBase}`}
                      style={tdStyle}
                    >
                      <div className="flex items-center justify-center gap-1.5 min-w-0 px-1">
                        <span className="font-bold text-app truncate">
                          {item.name}
                        </span>
                        <span
                          className={`font-mono font-bold shrink-0 ${item.bus === 1 ? "text-bus-1" : "text-bus-2"}`}
                          style={{ fontSize: "calc(var(--calc-row-text) * 0.72)" }}
                        >
                          B{item.bus}
                        </span>
                        {isProtected && (
                          <span
                            className="font-bold text-accent shrink-0 rounded px-1 bg-accent-dim border border-accent"
                            style={{ fontSize: "calc(var(--calc-row-text) * 0.58)" }}
                          >
                            FREE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* MW */}
                    <td
                      className={`${tdBase} font-black font-mono tabular-nums text-accent bg-[var(--app-accent-dim)]`}
                      style={tdStyle}
                    >
                      {mw !== null ? (Math.round((mw + Number.EPSILON) * 10) / 10).toFixed(1) : "—"}
                    </td>

                    {/* Ring — only feeders with a defined ring partner */}
                    <td
                      className={`${tdBase} border-l border-app`}
                      style={tdStyle}
                    >
                      {feederAllowsRing(item.id) ? (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => onRingToggle?.(item.id)}
                          aria-pressed={isRingOn(ringActive, item.id)}
                          title={RING_BY_FEEDER[item.id]?.partner || "Ring line"}
                          aria-label={`${item.name} ring line`}
                          className={`mx-auto inline-flex items-center justify-center rounded px-1.5 font-bold tracking-wide uppercase transition-colors cursor-pointer border ${ isRingOn(ringActive, item.id) ? "bg-orange-500 text-white border-orange-600 dark:bg-amber-500 dark:border-amber-600 shadow-xs" : "bg-surface-3 text-muted border-app hover:border-app-strong hover:text-app" }`}
                          style={{
                            fontSize: "calc(var(--calc-row-text) * 0.7)",
                            height: "calc(var(--calc-row-h) * 0.78)",
                            minWidth: "2.4rem",
                          }}
                        >
                          {isRingOn(ringActive, item.id) ? "ON" : "OFF"}
                        </button>
                      ) : (
                        <span
                          className="text-muted font-bold tracking-wide"
                          style={{ fontSize: "calc(var(--calc-row-text) * 0.7)" }}
                          title="No ring line"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {isLS && (
                      <>
                        {/* Cur LS input */}
                        <td
                          className={`cell-input border-l border-app bg-app ${tdBase}`}
                          style={tdStyle}
                        >
                          {isProtected ? (
                            <span className="font-mono text-muted">—</span>
                          ) : (
                            <input
                              type="text"
                              inputMode="decimal"
                              data-nav="1"
                              data-nav-row={index}
                              data-nav-col={1}
                              value={currentLs?.[item.id] ?? ""}
                              placeholder="-"
                              onChange={(e) =>
                                onCurrentLsChange?.(item.id, e.target.value)
                              }
                              onBlur={() => onCurrentLsBlur?.(item.id)}
                              onWheel={handleWheel}
                              onKeyDown={onInputKeyDown}
                              className="w-full bg-transparent text-center font-bold text-orange-700 dark:text-amber-200 placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-orange-50 dark:focus:bg-amber-950/40 focus:ring-1 focus:ring-inset focus:ring-orange-500 dark:focus:ring-amber-500 font-mono tabular-nums"
                              style={inputStyle}
                              aria-label={`${item.name} current LS MW`}
                              title="Already applied LS (MW)"
                            />
                          )}
                        </td>

                        {/* More LS */}
                        <td
                          className={`border-l border-app bg-rose-50/50 dark:bg-rose-950/15 ${tdBase} font-black font-mono tabular-nums text-rose-700 dark:text-rose-400`}
                          style={tdStyle}
                        >
                          {showPlan
                            ? isProtected
                              ? "—"
                              : (Math.round((plan.moreLsMW + Number.EPSILON) * 10) / 10).toFixed(1)
                            : "—"}
                        </td>

                        {/* Target A */}
                        <td
                          className={`border-l border-app bg-emerald-50/60 dark:bg-emerald-950/15 ${tdBase} font-black font-mono tabular-nums text-accent`}
                          style={tdStyle}
                        >
                          {showPlan
                            ? isProtected
                              ? Math.round(plan.amps)
                              : Math.round(plan.targetAmps)
                            : "—"}
                        </td>

                        {/* Total LS */}
                        <td
                          className={`border-l border-app bg-blue-50/50 dark:bg-teal-950/15 ${tdBase} font-black font-mono tabular-nums text-blue-700 dark:text-teal-300`}
                          style={tdStyle}
                        >
                          {showPlan
                            ? isProtected
                              ? "—"
                              : (Math.round((plan.totalLsMW + Number.EPSILON) * 10) / 10).toFixed(1)
                            : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
