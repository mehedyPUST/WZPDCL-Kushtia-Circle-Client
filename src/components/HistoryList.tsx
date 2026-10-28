"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  fetchCalculations,
  trashCalculation,
  restoreCalculation,
  purgeCalculation,
  bulkCalculations,
  emptyTrash,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import ConfirmModal from "./ConfirmModal";
import SkeletonTable from "./SkeletonTable";
import {
  listPendingAsHistory,
  removePendingSave,
} from "@/lib/offlineQueue";

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

function daysLeftInTrash() {
  return null;
}

export default function HistoryList({
  open,
  onClose,
  onView,
  onEdit,
  selectedId,
  refreshKey,
  onDeleted,
  pageMode = false,
}) {
  const { isAdmin, canWrite } = useAuth();
  const { isAuthenticated } = useAuth();

  const PAGE_SIZE = 50;

  const [folder, setFolder] = useState("inbox");
  const [records, setRecords] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const selectAllRef = useRef(null);

  const isTrash = folder === "trash";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let offline = [];
      try {
        offline = folder === "inbox" ? await listPendingAsHistory() : [];
      } catch {
        offline = [];
      }

      let serverData = [];
      let inboxCount = 0;
      let trashCount = 0;
      let pageTotal = 0;
      let pagePages = 1;
      let pageNum = page;

      const dateOpts = {};
      if (filterDate && filterDateTo && filterDateTo !== filterDate) {
        dateOpts.from = filterDate;
        dateOpts.to = filterDateTo;
      } else if (filterDate) {
        dateOpts.date = filterDate;
      }

      try {
        const result = await fetchCalculations({
          trash: folder === "trash",
          limit: PAGE_SIZE,
          page,
          ...dateOpts,
        });
        serverData = result.data || [];
        inboxCount = result.inboxCount ?? 0;
        trashCount = result.trashCount ?? 0;
        pageTotal = result.total ?? serverData.length;
        pagePages = result.pages ?? 1;
        pageNum = result.page ?? page;
      } catch (err) {
        if (folder === "inbox" && offline.length > 0 && page === 1 && !filterDate) {
          setError("");
        } else {
          setError(err.message || "Could not load");
        }
      }

      if (folder === "inbox" && page === 1 && !filterDate) {
        setRecords([...offline, ...serverData]);
        setInboxCount(inboxCount + offline.length);
        setTrashCount(trashCount);
        setTotal(pageTotal + offline.length);
      } else {
        setRecords(serverData);
        setInboxCount(inboxCount);
        setTrashCount(trashCount);
        setTotal(pageTotal);
      }
      setPages(pagePages);
      if (pageNum !== page) setPage(pageNum);
      setSelected(new Set());
    } catch (err) {
      setError(err.message || "Could not load");
      setRecords([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [folder, page, filterDate, filterDateTo]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    load();
  }, [open, refreshKey, folder, page, filterDate, filterDateTo, load]);

  const filtered = records;

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const someSelected = selected.size > 0;
  const partialSelected = someSelected && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partialSelected;
    }
  }, [partialSelected]);

  const switchFolder = (next) => {
    if (next === folder) return;
    setFolder(next);
    setFilterDate("");
    setFilterDateTo("");
    setPage(1);
    setSelected(new Set());
    setError("");
  };

  const clearDateFilter = () => {
    setFilterDate("");
    setFilterDateTo("");
    setPage(1);
  };

  const applyDate = (fromVal, toVal = "") => {
    setFilterDate(fromVal || "");
    setFilterDateTo(toVal || "");
    setPage(1);
  };

  const toggleOne = (id) => {
    if (!isAuthenticated) {
      toast.error("Please login to select items.");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!isAuthenticated) {
      toast.error("Please login to select items.");
      return;
    }
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r._id)));
  };

  const removeFromLocal = (ids) => {
    const idSet = new Set(ids.map(String));
    setRecords((prev) => prev.filter((r) => !idSet.has(String(r._id))));
    ids.forEach((id) => onDeleted?.(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    setError("");
    try {
      const { type, ids } = confirm;

      if (type === "empty_trash") {
        await emptyTrash();
        const allIds = records.map((r) => r._id);
        setRecords([]);
        setTrashCount(0);
        setSelected(new Set());
        allIds.forEach((id) => onDeleted?.(id));
        onDeleted?.("__all_trash__");
        toast.success("Trash emptied successfully");
      } else if (type === "trash") {
        const offlineIds = ids.filter((id) => String(id).startsWith("offline-"));
        const serverIds = ids.filter((id) => !String(id).startsWith("offline-"));

        for (const oid of offlineIds) {
          const num = Number(String(oid).replace("offline-", ""));
          if (!Number.isNaN(num)) await removePendingSave(num);
        }

        if (serverIds.length === 1) await trashCalculation(serverIds[0]);
        else if (serverIds.length > 1) await bulkCalculations("trash", serverIds);

        removeFromLocal(ids);
        setInboxCount((c) => Math.max(0, c - ids.length));
        if (serverIds.length) {
          setTrashCount((c) => c + serverIds.length);
          toast.success(
            offlineIds.length
              ? `${serverIds.length} moved to trash, ${offlineIds.length} offline removed`
              : `${serverIds.length} item(s) moved to trash`
          );
        } else {
          toast.success(
            offlineIds.length === 1
              ? "Offline save removed"
              : `${offlineIds.length} offline saves removed`
          );
        }
      } else if (type === "restore") {
        if (ids.length === 1) await restoreCalculation(ids[0]);
        else await bulkCalculations("restore", ids);
        removeFromLocal(ids);
        setTrashCount((c) => Math.max(0, c - ids.length));
        setInboxCount((c) => c + ids.length);
        toast.success(`${ids.length} item(s) restored`);
      } else if (type === "purge") {
        if (ids.length === 1) await purgeCalculation(ids[0]);
        else await bulkCalculations("purge", ids);
        removeFromLocal(ids);
        setTrashCount((c) => Math.max(0, c - ids.length));
        toast.success(`${ids.length} item(s) permanently deleted`);
      }

      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || "Action failed");
      toast.error(err.message || "Action failed");
      setConfirm(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(records, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calculations_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export successful");
    } catch {
      toast.error("Export failed");
    }
  };

  if (!open) return null;

  return (
    <>
      <aside
        className={`${pageMode
          ? "w-full h-full flex flex-col bg-surface-2 shadow-xl shrink-0 overflow-hidden rounded-xl border border-app"
          : "w-full sm:w-[440px] xl:w-[480px] h-full flex flex-col bg-surface-2 border-r border-app shadow-2xl shrink-0 overflow-hidden rounded-none md:rounded-2xl md:border md:border-app"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-elevated border-b border-app text-app shrink-0">
          <h2
            className={`text-xs md:text-sm font-semibold tracking-tight ${isTrash ? "text-rose-400" : "text-emerald-400"
              }`}
          >
            {isTrash ? "Trash" : "Saved History"}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              disabled={records.length === 0 || loading}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-surface-3/90 hover:bg-surface-3 text-secondary border border-app active:scale-95 transition-all disabled:opacity-40 whitespace-nowrap"
              aria-label="Export data"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading || busy}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-surface-3/90 hover:bg-surface-3 text-secondary border border-app active:scale-95 transition-all disabled:opacity-40 whitespace-nowrap"
            >
              Refresh
            </button>
            {!pageMode && (
              <button
                type="button"
                onClick={onClose}
                className="text-lg font-bold w-8 h-8 rounded-lg text-muted hover:text-white hover:bg-white/10 active:scale-95 transition-all leading-none"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {!isAuthenticated && (
          <div className="px-3 py-2 bg-amber-950/40 border-b border-amber-500/25 shrink-0">
            <p className="text-[11px] font-medium text-amber-200/90 text-center">
              <span className="font-semibold text-amber-300">Read-only mode.</span> Sign in to manage calculations.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-app shrink-0 bg-elevated/60">
          <button
            type="button"
            onClick={() => switchFolder("inbox")}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${!isTrash
              ? "text-emerald-400 border-b-2 border-emerald-500 bg-surface-2"
              : "text-muted hover:text-secondary hover:bg-surface-2/40"
              }`}
          >
            History
            <span className="ml-1.5 text-[11px] font-mono tabular-nums text-muted">
              ({inboxCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchFolder("trash")}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${isTrash
              ? "text-rose-400 border-b-2 border-rose-500 bg-surface-2"
              : "text-muted hover:text-secondary hover:bg-surface-2/40"
              }`}
          >
            Trash
            <span
              className={`ml-1.5 text-[11px] font-mono tabular-nums ${trashCount > 0 ? "text-rose-400" : "text-faint"
                }`}
            >
              ({trashCount})
            </span>
          </button>
        </div>

        {isTrash && (
          <div className="px-3 py-2 bg-amber-950/35 border-b border-amber-500/20 shrink-0 flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium text-amber-200/85 leading-snug">
              Deleted items stay in Trash until an admin permanently deletes them.
            </p>
            {trashCount > 0 && isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    type: "empty_trash",
                    ids: [],
                    title: "Empty Trash?",
                    message: `Permanently delete all ${trashCount} item(s) in Trash?`,
                  })
                }
                className="shrink-0 text-[10px] font-bold text-rose-400 hover:text-rose-300 underline disabled:opacity-50 whitespace-nowrap"
              >
                Empty trash
              </button>
            )}
          </div>
        )}

        {/* Date filter */}
        <div className="px-3 py-2 bg-elevated/50 border-b border-app shrink-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] font-medium text-muted shrink-0">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => applyDate(e.target.value, filterDateTo)}
              className="flex-1 min-w-[8rem] h-8 px-2 rounded-lg border border-app bg-elevated text-xs font-medium text-app tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500"
              aria-label="Filter from date"
            />
            <span className="text-[11px] font-medium text-faint">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => applyDate(filterDate, e.target.value)}
              min={filterDate || undefined}
              className="flex-1 min-w-[8rem] h-8 px-2 rounded-lg border border-app bg-elevated text-xs font-medium text-app tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500"
              aria-label="Filter to date"
            />
            {(filterDate || filterDateTo) ? (
              <button
                type="button"
                onClick={clearDateFilter}
                className="h-8 px-2.5 rounded-lg text-[11px] font-semibold text-secondary border border-app bg-surface-3 hover:bg-surface-3 transition-all whitespace-nowrap"
              >
                Clear
              </button>
            ) : null}
          </div>
          {filterDate ? (
            <p className="text-[11px] text-muted tabular-nums">
              Showing{" "}
              <span className="font-semibold text-secondary">
                {filterDateTo && filterDateTo !== filterDate
                  ? `${filterDate} → ${filterDateTo}`
                  : filterDate}
              </span>
              {" · "}
              <span className="font-semibold text-emerald-400">{total}</span> record{total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {/* Selection toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-app bg-surface-2 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={filtered.length === 0 || loading || !isAuthenticated}
              className="w-4 h-4 rounded border-slate-600 bg-elevated text-emerald-500 focus:ring-emerald-500/30 disabled:opacity-40"
            />
            <span className="text-[11px] font-medium text-muted tabular-nums">
              {someSelected ? `${selected.size} selected` : "Select all"}
            </span>
          </label>

          <div className="flex-1" />

          {someSelected && !isTrash && isAuthenticated && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  type: "trash",
                  ids: [...selected],
                  title: "Move to Trash?",
                  message: `${selected.size} item(s) will be moved to Trash.`,
                })
              }
              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              Move to Trash
            </button>
          )}

          {someSelected && isTrash && isAuthenticated && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    type: "restore",
                    ids: [...selected],
                    title: "Restore to History?",
                    message: `${selected.size} item(s) will return to History.`,
                  })
                }
                className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                Restore
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    type: "purge",
                    ids: [...selected],
                    title: "Delete forever?",
                    message: `${selected.size} item(s) will be permanently deleted.`,
                  })
                }
                className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-rose-700 text-white hover:bg-rose-600 shadow-sm active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                Delete forever
              </button>
            </div>
          )}
        </div>

        {/* List body */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 relative">
          {loading && (
            <div className="p-3">
              <SkeletonTable rows={8} columns={5} dark />
            </div>
          )}
          {!loading && error && (
            <div className="px-4 py-8 text-center space-y-2">
              <p className="text-sm text-rose-400 font-semibold">{error}</p>
              <button
                type="button"
                onClick={load}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-center text-sm text-muted py-10 font-medium px-4">
              {isTrash
                ? "Trash is empty."
                : filterDate
                  ? "No records for the selected date."
                  : "No saved calculations yet."}
            </p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <table
              className="history-mobile-table history-table w-full"
              style={{
                tableLayout: "fixed",
                minWidth: isAdmin ? 560 : 490,
                borderCollapse: "collapse",
              }}
            >
              <colgroup>
                <col style={{ width: "2.25rem" }} />
                <col style={{ width: "2.75rem" }} />
                <col style={{ width: "5rem" }} />
                <col style={{ width: "var(--time-col-w)" }} />
                {isAdmin ? <col style={{ width: "4.5rem" }} /> : null}
                <col style={{ minWidth: "9rem" }} />
              </colgroup>
              <thead className="history-thead sticky top-0 z-30 shadow-sm">
                <tr className="border-b border-app">
                  <th className="py-2" />
                  <th className="py-2 text-center font-bold text-[10px] border-r border-app/80">
                    #
                  </th>
                  <th className="py-2 text-center font-bold text-[10px] border-r border-app/80">
                    Date
                  </th>
                  <th className="history-time-head py-2.5 px-1 text-center text-[11px] font-mono uppercase tracking-wider font-bold">
                    Time
                  </th>
                  {isAdmin && (
                    <th className="py-2 text-center font-bold text-[10px] border-r border-app/80">
                      By
                    </th>
                  )}
                  <th className="py-2 text-center font-bold text-[10px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, index) => {
                  const { date, time } = splitDateTime(
                    r.createdAt || r.calculatedAt
                  );
                  const isActive = selectedId === r._id;
                  const checked = selected.has(r._id);
                  const left = isTrash ? daysLeftInTrash(r.deletedAt) : null;

                  const rowState = checked
                    ? "selected"
                    : isActive
                      ? "active"
                      : undefined;

                  return (
                    <tr
                      key={r._id}
                      data-row-state={rowState}
                      className="history-row border-b border-app/80"
                    >
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(r._id)}
                          disabled={!isAuthenticated}
                          className="w-4 h-4 rounded border-slate-600 bg-elevated text-emerald-500 focus:ring-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2 text-center text-xs font-semibold text-muted font-mono tabular-nums">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="py-2 text-center text-[10px] font-medium text-secondary tabular-nums">
                        {date}
                        {r.isOffline && (
                          <span className="block text-[9px] font-semibold text-amber-400">
                            Offline
                          </span>
                        )}
                        {(r.hasActiveRing ||
                          (r.feeders || []).some((f) => f.ringActive)) && (
                            <span
                              className="block mt-0.5 text-[9px] font-semibold text-amber-400"
                              title="Ring line active"
                            >
                              Ring
                            </span>
                          )}
                        {isTrash && left != null && (
                          <span
                            className={`block text-[9px] font-semibold ${left <= 3 ? "text-rose-400" : "text-amber-400"
                              }`}
                          >
                            {left === 0 ? "Expires today" : `${left}d left`}
                          </span>
                        )}
                      </td>
                      <td className="history-time-cell py-2.5 px-1 text-center text-xs font-mono font-bold tabular-nums">
                        {time}
                      </td>
                      {isAdmin && (
                        <td
                          className="py-2 text-center text-[9px] font-medium text-muted"
                          title={r.updatedByUsername || r.createdByUsername || ""}
                        >
                          <span className="block truncate px-0.5">
                            {r.updatedByUsername || r.createdByUsername || "—"}
                          </span>
                        </td>
                      )}
                      <td className="py-1.5 px-1">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onView(r)}
                            className="min-w-[2.6rem] px-2 py-1 rounded-md bg-surface-3 hover:bg-surface-3 border border-app text-app text-[10px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                          >
                            View
                          </button>
                          {!isTrash ? (
                            isAuthenticated && canWrite ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof onEdit === "function") onEdit(r);
                                    else if (typeof onView === "function") onView(r);
                                    else window.location.href = `/manual?edit=${encodeURIComponent(r._id)}`;
                                  }}
                                  className="min-w-[2.6rem] px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirm({
                                      type: "trash",
                                      ids: [r._id],
                                      title: "Move to Trash?",
                                      message: `This calculation will move to Trash.`,
                                    })
                                  }
                                  className="min-w-[2.6rem] px-2 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                                >
                                  Trash
                                </button>
                              </>
                            ) : isAuthenticated ? (
                              <span className="text-[10px] font-medium text-faint px-1 whitespace-nowrap">View only</span>
                            ) : (
                              <span className="text-[10px] font-medium text-faint px-1">
                                —
                              </span>
                            )
                          ) : (
                            <>
                              {isAuthenticated ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirm({
                                        type: "restore",
                                        ids: [r._id],
                                        title: "Restore to History?",
                                        message: "This calculation will appear in History again.",
                                      })
                                    }
                                    className="min-w-[2.6rem] px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirm({
                                        type: "purge",
                                        ids: [r._id],
                                        title: "Delete forever?",
                                        message: "This calculation will be permanently deleted.",
                                      })
                                    }
                                    className="min-w-[2.6rem] px-2 py-1 rounded-md bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition-all whitespace-nowrap"
                                  >
                                    Forever
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] font-medium text-amber-400 px-1 whitespace-nowrap">
                                  Sign in
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && pages > 1 && (
          <div className="shrink-0 px-3 py-2 border-t border-app bg-elevated/75 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold border border-app bg-surface-2 text-secondary hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Prev
            </button>
            <p className="text-[11px] font-medium text-muted text-center tabular-nums">
              Page <span className="font-semibold text-app">{page}</span> of{" "}
              <span className="font-semibold text-app">{pages}</span>
              <span className="text-slate-600"> · </span>
              <span className="font-semibold text-secondary">{total}</span> total
            </p>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold border border-app bg-surface-2 text-secondary hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Next
            </button>
          </div>
        )}
        {!loading && !error && pages <= 1 && total > 0 && (
          <div className="shrink-0 px-3 py-1.5 border-t border-app bg-elevated/75 text-center text-[11px] font-medium text-muted tabular-nums">
            {total} record{total === 1 ? "" : "s"}
          </div>
        )}
      </aside>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || "Confirm"}
        message={confirm?.message || ""}
        confirmLabel={
          confirm?.type === "restore"
            ? "Restore"
            : confirm?.type === "purge" || confirm?.type === "empty_trash"
              ? "Delete forever"
              : "Move to Trash"
        }
        cancelLabel="Cancel"
        danger={confirm?.type !== "restore"}
        loading={busy}
        onConfirm={runConfirmed}
        onCancel={() => !busy && setConfirm(null)}
      />
    </>
  );
}