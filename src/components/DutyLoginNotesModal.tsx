"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Forward,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  acknowledgeStationNote,
  fetchStationNotes,
  forwardStationNote,
  markStationNoteRead,
} from "@/lib/api";
import { SHIFT_META, type ShiftId } from "@/lib/dutyShifts";

const DUTY_NOTES_PENDING_KEY = "wzpdcl_duty_notes_login_pending";
const DUTY_NOTES_DISMISSED_KEY = "wzpdcl_duty_notes_login_dismissed";
const PENDING_STALE_MS = 10 * 60 * 1000;

type NotePriority = "normal" | "high" | "critical";

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
  priority?: NotePriority;
  acknowledgedBy?: string | null;
  acknowledgedByUsername?: string;
  acknowledgedByDisplayName?: string;
  acknowledgedAt?: string | null;
  forwardNote?: string;
  readReceipts?: ReadReceipt[];
  createdAt?: string | null;
};

type ModalFilter = "actionable" | "all";

function shiftLabel(s?: string) {
  if (!s) return "—";
  const meta = SHIFT_META[s as ShiftId];
  return meta?.label || `${s} Shift`;
}

function shiftWindow(s?: string) {
  if (!s) return "";
  const meta = SHIFT_META[s as ShiftId];
  return meta?.window || "";
}

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

function priorityRank(p?: string) {
  const val = (p || "normal").toLowerCase();
  if (val === "critical") return 3;
  if (val === "high") return 2;
  return 1;
}

function dispatchNotesUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wzpdcl:station-notes-updated"));
  }
}

export default function DutyLoginNotesModal() {
  const pathname = usePathname();
  const {
    admin,
    isAuthenticated,
    loading: authLoading,
    role,
    shiftLogoutAt,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [currentShift, setCurrentShift] = useState("");
  const [nextShift, setNextShift] = useState("");
  const [dutyDay, setDutyDay] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [filterMode, setFilterMode] = useState<ModalFilter>("actionable");

  const [actingId, setActingId] = useState<string | null>(null);
  const [actingAction, setActingAction] = useState<
    "ack" | "read" | "forward" | "read-all" | null
  >(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [forwardNote, setForwardNote] = useState("");

  const checkingRef = useRef(false);

  const sessionKey = useMemo(() => {
    const uname = admin?.username ? String(admin.username).toLowerCase() : "";
    if (!uname) return "";
    return `${uname}::${shiftLogoutAt || "active"}`;
  }, [admin?.username, shiftLogoutAt]);

  const hasCurrentUserRead = useCallback(
    (m: ShiftMessage) => {
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
    },
    [admin?.id, admin?.username]
  );

  const markDismissedForSession = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
      if (sessionKey) {
        window.sessionStorage.setItem(DUTY_NOTES_DISMISSED_KEY, sessionKey);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [sessionKey]);

  const handleClose = useCallback(() => {
    markDismissedForSession();
    setOpen(false);
    setForwardId(null);
    setForwardNote("");
  }, [markDismissedForSession]);

  const refreshNotes = useCallback(async () => {
    const data = await fetchStationNotes({ limit: 30 });
    setMessages(data.messages || []);
    setCurrentShift(data.currentShift || "");
    setNextShift(data.nextShift || "");
    setDutyDay(data.dutyDay || "");
    setPendingCount(Number(data.pendingCount) || 0);
    return data;
  }, []);

  const evaluateDutyLoginNotes = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (authLoading || !isAuthenticated || role !== "duty") return;
    if (!admin?.username || checkingRef.current) return;

    let rawPending: string | null = null;
    try {
      rawPending = window.sessionStorage.getItem(DUTY_NOTES_PENDING_KEY);
    } catch {
      return;
    }
    if (!rawPending) return;

    let pendingMeta: { username?: string; ts?: number } | null = null;
    try {
      pendingMeta = JSON.parse(rawPending);
    } catch {
      pendingMeta = null;
    }

    const uname = String(admin.username).toLowerCase();
    if (!pendingMeta || (pendingMeta.username && pendingMeta.username !== uname)) {
      return;
    }
    if (pendingMeta.ts && Date.now() - pendingMeta.ts > PENDING_STALE_MS) {
      window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
      return;
    }

    try {
      const dismissedFor = window.sessionStorage.getItem(DUTY_NOTES_DISMISSED_KEY);
      if (sessionKey && dismissedFor === sessionKey) {
        window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
        return;
      }
    } catch {
      /* ignore */
    }

    // Never stack a duplicate modal when already landing directly on /station-notes
    if (pathname === "/station-notes" || pathname.startsWith("/station-notes/")) {
      markDismissedForSession();
      return;
    }

    // Wait briefly if login route transition is still on /login
    if (pathname === "/login" || pathname.startsWith("/login/")) {
      return;
    }

    checkingRef.current = true;
    setNotesLoading(true);
    try {
      window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
      const data = await refreshNotes();
      const list: ShiftMessage[] = data.messages || [];
      const actionable = list.filter(
        (m) => m.status === "pending" || !hasCurrentUserRead(m)
      );

      if (actionable.length > 0 || Number(data.pendingCount) > 0) {
        setFilterMode("actionable");
        setOpen(true);
      } else {
        markDismissedForSession();
        const activeLabel = shiftLabel(data.currentShift);
        toast.success(
          `${activeLabel} handover clear — no pending or unread station notes`,
          { id: "duty-notes-clear", duration: 3800 }
        );
      }
    } catch {
      // Do not block operator sign-in if notes endpoint is temporarily unreachable
      markDismissedForSession();
    } finally {
      setNotesLoading(false);
      checkingRef.current = false;
    }
  }, [
    authLoading,
    isAuthenticated,
    role,
    admin?.username,
    sessionKey,
    pathname,
    refreshNotes,
    hasCurrentUserRead,
    markDismissedForSession,
  ]);

  useEffect(() => {
    evaluateDutyLoginNotes();
  }, [evaluateDutyLoginNotes]);

  useEffect(() => {
    const onDutyLogin = () => {
      // Slight delay allows router.replace("/") from /login or modal close to settle
      window.setTimeout(() => {
        evaluateDutyLoginNotes();
      }, 60);
    };
    const onDutyLogout = () => {
      setOpen(false);
      setMessages([]);
      setForwardId(null);
      setForwardNote("");
    };
    const onNotesUpdated = () => {
      if (open && isAuthenticated) {
        refreshNotes().catch(() => {});
      }
    };
    window.addEventListener("wzpdcl:duty-login", onDutyLogin);
    window.addEventListener("wzpdcl:duty-logout", onDutyLogout);
    window.addEventListener("wzpdcl:station-notes-updated", onNotesUpdated);
    return () => {
      window.removeEventListener("wzpdcl:duty-login", onDutyLogin);
      window.removeEventListener("wzpdcl:duty-logout", onDutyLogout);
      window.removeEventListener("wzpdcl:station-notes-updated", onNotesUpdated);
    };
  }, [evaluateDutyLoginNotes, open, isAuthenticated, refreshNotes]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const pDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (pDiff !== 0) return pDiff;

      const aPending = a.status === "pending" ? 1 : 0;
      const bPending = b.status === "pending" ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;

      const aForShift = currentShift && a.targetShift === currentShift ? 1 : 0;
      const bForShift = currentShift && b.targetShift === currentShift ? 1 : 0;
      if (aForShift !== bForShift) return bForShift - aForShift;

      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [messages, currentShift]);

  const actionableMessages = useMemo(() => {
    return sortedMessages.filter(
      (m) => m.status === "pending" || !hasCurrentUserRead(m)
    );
  }, [sortedMessages, hasCurrentUserRead]);

  const stats = useMemo(() => {
    let unread = 0;
    let criticalPending = 0;
    let highPending = 0;
    let pendingTotal = 0;
    for (const m of messages) {
      if (!hasCurrentUserRead(m)) unread += 1;
      if (m.status === "pending") {
        pendingTotal += 1;
        if (m.priority === "critical") criticalPending += 1;
        else if (m.priority === "high") highPending += 1;
      }
    }
    return {
      unread,
      criticalPending,
      highPending,
      pendingTotal: Math.max(pendingTotal, pendingCount),
    };
  }, [messages, pendingCount, hasCurrentUserRead]);

  const visibleMessages =
    filterMode === "actionable" ? actionableMessages : sortedMessages;

  const handleAck = async (id: string) => {
    try {
      setActingId(id);
      setActingAction("ack");
      await acknowledgeStationNote(id);
      toast.success("Note acknowledged & read receipt logged");
      await refreshNotes();
      dispatchNotesUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
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
      await refreshNotes();
      dispatchNotesUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm read");
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
      await refreshNotes();
      dispatchNotesUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to forward");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  };

  const handleReadAllUnread = async () => {
    const unreadIds = messages
      .filter((m) => !hasCurrentUserRead(m))
      .map((m) => m.id);
    if (!unreadIds.length) return;
    try {
      setActingAction("read-all");
      await Promise.all(unreadIds.map((id) => markStationNoteRead(id)));
      toast.success(`Confirmed read receipt for ${unreadIds.length} note${unreadIds.length === 1 ? "" : "s"}`);
      await refreshNotes();
      dispatchNotesUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not confirm all read receipts");
    } finally {
      setActingAction(null);
    }
  };

  if (!isAuthenticated || role !== "duty") return null;

  const hasUrgent = stats.criticalPending > 0 || stats.highPending > 0;
  const headerTone =
    stats.criticalPending > 0
      ? "border-rose-200/80 dark:border-rose-500/25 bg-rose-50/75 dark:bg-rose-950/35"
      : hasUrgent || stats.pendingTotal > 0
        ? "border-orange-200/80 dark:border-amber-500/20 bg-orange-50/75 dark:bg-amber-950/35"
        : "border-emerald-200/80 dark:border-teal-500/20 bg-emerald-50/60 dark:bg-teal-950/35";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duty-login-notes-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-2xl max-h-[min(88dvh,46rem)] flex flex-col rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div
              className={`px-4 sm:px-5 py-3.5 border-b shrink-0 flex items-start justify-between gap-3 ${headerTone}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-1">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-app">
                    <BellRing
                      className={`w-3.5 h-3.5 shrink-0 ${
                        stats.criticalPending > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : stats.pendingTotal > 0
                            ? "text-orange-600 dark:text-amber-300"
                            : "text-emerald-700 dark:text-teal-300"
                      }`}
                    />
                    Duty Handover Briefing
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-secondary">
                    {shiftLabel(currentShift)}
                    {shiftWindow(currentShift)
                      ? ` (${shiftWindow(currentShift)} BST)`
                      : ""}
                  </span>
                  {dutyDay && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{dutyDay}</span>
                    </>
                  )}
                </div>

                <h2
                  id="duty-login-notes-title"
                  className="text-base sm:text-lg font-bold text-app tracking-tight"
                >
                  Station Notes for Incoming Duty Officer
                </h2>

                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-secondary tabular-nums">
                  <span>
                    Officer:{" "}
                    <strong className="text-app">
                      {admin?.displayName || admin?.username}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <span
                    className={
                      stats.pendingTotal > 0
                        ? "font-semibold text-orange-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-teal-300 font-medium"
                    }
                  >
                    {stats.pendingTotal} Pending
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <span className="font-medium text-app">
                    {stats.unread} Unread by you
                  </span>
                  {stats.criticalPending > 0 && (
                    <>
                      <span aria-hidden="true" className="text-muted">
                        ·
                      </span>
                      <span className="font-bold text-rose-700 dark:text-rose-300">
                        {stats.criticalPending} Critical
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-white/70 dark:hover:bg-surface-3 transition-colors shrink-0"
                aria-label="Close station notes briefing"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Quick Action Strip */}
            <div className="px-4 sm:px-5 py-2.5 border-b border-emerald-200/70 dark:border-teal-500/20 bg-white/60 dark:bg-[#0f1726]/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div
                role="tablist"
                aria-label="Filter briefing notes"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-white/80 dark:bg-[#0f1726]/80 border border-emerald-200/80 dark:border-teal-500/25"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterMode === "actionable"}
                  onClick={() => setFilterMode("actionable")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterMode === "actionable"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm dark:bg-teal-500/20 dark:text-teal-100 dark:border-teal-400/40"
                      : "text-muted hover:text-app border border-transparent"
                  }`}
                >
                  Action Required
                  <span className="ml-1.5 font-mono tabular-nums text-[11px] opacity-85">
                    {actionableMessages.length}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterMode === "all"}
                  onClick={() => setFilterMode("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterMode === "all"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm dark:bg-teal-500/20 dark:text-teal-100 dark:border-teal-400/40"
                      : "text-muted hover:text-app border border-transparent"
                  }`}
                >
                  All Recent
                  <span className="ml-1.5 font-mono tabular-nums text-[11px] opacity-85">
                    {sortedMessages.length}
                  </span>
                </button>
              </div>

              {stats.unread > 1 && (
                <button
                  type="button"
                  disabled={actingAction === "read-all"}
                  onClick={handleReadAllUnread}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200/80 dark:border-teal-500/30 bg-white/85 dark:bg-surface-2 text-emerald-800 dark:text-teal-200 hover:bg-emerald-50 dark:hover:bg-teal-950/60 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {actingAction === "read-all" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Confirm Read All ({stats.unread})
                </button>
              )}
            </div>

            {/* Notes List */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {notesLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking incoming station notes…
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="py-12 px-6 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-teal-950/60 border border-emerald-200 dark:border-teal-500/30 flex items-center justify-center mx-auto text-emerald-700 dark:text-teal-300">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-app">
                    All station notes reviewed for this shift
                  </p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    You have no remaining unread or pending items. Switch to All Recent or continue to your workspace.
                  </p>
                </div>
              ) : (
                <ul className="p-3.5 sm:p-4 space-y-4 bg-white/60 dark:bg-[#09101d]/60">
                  {visibleMessages.map((m, idx) => {
                    const pending = m.status === "pending";
                    const p = (m.priority || "normal").toLowerCase();
                    const isCritical = p === "critical";
                    const isHigh = p === "high";
                    const isEven = idx % 2 === 0;
                    const isForCurrentShift =
                      Boolean(currentShift) && m.targetShift === currentShift;
                    const userHasRead = hasCurrentUserRead(m);
                    const isActing = actingId === m.id;
                    const receipts = m.readReceipts || [];

                    const rowTone = isCritical
                      ? isEven
                        ? "bg-gradient-to-br from-rose-50/95 via-white to-rose-50/45 border-rose-300 dark:from-rose-950/50 dark:via-[#0f1726] dark:to-rose-950/25 dark:border-rose-500/45"
                        : "bg-gradient-to-br from-rose-100/75 via-white to-rose-50/50 border-rose-300 dark:from-rose-950/65 dark:via-[#0f1726] dark:to-rose-950/35 dark:border-rose-500/50"
                      : isHigh
                        ? isEven
                          ? "bg-gradient-to-br from-amber-50/95 via-white to-amber-50/45 border-amber-300 dark:from-amber-950/45 dark:via-[#0f1726] dark:to-amber-950/25 dark:border-amber-500/40"
                          : "bg-gradient-to-br from-orange-50/95 via-white to-orange-50/45 border-orange-300 dark:from-orange-950/40 dark:via-[#0f1726] dark:to-amber-950/25 dark:border-orange-500/40"
                        : isEven
                          ? "bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/45 border-emerald-200 dark:from-teal-950/45 dark:via-[#0f1726] dark:to-teal-950/25 dark:border-teal-500/30"
                          : "bg-gradient-to-br from-blue-50/85 via-white to-sky-50/45 border-blue-200 dark:from-sky-950/40 dark:via-[#0f1726] dark:to-sky-950/25 dark:border-sky-500/30";

                    return (
                      <li key={m.id} className={`rounded-xl border p-4 shadow-xs space-y-2.5 ${rowTone}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-app">
                              <span className="truncate">
                                {m.createdByDisplayName ||
                                  m.createdByUsername ||
                                  "Operator"}
                              </span>
                              {m.fromShift && (
                                <>
                                  <span aria-hidden="true" className="text-muted font-normal">
                                    ·
                                  </span>
                                  <span className="text-xs font-medium text-secondary inline-flex items-center gap-1">
                                    {shiftLabel(m.fromShift)}
                                    {m.targetShift && (
                                      <>
                                        <ArrowRight className="w-3 h-3 text-muted" />
                                        <span
                                          className={
                                            isForCurrentShift
                                              ? "font-semibold text-accent"
                                              : ""
                                          }
                                        >
                                          {shiftLabel(m.targetShift)}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted font-mono tabular-nums">
                              <span>{formatWhen(m.createdAt)} BST</span>
                              {m.dutyDay && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Duty Day {m.dutyDay}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 text-xs shrink-0">
                            {isCritical && (
                              <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-300">
                                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                Critical
                              </span>
                            )}
                            {isHigh && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                High Priority
                              </span>
                            )}
                            {(isCritical || isHigh) && (
                              <span aria-hidden="true" className="text-muted">
                                ·
                              </span>
                            )}
                            {pending ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                                <Clock3 className="w-3.5 h-3.5 shrink-0" />
                                Pending sign-off
                              </span>
                            ) : m.status === "forwarded" ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
                                <Forward className="w-3.5 h-3.5 shrink-0" />
                                Forwarded
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Acknowledged
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-app whitespace-pre-wrap break-words leading-relaxed">
                          {m.content}
                        </p>

                        {m.forwardNote && (
                          <div className="rounded-lg border border-app bg-surface-2/75 px-3 py-2 text-xs text-secondary">
                            <span className="font-semibold text-app">
                              Forward remark:{" "}
                            </span>
                            {m.forwardNote}
                          </div>
                        )}

                        {receipts.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">
                              Read by{" "}
                              {receipts
                                .map((r) => r.displayName || r.username || "Officer")
                                .join(", ")}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {pending && (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleAck(m.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-600/35 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {isActing && actingAction === "ack" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Acknowledge
                            </button>
                          )}

                          {!userHasRead ? (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleMarkRead(m.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-app bg-surface-2 text-secondary hover:text-app hover:border-accent/40 hover:bg-surface-3 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {isActing && actingAction === "read" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5 text-accent" />
                              )}
                              Confirm Read
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 px-1 py-1 whitespace-nowrap">
                              <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                              Read confirmed
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-600/35 text-sky-800 bg-sky-50 hover:bg-sky-100 dark:text-sky-200 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              <Forward className="w-3.5 h-3.5" />
                              Forward
                            </button>
                          )}
                        </div>

                        {forwardId === m.id && (
                          <div className="rounded-lg border border-app bg-surface-2/80 p-3 space-y-2">
                            <input
                              type="text"
                              value={forwardNote}
                              onChange={(e) => setForwardNote(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !isActing) {
                                  e.preventDefault();
                                  handleForward(m.id);
                                }
                              }}
                              maxLength={500}
                              placeholder="Optional handover remark for next shift…"
                              className="w-full rounded-lg border border-app bg-surface px-3 py-1.5 text-xs text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setForwardId(null);
                                  setForwardNote("");
                                }}
                                className="px-2.5 py-1 rounded-md text-xs font-medium text-secondary hover:text-app hover:bg-surface-3"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleForward(m.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
                              >
                                {isActing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Forward className="w-3 h-3" />
                                )}
                                Confirm Forward
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

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-emerald-200/80 dark:border-teal-500/20 bg-emerald-50/60 dark:bg-teal-950/35 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
              <Link
                href="/station-notes"
                onClick={handleClose}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-200/80 dark:border-teal-500/30 bg-white/85 dark:bg-surface-2 text-emerald-800 dark:text-teal-200 hover:bg-emerald-50 dark:hover:bg-teal-950/60 transition-colors whitespace-nowrap"
              >
                Open Full Station Notes
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={handleClose}
                className="btn-primary px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap"
              >
                {actionableMessages.length === 0
                  ? "Continue to Workspace"
                  : "Continue to Shift"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
