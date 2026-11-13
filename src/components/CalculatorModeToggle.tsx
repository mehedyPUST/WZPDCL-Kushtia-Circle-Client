"use client";

import { RectangleHorizontal, RectangleVertical } from "lucide-react";

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
      className={`flex flex-col border-b ${isLS ? "border-[var(--app-highlight-border)] bg-[var(--app-highlight-dim)]" : "border-app bg-surface-2"}`}
      style={{
        paddingTop: isLandscape ? "0.35rem" : "calc(var(--calc-gap) * 0.45)",
        paddingBottom: isLandscape ? "0.35rem" : "calc(var(--calc-gap) * 0.45)",
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        gap: "calc(var(--calc-gap) * 0.35)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-app bg-surface p-0.5 shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => onChange("normal")}
            className={`rounded-md px-3 font-bold tracking-wide uppercase transition-all cursor-pointer ${ mode === "normal" ? "btn-primary shadow-xs" : "text-muted hover:bg-surface-3 hover:text-app" }`}
            style={{
              fontSize: "var(--calc-btn-text)",
              height: "calc(var(--calc-btn-h) * 0.8)",
            }}
          >
            Load Calc
          </button>
          <button
            type="button"
            onClick={() => onChange("loadShed")}
            className={`rounded-md px-3 font-bold tracking-wide uppercase transition-all cursor-pointer ${ isLS ? "bg-orange-500 dark:bg-amber-600 text-white shadow-xs" : "text-muted hover:bg-surface-3 hover:text-app" }`}
            style={{
              fontSize: "var(--calc-btn-text)",
              height: "calc(var(--calc-btn-h) * 0.8)",
            }}
          >
            Loadshed
          </button>
        </div>

        {isLandscape && (
          <p
            className={`hidden xl:block text-[11px] font-medium leading-tight truncate ${isLS ? "text-warning" : "text-muted"}`}
          >
            {isLS
              ? "Set allotment · enter amps & current LS · plan shows target A & more LS"
              : "Enter bus kV and feeder amps · Calculate or Calculate & Save"}
          </p>
        )}

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
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
                className={`inline-flex items-center justify-center gap-1 rounded-md px-2 font-bold tracking-wide uppercase transition-all cursor-pointer border ${
                  layout === "portrait"
                    ? "bg-accent-dim text-accent border-accent/50 shadow-xs"
                    : "text-muted hover:bg-surface-3 hover:text-app border-transparent"
                }`}
                style={{
                  fontSize: "var(--calc-btn-text)",
                  height: "calc(var(--calc-btn-h) * 0.8)",
                }}
              >
                <RectangleVertical className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden min-[460px]:inline">Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => onLayoutChange("landscape")}
                aria-pressed={layout === "landscape"}
                title="Landscape mode (side-by-side cockpit)"
                className={`inline-flex items-center justify-center gap-1 rounded-md px-2 font-bold tracking-wide uppercase transition-all cursor-pointer border ${
                  layout === "landscape"
                    ? "bg-accent-dim text-accent border-accent/50 shadow-xs"
                    : "text-muted hover:bg-surface-3 hover:text-app border-transparent"
                }`}
                style={{
                  fontSize: "var(--calc-btn-text)",
                  height: "calc(var(--calc-btn-h) * 0.8)",
                }}
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
              className="shrink-0 rounded-lg font-semibold tracking-wide uppercase border border-app text-secondary hover:text-app bg-surface hover:bg-surface-3 shadow-xs active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent"
              style={{
                height: "calc(var(--calc-btn-h) * 0.8)",
                fontSize: "var(--calc-btn-text)",
                paddingLeft: "0.6rem",
                paddingRight: "0.6rem",
              }}
            >
              {historyLabel || "History"}
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-[10px] font-medium leading-tight ${isLandscape ? "xl:hidden" : ""} ${ isLS ? "text-warning" : "text-muted" }`}
      >
        {isLS
          ? "Set allotment · enter amps & current LS · plan shows target A & more LS"
          : "Enter bus kV and feeder amps · Calculate or Calculate & Save"}
      </p>
    </div>
  );
}
