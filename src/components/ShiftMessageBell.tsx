"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Forward,
  Loader2,
  MessageSquarePlus,
  Send,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  acknowledgeStationNote,
  createStationNote,
  fetchStationNotes,
  forwardStationNote,
  markStationNoteRead,
} from "@/lib/api";
import { SHIFT_META, type ShiftId } from "@/lib/dutyShifts";

type ReadReceipt = {
  userId?: string | null;
  username?: string;
  displayName?: string;
  shift?: string;
  readAt?: string | null;
};

type ShiftMessage = {
  id: string;
  content: string;
  createdByUsername?: string;
  createdByDisplayName?: string;
  dutyDay?: string;
  fromShift?: string;
  targetShift?: string;
  status: string;
  acknowledgedBy?: string | null;
  acknowledgedByUsername?: string;
  acknowledgedByDisplayName?: string;
  acknowledgedAt?: string | null;
  forwardNote?: string;
  readReceipts?: ReadReceipt[];
  createdAt?: string | null;
};

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function shiftLabel(s?: string) {
  if (!s) return "—";
  const meta = SHIFT_META[s as ShiftId];
  return meta?.label || `${s} Shift`;
}

export default function ShiftMessageBell() {
  const { admin, isAuthenticated, canWrite, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentShift, setCurrentShift] = useState("");
  const [nextShift, setNextShift] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingAction, setActingAction] = useState<"ack" | "read" | "forward" | null>(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [forwardNote, setForwardNote] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPanelPos({
      top: Math.round(r.bottom + 8),
      right: Math.round(Math.max(8, window.innerWidth - r.right)),
    });
  }, []);

  const canPost = isAuthenticated && (canWrite || isAdmin);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await fetchStationNotes({ limit: 20 });
      setMessages(data.messages || []);
      setPendingCount(Number(data.pendingCount) || 0);
      setCurrentShift(data.currentShift || "");
      setNextShift(data.nextShift || "");
    } catch {
      /* quiet on poll */
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [isAuthenticated, load]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPos();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
      setComposeOpen(false);
      setForwardId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setComposeOpen(false);
        setForwardId(null);
      }
    };
    const onReposition = () => updatePanelPos();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPos]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error("Write something first");
      return;
    }
    try {
      setSending(true);
      await createStationNote(text);
      setDraft("");
      setComposeOpen(false);
      toast.success(`Message left for ${shiftLabel(nextShift || "next")}`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleAck = async (id: string) => {
    try {
      setActingId(id);
      setActingAction("ack");
      await acknowledgeStationNote(id);
      toast.success("Acknowledged & read receipt logged");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to acknowledge");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      setActingId(id);
      setActingAction("read");
      await markStationNoteRead(id);
      toast.success("Read receipt confirmed");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to confirm read receipt");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  };

  const handleForward = async (id: string) => {
    try {
      setActingId(id);
      setActingAction("forward");
      await forwardStationNote(id, forwardNote);
      setForwardId(null);
      setForwardNote("");
      toast.success("Forwarded to next shift");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to forward");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  };

  const hasCurrentUserRead = (m: ShiftMessage) => {
    const uid = admin?.id ? String(admin.id) : "";
    const uname = admin?.username ? String(admin.username).toLowerCase() : "";
    const receipts = m.readReceipts || [];
    if (
      receipts.some((r) => {
        if (uid && r.userId && String(r.userId) === uid) return true;
        if (uname && r.username && r.username.toLowerCase() === uname) return true;
        return false;
      })
    ) {
      return true;
    }
    if (uid && m.acknowledgedBy && String(m.acknowledgedBy) === uid) return true;
    if (
      uname &&
      m.acknowledgedByUsername &&
      m.acknowledgedByUsername.toLowerCase() === uname
    ) {
      return true;
    }
    return false;
  };

  if (!isAuthenticated) return null;

  const panel = open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Station Notes"
          className="fixed w-[min(22.5rem,calc(100vw-1rem))] max-h-[min(30rem,75vh)] flex flex-col rounded-xl border border-app shadow-2xl overflow-hidden bg-elevated"
          style={{
            top: panelPos.top,
            right: panelPos.right,
            zIndex: 99999,
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-app bg-surface-2 shrink-0">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-app">
                Station Notes
              </div>
              <div className="text-[11px] text-muted truncate">
                Now: {shiftLabel(currentShift)} · Next: {shiftLabel(nextShift)}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canPost && (
                <button
                  type="button"
                  onClick={() => {
                    setComposeOpen((v) => !v);
                    setForwardId(null);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-accent hover:bg-accent/15 border border-accent/25 transition"
                  title="Leave a note for the next shift"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  New
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted hover:text-app hover:bg-surface-3"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {composeOpen && canPost && (
            <div className="px-3 py-2.5 border-b border-app bg-surface-2/80 space-y-2 shrink-0">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={`Note for ${shiftLabel(nextShift)}…`}
                className="w-full rounded-lg border border-app bg-surface px-2.5 py-2 text-[12px] text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted tabular-nums">
                  {draft.length}/2000
                </span>
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={handleSend}
                  className="btn-primary inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50 transition"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send to next shift
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted text-[12px]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : messages.length === 0 ? (
              <div className="py-10 px-4 text-center text-[12px] text-muted">
                No station notes yet.
                {canPost && (
                  <div className="mt-1">
                    Use <strong className="text-app">New</strong> to leave a
                    message for the next shift.
                  </div>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-app">
                {messages.map((m) => {
                  const pending = m.status === "pending";
                  const isActing = actingId === m.id;
                  const receipts = m.readReceipts || [];
                  const userHasRead = hasCurrentUserRead(m);
                  return (
                    <li
                      key={m.id}
                      className={`px-3 py-2.5 ${
                        pending ? "bg-amber-500/10" : "bg-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-app truncate">
                            {m.createdByDisplayName ||
                              m.createdByUsername ||
                              "Operator"}
                            {m.fromShift ? (
                              <span className="ml-1.5 text-[10px] font-medium text-muted">
                                · {shiftLabel(m.fromShift)}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-muted">
                            {formatWhen(m.createdAt)}
                            {m.targetShift
                              ? ` → ${shiftLabel(m.targetShift)}`
                              : ""}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            pending
                              ? "bg-amber-500/20 text-amber-900 dark:text-amber-100 border-amber-500/40"
                              : m.status === "forwarded"
                                ? "bg-sky-500/15 text-sky-900 dark:text-sky-100 border-sky-500/35"
                                : "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-emerald-500/35"
                          }`}
                        >
                          {pending
                            ? "Pending"
                            : m.status === "forwarded"
                              ? "Forwarded"
                              : "Acked"}
                        </span>
                      </div>
                      <p className="text-[12px] text-app whitespace-pre-wrap break-words leading-relaxed">
                        {m.content}
                      </p>
                      {m.forwardNote && (
                        <div className="mt-1.5 rounded-md border border-app bg-surface-2 px-2 py-1 text-[11px] text-secondary">
                          <span className="font-semibold text-app">Forward remark: </span>
                          {m.forwardNote}
                        </div>
                      )}
                      {!pending && m.acknowledgedByDisplayName && (
                        <div className="mt-1 text-[10px] text-muted">
                          {m.status === "forwarded" ? "Forwarded" : "Acked"} by{" "}
                          {m.acknowledgedByDisplayName}
                          {m.acknowledgedAt
                            ? ` · ${formatWhen(m.acknowledgedAt)}`
                            : ""}
                        </div>
                      )}
                      {receipts.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                          <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">
                            Read by{" "}
                            {receipts
                              .map((r) => r.displayName || r.username || "Officer")
                              .join(", ")}
                          </span>
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {pending && (
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => handleAck(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-emerald-600/40 text-emerald-900 dark:text-emerald-100 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50"
                          >
                            {isActing && actingAction === "ack" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Acknowledge
                          </button>
                        )}
                        {!userHasRead ? (
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => handleMarkRead(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-app text-secondary hover:text-app bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                          >
                            {isActing && actingAction === "read" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCheck className="w-3 h-3 text-accent" />
                            )}
                            Confirm Read
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 px-1">
                            <CheckCheck className="w-3 h-3" />
                            Read
                          </span>
                        )}
                        {pending && (
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => {
                              setForwardId((cur) =>
                                cur === m.id ? null : m.id
                              );
                              setForwardNote("");
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-sky-600/40 text-sky-900 dark:text-sky-100 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50"
                          >
                            <Forward className="w-3 h-3" />
                            Forward
                          </button>
                        )}
                      </div>

                      {forwardId === m.id && (
                        <div className="mt-2 space-y-1.5 rounded-lg border border-app bg-surface-2 p-2">
                          <input
                            type="text"
                            value={forwardNote}
                            onChange={(e) => setForwardNote(e.target.value)}
                            maxLength={500}
                            placeholder="Optional note for next shift…"
                            className="w-full rounded-md border border-app bg-surface px-2 py-1.5 text-[11px] text-app placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setForwardId(null);
                                setForwardNote("");
                              }}
                              className="px-2 py-1 text-[11px] text-muted hover:text-app"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleForward(m.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
                            >
                              {isActing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Forward className="w-3 h-3" />
                              )}
                              Forward to next
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-app px-3 py-2 bg-surface-2 shrink-0">
            <Link
              href="/station-notes"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-accent hover:underline py-1"
            >
              Open full station notes page
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) load();
          }}
          className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border shadow-sm transition-all ${
            pendingCount > 0
              ? "border-amber-600 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200 hover:bg-amber-200/90 dark:hover:bg-amber-500/25"
              : "border-app bg-white text-slate-700 hover:text-slate-900 hover:border-accent/50 hover:bg-slate-50 dark:bg-surface-2 dark:text-secondary dark:hover:text-app dark:hover:border-accent/40 dark:hover:bg-surface-3"
          }`}
          title={
            pendingCount > 0
              ? `${pendingCount} pending station note${pendingCount === 1 ? "" : "s"}`
              : "Station Notes"
          }
          aria-label="Station Notes"
          aria-expanded={open}
        >
          <Bell className={`w-4 h-4 ${pendingCount > 0 ? "animate-pulse" : ""}`} />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-white dark:ring-[var(--app-bg,#0b1220)]">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </button>
      </div>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
