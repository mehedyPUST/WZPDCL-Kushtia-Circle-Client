"use client";

export default function ConfirmModal({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel?.();
      }}
    >
      <div
        className={`w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden bg-gradient-to-br ${
          danger
            ? "from-rose-50/90 via-white to-rose-50/40 border-rose-200 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-rose-500/25"
            : "from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25"
        }`}
      >
        <div className="px-5 pt-5 pb-3">
          <h3
            id="confirm-title"
            className="text-base font-semibold text-app tracking-tight"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm text-secondary leading-relaxed">
            {message}
          </p>
        </div>
        <div
          className={`px-5 py-4 flex gap-3 justify-end border-t ${
            danger
              ? "bg-rose-50/65 dark:bg-rose-950/35 border-rose-200/80 dark:border-rose-500/20"
              : "bg-emerald-50/60 dark:bg-teal-950/35 border-emerald-200/80 dark:border-teal-500/20"
          }`}
        >
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-secondary bg-surface-2 border border-app hover:bg-surface-3 active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm active:scale-[0.97] transition-all duration-150 ease-out cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${ danger ? "bg-rose-600 hover:bg-rose-500 hover:shadow-md hover:shadow-rose-600/25" : "btn-primary hover:opacity-95 hover:shadow-md" }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}