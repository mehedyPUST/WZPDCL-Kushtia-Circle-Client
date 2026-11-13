"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import HistoryList from "./HistoryList";
import HistoryDetail from "./HistoryDetail";
import LogsheetView from "./LogsheetView";
import HistoryCalculatorEdit from "./HistoryCalculatorEdit";

export default function HistoryPage() {
  const [viewMode, setViewMode] = useState("logsheet");
  const [unitMode, setUnitMode] = useState("mw");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const calcGridRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [listWidthPx, setListWidthPx] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const resetListWidth = useCallback(() => {
    setListWidthPx(null);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("calculator");
    }
  }, []);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const leftEl = leftPaneRef.current;
    const containerEl = calcGridRef.current;
    if (!leftEl || !containerEl) return;

    e.preventDefault();
    dragCleanupRef.current?.();

    const startX = e.clientX;
    const startW = leftEl.getBoundingClientRect().width;
    const containerW = containerEl.getBoundingClientRect().width;
    const minW = 280;
    const maxW = Math.max(420, containerW - 360);

    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const next = Math.round(
        Math.min(maxW, Math.max(minW, startW + (moveEvent.clientX - startX)))
      );
      setListWidthPx(next);
    };

    const stopResize = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResize);
      dragCleanupRef.current = null;
      setIsResizing(false);
    };

    dragCleanupRef.current = stopResize;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopResize);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex-1 flex flex-col min-h-0 w-full"
    >
      <div className="w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div
          className={`inline-flex rounded-lg border border-app bg-surface-2 p-0.5 shadow-sm ${viewMode !== "logsheet" ? "opacity-40 pointer-events-none" : "" }`}
          role="tablist"
          aria-label="Logsheet unit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={unitMode === "mw"}
            onClick={() => setUnitMode("mw")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${unitMode === "mw" ? "bg-blue-600 text-white shadow shadow-blue-900/30" : "text-muted hover:text-app" }`}
          >
            MW view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unitMode === "amps"}
            onClick={() => setUnitMode("amps")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${unitMode === "amps" ? "bg-blue-600 text-white shadow shadow-blue-900/30" : "text-muted hover:text-app" }`}
          >
            Amps view
          </button>
        </div>

        <div
          className="inline-flex rounded-lg border border-app bg-surface-2 p-0.5 shadow-sm"
          role="tablist"
          aria-label="History view mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "calculator"}
            onClick={() => setViewMode("calculator")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${viewMode === "calculator" ? "btn-primary shadow" : "text-muted hover:text-app" }`}
          >
            Calculator view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "logsheet"}
            onClick={() => {
              setViewMode("logsheet");
              setEditingRecord(null);
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${viewMode === "logsheet" ? "btn-primary shadow" : "text-muted hover:text-app" }`}
          >
            Logsheet view
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 pb-2">
        {viewMode === "logsheet" ? (
          <div className="h-[calc(100dvh-var(--shell-chrome-h,0px)-6.5rem)] md:h-[calc(100dvh-var(--shell-chrome-h,0px)-7rem)]">
            <LogsheetView refreshKey={refreshKey} unitMode={unitMode} />
          </div>
        ) : (
          <div
            ref={calcGridRef}
            className={`h-[calc(100dvh-var(--shell-chrome-h,0px)-6.5rem)] md:h-[calc(100dvh-var(--shell-chrome-h,0px)-7rem)] flex flex-col md:flex-row gap-3 md:gap-0 overflow-hidden relative ${isResizing ? "select-none cursor-col-resize" : ""}`}
          >
            {/* LEFT — list */}
            <div
              ref={leftPaneRef}
              style={
                listWidthPx !== null
                  ? ({ "--history-list-w": `${listWidthPx}px` } as CSSProperties)
                  : undefined
              }
              className={`flex h-full min-w-0 ${
                listWidthPx !== null
                  ? "flex-1 basis-0 md:flex-none md:basis-auto md:w-[var(--history-list-w)]"
                  : "flex-1 basis-0"
              } ${!isResizing ? "md:transition-[width] md:duration-150 md:ease-out" : ""}`}
            >
              <HistoryList
                open
                pageMode
                onClose={() => { }}
                onView={(r) => {
                  setSelectedRecord(r);
                }}
                onEdit={(r) => {
                  resetListWidth();
                  setEditingRecord(r);
                  setSelectedRecord(r);
                }}
                onDeleteAction={resetListWidth}
                selectedId={selectedRecord?._id}
                refreshKey={refreshKey}
                onDeleted={(id) => {
                  resetListWidth();
                  if (id === "__all_trash__" || selectedRecord?._id === id) {
                    setSelectedRecord(null);
                  }
                  if (editingRecord?._id === id) setEditingRecord(null);
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>

            {/* Desktop drag splitter */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize history list panel"
              title="Drag to resize history list · Double-click to reset"
              onMouseDown={handleResizeStart}
              onDoubleClick={resetListWidth}
              className="hidden md:flex w-3 shrink-0 cursor-col-resize items-center justify-center group select-none"
            >
              <div
                className={`w-1 h-12 rounded-full transition-colors ${
                  isResizing
                    ? "bg-accent"
                    : "bg-app-strong/60 group-hover:bg-accent"
                }`}
              />
            </div>

            {/* MIDDLE — edit */}
            <div
              className={`hidden md:flex h-full min-w-0 flex-1 basis-0 flex-col ${editingRecord ? "" : "pointer-events-none" }`}
            >
              {editingRecord ? (
                <div className="h-full min-h-0 flex flex-col rounded-xl border border-app bg-surface overflow-hidden shadow-xl">
                  <HistoryCalculatorEdit
                    key={editingRecord._id}
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSaved={(saved) => {
                      setRefreshKey((k) => k + 1);
                      if (saved) {
                        setSelectedRecord(saved);
                        setEditingRecord((prev) =>
                          prev ? { ...prev, ...saved } : saved
                        );
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-app-strong bg-surface-2/40 text-muted text-xs px-4 text-center">
                  Select Edit on a record to modify feeder readings
                </div>
              )}
            </div>

            {/* Mobile edit overlay */}
            {editingRecord && (
              <div className="md:hidden absolute inset-0 z-30 flex flex-col bg-surface rounded-xl overflow-hidden shadow-2xl border border-app">
                <HistoryCalculatorEdit
                  key={`m-${editingRecord._id}`}
                  record={editingRecord}
                  onClose={() => setEditingRecord(null)}
                  onSaved={(saved) => {
                    setRefreshKey((k) => k + 1);
                    if (saved) {
                      setSelectedRecord(saved);
                      setEditingRecord((prev) =>
                        prev ? { ...prev, ...saved } : saved
                      );
                    }
                    setEditingRecord(null);
                  }}
                />
              </div>
            )}

            {/* RIGHT — view detail */}
            <div
              className={`${selectedRecord && !editingRecord ? "flex" : "hidden md:flex" } absolute inset-0 z-20 md:static md:z-auto h-full min-w-0 flex-1 basis-0 md:ml-3`}
            >
              {selectedRecord ? (
                <>
                  <div
                    className="flex-1 bg-elevated/70 backdrop-blur-[1px] md:hidden"
                    onClick={() => setSelectedRecord(null)}
                    aria-hidden
                  />
                  <HistoryDetail
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                    onEdit={() => {
                      resetListWidth();
                      setEditingRecord(selectedRecord);
                    }}
                  />
                </>
              ) : (
                <div className="hidden md:flex h-full w-full items-center justify-center rounded-xl border border-dashed border-app-strong bg-surface-2/40 text-muted text-sm px-4 text-center">
                  Click View to open details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}