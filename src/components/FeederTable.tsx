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
}) {
  const isLS = mode === "loadShed";

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
        const rowPx = clamp(Math.floor(ideal), 28, 48);
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
  }, [rowCount, isLS]);

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

  return (
    <section
      className="calc-feeder-wrap bg-surface"
      style={{
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        paddingTop: "calc(var(--calc-gap) * 0.4)",
        paddingBottom: "calc(var(--calc-gap) * 0.4)",
      }}
    >
      <div
        className={`rounded-lg shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col border bg-elevated/70 ${
          isLS ? "border-amber-500/25" : "border-app"
        }`}
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
              className="bg-surface-2 dark:bg-slate-950 text-app dark:text-slate-300 sticky top-0 z-10 border-b border-app"
            >
              <tr className="border-b border-app">
                <th
                  className={`${thBase} border-r border-app bg-sky-100/90 text-sky-900 dark:bg-sky-950/75 dark:text-sky-200`}
                  style={thStyle}
                >
                  Amps
                </th>
                <th
                  className={`${thBase} border-r border-app bg-purple-100/90 text-purple-900 dark:bg-purple-950/75 dark:text-purple-200`}
                  style={thStyle}
                >
                  Feeder
                </th>
                <th
                  className={`${thBase} bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300`}
                  style={thStyle}
                >
                  MW
                </th>
                <th
                  className={`${thBase} border-l border-app bg-amber-100/90 text-amber-900 dark:bg-amber-950/75 dark:text-amber-200`}
                  style={thStyle}
                >
                  Ring
                </th>
                {isLS && (
                  <>
                    <th
                      className={`${thBase} border-l border-app bg-amber-100/90 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200`}
                      style={thStyle}
                      title="Already applied LS (MW)"
                    >
                      Cur LS
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-rose-100/90 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300`}
                      style={thStyle}
                      title="Additional LS required (MW)"
                    >
                      More LS
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300`}
                      style={thStyle}
                    >
                      Target A
                    </th>
                    <th
                      className={`${thBase} border-l border-app bg-teal-100/90 text-teal-900 dark:bg-teal-950/80 dark:text-teal-300`}
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
                  ? "bg-slate-100 dark:bg-slate-800/60"
                  : index % 2 === 0
                    ? "bg-surface dark:bg-slate-900/45"
                    : "bg-surface-2/60 dark:bg-slate-950/45";

                return (
                  <tr
                    key={item.id}
                    className={`${rowBg} border-b border-app last:border-b-0 transition-colors hover:bg-sky-50/80 dark:hover:bg-slate-800/50`}
                  >
                    {/* Amps */}
                    <td
                      className={`cell-input border-r border-app ${tdBase}`}
                      style={tdStyle}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        data-nav="1"
                        data-nav-row={index}
                        data-nav-col={0}
                        value={amps[item.id] ?? ""}
                        placeholder="-"
                        onChange={(e) => onAmpChange(item.id, e.target.value)}
                        onBlur={() => onAmpBlur(item.id)}
                        onWheel={handleWheel}
                        onKeyDown={onInputKeyDown}
                        className="w-full bg-transparent text-center font-bold text-app dark:text-white placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-950/40 focus:ring-1 focus:ring-inset focus:ring-emerald-500 font-mono tabular-nums"
                        style={inputStyle}
                        aria-label={`${item.name} amps`}
                      />
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
                          className={`font-mono font-bold shrink-0 ${
                            item.bus === 1 ? "text-sky-700 dark:text-sky-400" : "text-purple-700 dark:text-purple-400"
                          }`}
                          style={{ fontSize: "calc(var(--calc-row-text) * 0.72)" }}
                        >
                          B{item.bus}
                        </span>
                        {isProtected && (
                          <span
                            className="font-bold text-emerald-800 dark:text-emerald-300 shrink-0 rounded px-1 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/25"
                            style={{ fontSize: "calc(var(--calc-row-text) * 0.58)" }}
                          >
                            FREE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* MW */}
                    <td
                      className={`${tdBase} font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/15`}
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
                          className={`mx-auto inline-flex items-center justify-center rounded px-1.5 font-bold tracking-wide uppercase transition-colors cursor-pointer border ${
                            isRingOn(ringActive, item.id)
                              ? "bg-amber-500 text-white dark:text-slate-950 border-amber-600 shadow-xs"
                              : "bg-surface dark:bg-slate-800/80 text-muted border-app hover:border-slate-400 hover:text-app"
                          }`}
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
                          className={`cell-input border-l border-app bg-surface dark:bg-slate-950/40 ${tdBase}`}
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
                              className="w-full bg-transparent text-center font-bold text-amber-900 dark:text-amber-200 placeholder:text-muted placeholder:font-normal focus:placeholder:text-transparent focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-950/40 focus:ring-1 focus:ring-inset focus:ring-amber-500 font-mono tabular-nums"
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
                          className={`border-l border-app bg-emerald-50/50 dark:bg-emerald-950/15 ${tdBase} font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300`}
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
                          className={`border-l border-app bg-teal-50/50 dark:bg-teal-950/15 ${tdBase} font-black font-mono tabular-nums text-teal-800 dark:text-teal-300`}
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
