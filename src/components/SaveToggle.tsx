"use client";

export default function SaveToggle({ saveToDb, onChange }) {
  return (
    <div className="px-2 md:px-4 pb-2">
      <label
        htmlFor="save-toggle"
        className={`flex items-center gap-3 cursor-pointer select-none rounded-xl border px-3 py-2.5 transition-colors ${
          saveToDb
            ? "bg-emerald-50 border-emerald-400"
            : "bg-slate-50 border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="relative flex-shrink-0">
          <input
            id="save-toggle"
            type="checkbox"
            checked={saveToDb}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-slate-300 peer-checked:bg-emerald-600 rounded-full transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className={`text-xs md:text-sm font-bold ${
              saveToDb ? "text-emerald-800" : "text-slate-600"
            }`}
          >
            {saveToDb ? "Save to database" : "Calculate only (no save)"}
          </span>
          <span className="text-[10px] md:text-xs text-slate-400 font-medium">
            {saveToDb
              ? "Result will be stored in MongoDB Atlas when you calculate"
              : "Results stay on this device only"}
          </span>
        </div>
      </label>
    </div>
  );
}
