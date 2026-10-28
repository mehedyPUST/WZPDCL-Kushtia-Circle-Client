"use client";

import { RING_BY_FEEDER, feederAllowsRing } from "@/lib/constants";

function splitDateTime(iso) {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return { date, time };
}

export default function HistoryDetail({ record, onClose, onEdit }) {
  if (!record) return null;

  const { date, time } = splitDateTime(record.createdAt || record.calculatedAt);

  return (
    <aside className="w-full h-full flex flex-col bg-surface-2 border border-app shadow-xl overflow-hidden rounded-none md:rounded-xl">
      <div
        className={`flex items-center gap-2 px-3.5 py-2.5 text-app shrink-0 ${record.isOffline
            ? "bg-amber-100 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-500/30"
            : "bg-surface-3 border-b border-app"
          }`}
      >
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold tracking-tight ${record.isOffline ? "text-amber-800 dark:text-amber-300" : "text-app"
              }`}
          >
            {record.isOffline ? "Offline (pending sync)" : "Calculation Detail"}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-muted mt-0.5">
            {date} · {time}
            {record.isOffline ? " · not on server yet" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-lg font-bold w-8 h-8 rounded-lg text-muted hover:text-app hover:bg-surface-3 active:scale-95 transition-all duration-150 leading-none"
          aria-label="Close detail"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3 grid grid-cols-2 gap-2 bg-surface-2 border-b border-app">
          <div className="flex items-center justify-between bg-purple-100 dark:bg-purple-950/40 px-3 py-2.5 rounded-xl border border-purple-300 dark:border-purple-500/35">
            <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">BUS-2 (kV)</span>
            <span className="text-sm font-bold font-mono tabular-nums text-app">
              {record.busVoltages?.bus2 != null
                ? Number(record.busVoltages.bus2).toFixed(2)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between bg-sky-100 dark:bg-sky-950/40 px-3 py-2.5 rounded-xl border border-sky-300 dark:border-sky-500/35">
            <span className="text-xs font-semibold text-sky-800 dark:text-sky-300">BUS-1 (kV)</span>
            <span className="text-sm font-bold font-mono tabular-nums text-app">
              {record.busVoltages?.bus1 != null
                ? Number(record.busVoltages.bus1).toFixed(2)
                : "—"}
            </span>
          </div>
        </div>

        <div className="px-3 py-3">
          <div className="border border-app rounded-xl overflow-hidden bg-surface">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-surface-2">
                <tr className="border-b border-app">
                  <th className="w-[33%] py-2 text-center font-semibold text-secondary text-xs">
                    Load (A)
                  </th>
                  <th className="w-[34%] py-2 text-center font-semibold text-secondary text-xs border-x border-app">
                    Feeder
                  </th>
                  <th className="w-[33%] py-2 text-center font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                    Load (MW)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app">
                {(record.feeders || []).map((f, index) => (
                  <tr
                    key={f.id ?? index}
                    className={index % 2 === 0 ? "bg-surface" : "bg-surface-2"}
                  >
                    <td className="text-center py-2.5 font-semibold font-mono tabular-nums text-sm text-app border-r border-app">
                      {Number(f.amps || 0).toFixed(1)}
                    </td>
                    <td className="text-center font-semibold text-app py-2.5 border-r border-app text-sm">
                      {f.name === "Campus" || f.name === "GIS" ? "Campus / GIS" : f.name}
                      <span
                        className={`ml-1 text-[10px] font-semibold ${Number(f.bus) === 2 ? "text-purple-700 dark:text-purple-300" : "text-sky-700 dark:text-sky-300"
                          }`}
                      >
                        B{f.bus}
                      </span>
                      {f.ringActive && feederAllowsRing(f.id) && (
                        <span
                          className="ml-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                          title={(RING_BY_FEEDER[f.id] || RING_BY_FEEDER[Number(f.id)])?.partner || "Ring / coupler active"}
                        >
                          · Ring
                        </span>
                      )}
                    </td>
                    <td className="text-center font-bold text-emerald-700 dark:text-emerald-400 py-2.5 font-mono tabular-nums text-sm">
                      {(Math.round((Number(f.mw || 0) + Number.EPSILON) * 10) / 10).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {(record.hasActiveRing ||
          (record.feeders || []).some((f) => f.ringActive)) && (
            <div className="mx-3 mb-2.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200 text-[11px] font-medium">
              33 kV ring line was active on one or more feeders for this reading.
            </div>
          )}

        <div className="px-3 pb-4 grid grid-cols-2 gap-2">
          <div className="bg-teal-50 dark:bg-slate-950/80 rounded-xl h-12 flex items-center justify-between px-3 border border-teal-300 dark:border-teal-500/35">
            <span className="text-xs font-semibold text-teal-800 dark:text-slate-300">
              H3+T3
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-teal-800 dark:text-teal-300">
              {(Math.round((Number(record.bottail11kV || 0) + Number.EPSILON) * 10) / 10).toFixed(1)}{" "}
              <span className="text-[10px] font-medium text-muted">MW</span>
            </span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/45 rounded-xl h-12 flex items-center justify-between px-3 border border-emerald-300 dark:border-emerald-500/35">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              Total
            </span>
            <span className="text-sm font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
              {(Math.round((Number(record.totalMW || 0) + Number.EPSILON) * 10) / 10).toFixed(1)}{" "}
              <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300/80">MW</span>
            </span>
          </div>
        </div>

        {!record.isOffline && record._id && !String(record._id).startsWith("offline-") && (
          <div className="px-3 pb-4">
            {typeof onEdit === "function" ? (
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold tracking-wide shadow-md active:scale-[0.98] transition-all"
              >
                Edit this record
              </button>
            ) : (
              <a
                href={`/manual?edit=${encodeURIComponent(record._id)}`}
                className="w-full inline-flex items-center justify-center h-10 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold tracking-wide shadow-md active:scale-[0.98] transition-all"
              >
                Edit this record
              </a>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}