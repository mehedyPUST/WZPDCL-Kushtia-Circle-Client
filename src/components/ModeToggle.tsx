"use client";

export default function ModeToggle({ mode, onChange, onHistory, historyLabel }) {
  const isLS = mode === "loadShed";

  return (
    <div
      className={`flex flex-col border-b ${
        isLS
          ? "border-amber-500/30 bg-amber-500/10 dark:bg-gradient-to-b dark:from-amber-950/30 dark:to-slate-900/90"
          : "border-app bg-surface-2/60 dark:bg-slate-900/80"
      }`}
      style={{
        paddingTop: "calc(var(--calc-gap) * 0.45)",
        paddingBottom: "calc(var(--calc-gap) * 0.45)",
        paddingLeft: "var(--calc-section-px)",
        paddingRight: "var(--calc-section-px)",
        gap: "calc(var(--calc-gap) * 0.35)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-app bg-surface dark:bg-slate-950/80 p-0.5 shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => onChange("normal")}
            className={`rounded-md px-3.5 font-bold tracking-wide uppercase transition-all cursor-pointer ${
              mode === "normal"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted hover:bg-surface-3 hover:text-app"
            }`}
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
            className={`rounded-md px-3.5 font-bold tracking-wide uppercase transition-all cursor-pointer ${
              isLS
                ? "bg-amber-600 text-white shadow-xs"
                : "text-muted hover:bg-surface-3 hover:text-app"
            }`}
            style={{
              fontSize: "var(--calc-btn-text)",
              height: "calc(var(--calc-btn-h) * 0.8)",
            }}
          >
            Loadshed
          </button>
        </div>

        {onHistory && (
          <button
            type="button"
            onClick={onHistory}
            className="shrink-0 rounded-lg font-semibold tracking-wide uppercase border border-app text-secondary hover:text-app bg-surface hover:bg-surface-3 shadow-xs active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400"
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
      <p
        className={`text-[10px] font-medium leading-tight ${
          isLS ? "text-amber-800 dark:text-amber-300" : "text-muted"
        }`}
      >
        {isLS
          ? "Set allotment · enter amps & current LS · plan shows target A & more LS"
          : "Enter bus kV and feeder amps · Calculate or Calculate & Save"}
      </p>
    </div>
  );
}
