"use client";

import {
  Calculator,
  History,
  RectangleHorizontal,
  RectangleVertical,
  Zap,
} from "lucide-react";

export default function CalculatorModeToggle({
  mode,
  onChange,
  onHistory,
  historyLabel,
  layout = "portrait",
  onLayoutChange,
}: {
  mode: string;
  onChange: (mode: string) => void;
  onHistory?: () => void;
  historyLabel?: string;
  layout?: "portrait" | "landscape";
  onLayoutChange?: (layout: "portrait" | "landscape") => void;
}) {
  const isLS = mode === "loadShed";
  const isLandscape = layout === "landscape";

  return (
    <div
      className={`flex flex-col border-b ${
        isLS
          ? "border-[var(--app-highlight-border)] bg-[var(--app-highlight-dim)]"
          : "border-app bg-surface-2"
      } ${isLandscape ? "px-4 lg:px-5 py-2 gap-1.5" : ""}`}
      style={
        isLandscape
          ? undefined
          : {
              paddingTop: "calc(var(--calc-gap) * 0.45)",
              paddingBottom: "calc(var(--calc-gap) * 0.45)",
              paddingLeft: "var(--calc-section-px)",
              paddingRight: "var(--calc-section-px)",
              gap: "calc(var(--calc-gap) * 0.35)",
            }
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-app bg-surface p-0.5 shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => onChange("normal")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 font-bold tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
              mode === "normal"
                ? "btn-primary shadow-xs"
                : "text-muted hover:bg-surface-3 hover:text-app"
            } ${isLandscape ? "h-8 text-[11px]" : ""}`}
            style={
              isLandscape
                ? undefined
                : {
                    fontSize: "var(--calc-btn-text)",
                    height: "calc(var(--calc-btn-h) * 0.8)",
                  }
            }
          >
            {isLandscape && <Calculator className="w-3.5 h-3.5 shrink-0" />}
            <span>Load Calc</span>
          </button>
          <button
            type="button"
            onClick={() => onChange("loadShed")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 font-bold tracking-wide uppercase transition-all cursor-pointer whitespace-nowrap ${
              isLS
                ? "bg-orange-500 dark:bg-amber-600 text-white shadow-xs"
                : "text-muted hover:bg-surface-3 hover:text-app"
            } ${isLandscape ? "h-8 text-[11px]" : ""}`}
            style={
              isLandscape
                ? undefined
                : {
                    fontSize: "var(--calc-btn-text)",
                    height: "calc(var(--calc-btn-h) * 0.8)",
                  }
            }
          >
            {isLandscape && <Zap className="w-3.5 h-3.5 shrink-0" />}
            <span>Loadshed</span>
          </button>
        </div>

        {isLandscape && (
          <p
            className={`hidden xl:block text-xs font-medium leading-tight truncate ${
              isLS ? "text-warning" : "text-muted"
            }`}
          >
            {isLS
              ? "Set allotment · enter amps & current LS · plan shows target A & more LS"
              : "Enter bus voltages (kV) and feeder amps (A) · Calculate or Save to hourly slot"}
          </p>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {onLayoutChange && (
            <div
              role="group"
              aria-label="Calculator layout orientation"
              className="inline-flex items-center rounded-lg border border-app bg-surface p-0.5 shadow-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => onLayoutChange("portrait")}
                aria-pressed={layout === "portrait"}
                title="Portrait mode (vertical stack)"
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 font-bold tracking-wide uppercase transition-all cursor-pointer border whitespace-nowrap ${
                  layout === "portrait"
                    ? "bg-accent-dim text-accent border-accent/50 shadow-xs"
                    : "text-muted hover:bg-surface-3 hover:text-app border-transparent"
                } ${isLandscape ? "h-8 text-[11px]" : ""}`}
                style={
                  isLandscape
                    ? undefined
                    : {
                        fontSize: "var(--calc-btn-text)",
                        height: "calc(var(--calc-btn-h) * 0.8)",
                      }
                }
              >
                <RectangleVertical className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden min-[460px]:inline">Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => onLayoutChange("landscape")}
                aria-pressed={layout === "landscape"}
                title="Landscape mode (wide control-room sheet)"
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 font-bold tracking-wide uppercase transition-all cursor-pointer border whitespace-nowrap ${
                  layout === "landscape"
                    ? "bg-accent-dim text-accent border-accent/50 shadow-xs"
                    : "text-muted hover:bg-surface-3 hover:text-app border-transparent"
                } ${isLandscape ? "h-8 text-[11px]" : ""}`}
                style={
                  isLandscape
                    ? undefined
                    : {
                        fontSize: "var(--calc-btn-text)",
                        height: "calc(var(--calc-btn-h) * 0.8)",
                      }
                }
              >
                <RectangleHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden min-[460px]:inline">Landscape</span>
              </button>
            </div>
          )}

          {onHistory && (
            <button
              type="button"
              onClick={onHistory}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg font-semibold tracking-wide uppercase border border-app text-secondary hover:text-app bg-surface hover:bg-surface-3 shadow-xs active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap ${
                isLandscape ? "h-8 px-3 text-[11px]" : ""
              }`}
              style={
                isLandscape
                  ? undefined
                  : {
                      height: "calc(var(--calc-btn-h) * 0.8)",
                      fontSize: "var(--calc-btn-text)",
                      paddingLeft: "0.6rem",
                      paddingRight: "0.6rem",
                    }
              }
            >
              {isLandscape && <History className="w-3.5 h-3.5 shrink-0" />}
              <span>{historyLabel || "History"}</span>
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-[10px] font-medium leading-tight ${
          isLandscape ? "xl:hidden" : ""
        } ${isLS ? "text-warning" : "text-muted"}`}
      >
        {isLS
          ? "Set allotment · enter amps & current LS · plan shows target A & more LS"
          : "Enter bus kV and feeder amps · Calculate or Calculate & Save"}
      </p>
    </div>
  );
}
