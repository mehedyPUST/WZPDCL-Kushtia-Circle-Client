"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setViewMode("calculator");
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="w-full max-w-none mx-auto px-2 sm:px-3 lg:px-4 pt-3 pb-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div
          className={`inline-flex rounded-lg border border-app bg-surface-2 p-0.5 shadow-sm ${viewMode !== "logsheet" ? "opacity-40 pointer-events-none" : ""
            }`}
          role="tablist"
          aria-label="Logsheet unit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={unitMode === "mw"}
            onClick={() => setUnitMode("mw")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${unitMode === "mw"
                ? "bg-sky-600 text-white shadow"
                : "text-muted hover:text-app"
              }`}
          >
            MW view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={unitMode === "amps"}
            onClick={() => setUnitMode("amps")}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${unitMode === "amps"
                ? "bg-sky-600 text-white shadow"
                : "text-muted hover:text-app"
              }`}
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
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${viewMode === "calculator"
                ? "bg-emerald-600 text-white shadow"
                : "text-muted hover:text-app"
              }`}
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
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${viewMode === "logsheet"
                ? "bg-emerald-600 text-white shadow"
                : "text-muted hover:text-app"
              }`}
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
          <div className="h-[calc(100dvh-var(--shell-chrome-h,0px)-6.5rem)] md:h-[calc(100dvh-var(--shell-chrome-h,0px)-7rem)] flex flex-col md:flex-row gap-3 overflow-hidden relative">
            {/* LEFT — list */}
            <div className="flex h-full min-w-0 flex-1 basis-0">
              <HistoryList
                open
                pageMode
                onClose={() => { }}
                onView={(r) => {
                  setSelectedRecord(r);
                }}
                onEdit={(r) => {
                  setEditingRecord(r);
                  setSelectedRecord(r);
                }}
                selectedId={selectedRecord?._id}
                refreshKey={refreshKey}
                onDeleted={(id) => {
                  if (id === "__all_trash__" || selectedRecord?._id === id) {
                    setSelectedRecord(null);
                  }
                  if (editingRecord?._id === id) setEditingRecord(null);
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>

            {/* MIDDLE — edit */}
            <div
              className={`hidden md:flex h-full min-w-0 flex-1 basis-0 flex-col ${editingRecord ? "" : "pointer-events-none"
                }`}
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
                <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-app-strong bg-surface-2/40 text-slate-400 text-xs px-4 text-center">
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
              className={`${selectedRecord && !editingRecord ? "flex" : "hidden md:flex"
                } absolute inset-0 z-20 md:static md:z-auto h-full min-w-0 flex-1 basis-0`}
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
                    onEdit={() => setEditingRecord(selectedRecord)}
                  />
                </>
              ) : (
                <div className="hidden md:flex h-full w-full items-center justify-center rounded-xl border border-dashed border-app-strong bg-surface-2/40 text-slate-400 text-sm px-4 text-center">
                  Click View to open details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}