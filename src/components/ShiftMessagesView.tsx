"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Flag,
  Forward,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
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

type NotePriority = "normal" | "high" | "critical";

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

type FilterTab = "all" | "pending" | "acknowledged" | "forwarded";
type PriorityFilter = "all" | "urgent";

const PRIORITY_OPTIONS: {
  id: NotePriority;
  label: string;
  hint: string;
}[] = [
  { id: "normal", label: "Normal", hint: "Routine shift handover note" },
  { id: "high", label: "High", hint: "Important feeder or operational instruction" },
  { id: "critical", label: "Critical", hint: "Urgent fault, protection trip, or grid directive" },
];

const SHIFT_ORDER: ShiftId[] = ["A", "B", "C"];

const QUICK_TEMPLATES = [
  {
    label: "Restricted feeder",
    text: "Feeder restriction active: ",
  },
  {
    label: "Voltage / tap note",
    text: "Bus voltage / tap position observation: ",
  },
  {
    label: "Circle instruction",
    text: "Circle control instruction: ",
  },
];

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function shiftLabel(s?: string) {
  if (!s) return "—";
  const meta = SHIFT_META[s as ShiftId];
  return meta?.label || `${s} Shift`;
}

function shiftWindow(s?: string) {
  if (!s) return "—";
  const meta = SHIFT_META[s as ShiftId];
  return meta?.window || "Operational window";
}

function PriorityLabel({ priority }: { priority?: string }) {
  const p = (priority || "normal").toLowerCase();
  if (p === "critical") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 shrink-0 whitespace-nowrap">
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
        Critical
      </span>
    );
  }
  if (p === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 shrink-0 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        High Priority
      </span>
    );
  }
  return null;
}

function StatusLabel({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0 whitespace-nowrap">
        <Clock3 className="w-3.5 h-3.5 shrink-0" />
        Pending sign-off
      </span>
    );
  }
  if (status === "forwarded") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 shrink-0 whitespace-nowrap">
        <Forward className="w-3.5 h-3.5 shrink-0" />
        Forwarded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      Acknowledged
    </span>
  );
}

export default function ShiftMessagesView() {
  const {
    admin,
    isAuthenticated,
    canWrite,
    isAdmin,
    loading: authLoading,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentShift, setCurrentShift] = useState("");
  const [nextShift, setNextShift] = useState("");
  const [selectedTargetShift, setSelectedTargetShift] = useState<ShiftId | "">("");
  const [priority, setPriority] = useState<NotePriority>("normal");
  const [dutyDay, setDutyDay] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingAction, setActingAction] = useState<"ack" | "read" | "forward" | null>(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [forwardNote, setForwardNote] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [query, setQuery] = useState("");

  const canPost = isAuthenticated && (canWrite || isAdmin);
  const canHandleNotes = isAuthenticated && (canWrite || isAdmin);

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

  const load = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) return;
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setLoadError("");
        const data = await fetchStationNotes({ limit: 50 });
        setMessages(data.messages || []);
        setPendingCount(Number(data.pendingCount) || 0);
        setCurrentShift(data.currentShift || "");
        setNextShift(data.nextShift || "");
        setDutyDay(data.dutyDay || "");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Could not load station notes";
        setLoadError(msg);
        if (!silent) toast.error(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load]);

  const effectiveTargetShift = (selectedTargetShift || nextShift || "B") as ShiftId;

  const counts = useMemo(() => {
    let pending = 0;
    let acknowledged = 0;
    let forwarded = 0;
    let urgent = 0;
    let pendingUrgent = 0;
    for (const m of messages) {
      if (m.status === "pending") pending += 1;
      else if (m.status === "forwarded") forwarded += 1;
      else acknowledged += 1;

      const isUrgent = m.priority === "high" || m.priority === "critical";
      if (isUrgent) {
        urgent += 1;
        if (m.status === "pending") pendingUrgent += 1;
      }
    }
    return {
      all: messages.length,
      pending: Math.max(pending, pendingCount),
      acknowledged,
      forwarded,
      urgent,
      pendingUrgent,
    };
  }, [messages, pendingCount]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter !== "all" && m.status !== filter) return false;
      if (
        priorityFilter === "urgent" &&
        m.priority !== "high" &&
        m.priority !== "critical"
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        m.content,
        m.forwardNote,
        m.priority,
        m.createdByDisplayName,
        m.createdByUsername,
        m.acknowledgedByDisplayName,
        m.fromShift,
        m.targetShift,
        m.dutyDay,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [messages, filter, priorityFilter, query]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error("Write a station note first");
      return;
    }
    try {
      setSending(true);
      await createStationNote(text, effectiveTargetShift, priority);
      setDraft("");
      setSelectedTargetShift("");
      setPriority("normal");
      toast.success(`Handover note sent to ${shiftLabel(effectiveTargetShift)}`);
      await load(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleAck = async (id: string) => {
    try {
      setActingId(id);
      setActingAction("ack");
      await acknowledgeStationNote(id);
      toast.success("Note acknowledged & read receipt logged");
      await load(true);
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
      const res = await markStationNoteRead(id);
      toast.success(
        res?.alreadyRead ? "Read receipt already recorded" : "Read receipt confirmed"
      );
      await load(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm read receipt");
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
      await load(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to forward");
    } finally {
      setActingId(null);
      setActingAction(null);
    }
  };

  const applyTemplate = (prefix: string) => {
    setDraft((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return prefix;
      return `${prev.trimEnd()}\n${prefix}`;
    });
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div className="h-24 rounded-xl bg-surface border border-app animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-surface border border-app animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 h-72 rounded-xl bg-surface border border-app animate-pulse" />
          <div className="lg:col-span-7 h-96 rounded-xl bg-surface border border-app animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto mt-16 px-4">
        <div className="rounded-xl border border-app bg-surface p-6 text-center shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-surface-2 border border-app flex items-center justify-center mx-auto mb-3 text-muted">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold text-app tracking-tight">
            Station Handover Notes
          </h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            Sign in with your operator account to read, acknowledge, or record shift handover notes.
          </p>
          <Link
            href="/login"
            className="inline-flex mt-5 btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-5">
      {/* Page Header */}
      <header className="rounded-xl border border-app bg-surface p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-muted mb-1.5"
            >
              <Link
                href="/dashboard"
                className="hover:text-accent transition-colors font-medium whitespace-nowrap"
              >
                Dashboard
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-secondary font-medium">Station Notes</span>
            </nav>
            <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight">
              Station Handover Notes
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
              Operational handover log between shifts at Bottail 33/11 kV Substation. Incoming duty staff acknowledge or forward pending items.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-app bg-surface-2 text-secondary hover:text-app hover:bg-surface-3 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading || refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* 4-Column Shift Context Strip */}
      <section
        aria-label="Shift handover summary"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="rounded-xl border border-app bg-surface p-4">
          <p className="text-xs font-medium text-muted">Current Shift</p>
          <p className="mt-1.5 text-lg sm:text-xl font-bold text-app tracking-tight">
            {shiftLabel(currentShift)}
          </p>
          <p className="mt-1 text-xs text-muted font-mono tabular-nums">
            {shiftWindow(currentShift)} BST
          </p>
        </div>

        <div className="rounded-xl border border-app bg-surface p-4">
          <p className="text-xs font-medium text-muted">Incoming Shift</p>
          <p className="mt-1.5 text-lg sm:text-xl font-bold text-accent tracking-tight">
            {shiftLabel(nextShift)}
          </p>
          <p className="mt-1 text-xs text-muted font-mono tabular-nums">
            {shiftWindow(nextShift)} BST
          </p>
        </div>

        <div className="rounded-xl border border-app bg-surface p-4">
          <p className="text-xs font-medium text-muted">Operational Duty Day</p>
          <p className="mt-1.5 text-lg sm:text-xl font-bold text-app font-mono tabular-nums tracking-tight">
            {dutyDay || "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Asia/Dhaka shift calendar
          </p>
        </div>

        <div className="rounded-xl border border-app bg-surface p-4">
          <p className="text-xs font-medium text-muted">Pending Handovers</p>
          <p
            className={`mt-1.5 text-lg sm:text-xl font-bold font-mono tabular-nums tracking-tight ${
              counts.pendingUrgent > 0
                ? "text-rose-600 dark:text-rose-400"
                : pendingCount > 0
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-emerald-600 dark:text-emerald-300"
            }`}
          >
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-muted">
            {counts.pendingUrgent > 0
              ? `${counts.pendingUrgent} high/critical · ${pendingCount} awaiting sign-off`
              : pendingCount > 0
                ? `${pendingCount} awaiting sign-off`
                : "All notes acknowledged"}
          </p>
        </div>
      </section>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Compose Handover Panel */}
        {canPost && (
          <section
            aria-label="Compose station note"
            className="lg:col-span-5 lg:sticky lg:top-4 rounded-xl border border-app bg-surface overflow-hidden shadow-sm"
          >
            <div className="px-4 sm:px-5 py-3.5 border-b border-app flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-app">
                  New Handover Note
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Delivered to incoming shift log &amp; notification bell
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Priority segmented selector */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-medium text-secondary">
                    Priority Flag
                  </label>
                  <span className="text-xs text-muted">
                    {PRIORITY_OPTIONS.find((p) => p.id === priority)?.hint}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-2 border border-app">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const active = priority === opt.id;
                    let activeStyle =
                      "bg-surface text-app shadow-sm border border-app";
                    if (active && opt.id === "high") {
                      activeStyle =
                        "bg-amber-100 text-amber-950 border border-amber-500/60 shadow-sm dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/60";
                    } else if (active && opt.id === "critical") {
                      activeStyle =
                        "bg-rose-600 text-white border border-rose-700 shadow-sm dark:bg-rose-600 dark:text-white dark:border-rose-500";
                    }
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPriority(opt.id)}
                        className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? activeStyle
                            : "text-secondary hover:text-app hover:bg-surface-3/60 border border-transparent"
                        }`}
                      >
                        {opt.id === "critical" ? (
                          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                        ) : opt.id === "high" ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Flag className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target shift segmented selector */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-medium text-secondary">
                    Target Shift
                  </label>
                  <span className="text-xs text-muted font-mono tabular-nums">
                    {shiftWindow(effectiveTargetShift)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-2 border border-app">
                  {SHIFT_ORDER.map((sid) => {
                    const active = effectiveTargetShift === sid;
                    const isNext = nextShift === sid;
                    return (
                      <button
                        key={sid}
                        type="button"
                        onClick={() => setSelectedTargetShift(sid)}
                        className={`px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? "btn-primary shadow-sm"
                            : "text-secondary hover:text-app hover:bg-surface-3/60"
                        }`}
                      >
                        {shiftLabel(sid)}
                        {isNext && !active ? " · Next" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick operational templates */}
              <div>
                <span className="block text-xs font-medium text-secondary mb-1.5">
                  Quick Templates
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl.text)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-app bg-surface-2 text-secondary hover:text-app hover:border-accent/40 transition-colors whitespace-nowrap"
                    >
                      + {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message textarea */}
              <div>
                <label
                  htmlFor="station-note-draft"
                  className="block text-xs font-medium text-secondary mb-1.5"
                >
                  Operational Message
                </label>
                <textarea
                  id="station-note-draft"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.metaKey || e.ctrlKey) &&
                      e.key === "Enter" &&
                      draft.trim() &&
                      !sending
                    ) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe feeder restrictions, relay flags, circle allotment adjustments, or equipment checks for the incoming operator..."
                  className="w-full rounded-lg border border-app bg-surface-2/60 px-3.5 py-2.5 text-sm text-app placeholder:text-muted/80 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 resize-y min-h-[8rem] leading-relaxed"
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="font-mono tabular-nums">
                    {draft.length} / 2000
                  </span>
                  <span>Ctrl / ⌘ + Enter to send</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {(draft.trim() || priority !== "normal") && (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      setDraft("");
                      setPriority("normal");
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-secondary hover:text-app hover:bg-surface-2 border border-app transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={sending || !draft.trim()}
                  onClick={handleSend}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-45 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send to {shiftLabel(effectiveTargetShift)}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Handover Log Feed */}
        <section
          aria-label="Station handover log"
          className={`${
            canPost ? "lg:col-span-7" : "lg:col-span-12"
          } rounded-xl border border-app bg-surface overflow-hidden shadow-sm`}
        >
          {/* Log Header + Filter Controls */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-app space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-app">
                  Handover Log
                </h2>
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  {visible.length} of {messages.length} entries shown
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter handover notes by status"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface-2 border border-app"
              >
                {(
                  [
                    { id: "all", label: "All", count: counts.all },
                    { id: "pending", label: "Pending", count: counts.pending },
                    {
                      id: "acknowledged",
                      label: "Acked",
                      count: counts.acknowledged,
                    },
                    {
                      id: "forwarded",
                      label: "Forwarded",
                      count: counts.forwarded,
                    },
                  ] as const
                ).map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.id)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? "bg-surface text-app shadow-sm border border-app"
                          : "text-muted hover:text-app"
                      }`}
                    >
                      {tab.label}
                      <span className="ml-1.5 font-mono tabular-nums text-[11px] opacity-80">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search bar + Priority quick filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by note content, priority, operator name, shift, or duty day..."
                  className="w-full rounded-lg border border-app bg-surface-2/60 pl-9 pr-9 py-2 text-xs sm:text-sm text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted hover:text-app"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setPriorityFilter((cur) => (cur === "all" ? "urgent" : "all"))
                }
                aria-pressed={priorityFilter === "urgent"}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  priorityFilter === "urgent"
                    ? "border-rose-500/50 bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200"
                    : "border-app bg-surface-2 text-secondary hover:text-app hover:bg-surface-3"
                }`}
                title="Show only High and Critical priority notes"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>High / Critical</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  {counts.urgent}
                </span>
              </button>
            </div>
          </div>

          {loadError && (
            <div className="px-4 sm:px-5 py-3 border-b border-app bg-rose-500/10 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-200">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => load()}
                className="px-2.5 py-1 rounded border border-rose-500/40 font-semibold hover:bg-rose-500/15 whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          )}

          {loading && messages.length === 0 ? (
            <div className="divide-y divide-app">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 sm:p-5 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-4 w-44 rounded bg-surface-2" />
                    <div className="h-4 w-24 rounded bg-surface-2" />
                  </div>
                  <div className="h-3 w-56 rounded bg-surface-2" />
                  <div className="h-12 w-full rounded bg-surface-2" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-surface-2 border border-app flex items-center justify-center mx-auto text-muted">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-app">
                  {query.trim()
                    ? "No matching station notes"
                    : filter === "pending"
                      ? "No pending handovers"
                      : `No ${filter === "all" ? "" : `${filter} `}station notes found`}
                </p>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  {query.trim() || filter !== "all"
                    ? "Try clearing your search or switching back to all handover notes."
                    : "Use the compose panel to leave the first operational note for the incoming shift."}
                </p>
              </div>
              {(query.trim() || filter !== "all" || priorityFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                    setPriorityFilter("all");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-app bg-surface-2 text-app hover:bg-surface-3 transition-colors"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-app">
              {visible.map((m) => {
                const pending = m.status === "pending";
                const notePriority = (m.priority || "normal").toLowerCase();
                const isCritical = notePriority === "critical";
                const isHigh = notePriority === "high";
                const isActing = actingId === m.id;
                const authorName =
                  m.createdByDisplayName || m.createdByUsername || "Operator";
                const userHasRead = hasCurrentUserRead(m);
                const receipts = m.readReceipts || [];

                const rowColorClass = isCritical
                  ? "bg-rose-50/90 hover:bg-rose-100/75 dark:bg-rose-500/[0.11] dark:hover:bg-rose-500/[0.16] ring-1 ring-inset ring-rose-300 dark:ring-rose-500/35"
                  : isHigh
                    ? "bg-amber-50/85 hover:bg-amber-100/70 dark:bg-amber-500/[0.09] dark:hover:bg-amber-500/[0.14] ring-1 ring-inset ring-amber-300 dark:ring-amber-500/30"
                    : pending
                      ? "bg-surface-2/50 hover:bg-surface-2"
                      : "hover:bg-surface-2/40";

                return (
                  <li
                    key={m.id}
                    className={`p-4 sm:p-5 transition-colors ${rowColorClass}`}
                  >
                    {/* Top Author + Routing Row (unboxed metadata with separators) */}
                    <div className="flex flex-wrap items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-app">
                          <span className="truncate">{authorName}</span>
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
                                    {shiftLabel(m.targetShift)}
                                  </>
                                )}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted font-mono tabular-nums">
                          <span>{formatWhen(m.createdAt)} BST</span>
                          {m.dutyDay && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Duty Day {m.dutyDay}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <PriorityLabel priority={m.priority} />
                        {(isCritical || isHigh) && (
                          <span aria-hidden="true" className="text-muted text-xs">
                            ·
                          </span>
                        )}
                        <StatusLabel status={m.status} />
                      </div>
                    </div>

                    {/* Note Body */}
                    <p className="mt-3 text-sm text-app whitespace-pre-wrap break-words leading-relaxed">
                      {m.content}
                    </p>

                    {/* Forward Handover Remark (if forwarded with a note) */}
                    {m.forwardNote && (
                      <div className="mt-3 rounded-lg border border-app bg-surface-2/70 px-3 py-2 text-xs text-secondary">
                        <span className="font-semibold text-app">
                          Forward remark:{" "}
                        </span>
                        {m.forwardNote}
                      </div>
                    )}

                    {/* Audit Sign-off & Read Receipts Trail */}
                    {(!pending && m.acknowledgedByDisplayName) || receipts.length > 0 ? (
                      <div className="mt-3 pt-2.5 border-t border-app/60 space-y-1">
                        {!pending && m.acknowledgedByDisplayName && (
                          <p className="text-xs text-muted font-mono tabular-nums">
                            {m.status === "forwarded" ? "Forwarded" : "Acknowledged"} by{" "}
                            <span className="font-sans font-medium text-secondary">
                              {m.acknowledgedByDisplayName}
                            </span>
                            {m.acknowledgedAt
                              ? ` · ${formatWhen(m.acknowledgedAt)} BST`
                              : ""}
                          </p>
                        )}
                        {receipts.length > 0 && (
                          <div className="flex items-start gap-1.5 text-xs text-muted">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <p className="leading-relaxed">
                              <span className="font-medium text-secondary">
                                Read by ({receipts.length}):{" "}
                              </span>
                              {receipts.map((r, idx) => (
                                <span key={`${r.username || r.displayName}-${idx}`}>
                                  {idx > 0 && (
                                    <span aria-hidden="true" className="mx-1.5 text-muted">
                                      ·
                                    </span>
                                  )}
                                  <span className="text-app font-medium">
                                    {r.displayName || r.username || "Officer"}
                                  </span>
                                  {r.shift && (
                                    <span className="text-muted">
                                      {" "}
                                      ({shiftLabel(r.shift)})
                                    </span>
                                  )}
                                  {r.readAt && (
                                    <span className="font-mono tabular-nums text-[11px] text-muted">
                                      {" "}
                                      {formatWhen(r.readAt)}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Officer Read Receipt & Handover Actions */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                      {pending && canHandleNotes && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleAck(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-600/35 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
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
                          title="Record a timestamped read receipt confirming you read this note"
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

                      {pending && canHandleNotes && (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => {
                            setForwardId((cur) => (cur === m.id ? null : m.id));
                            setForwardNote("");
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-600/35 text-sky-800 bg-sky-50 hover:bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          Forward to next shift
                        </button>
                      )}
                    </div>

                    {/* Inline Forward Form */}
                    {forwardId === m.id && (
                      <div className="mt-3 rounded-lg border border-app bg-surface-2/80 p-3 space-y-2.5">
                        <label className="block text-xs font-medium text-secondary">
                          Optional handover remark for the next shift
                        </label>
                        <input
                          type="text"
                          value={forwardNote}
                          onChange={(e) => setForwardNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isActing) {
                              e.preventDefault();
                              handleForward(m.id);
                            } else if (e.key === "Escape") {
                              setForwardId(null);
                              setForwardNote("");
                            }
                          }}
                          maxLength={500}
                          placeholder="e.g. Unresolved — follow up with Kushtia circle desk"
                          className="w-full rounded-lg border border-app bg-surface px-3 py-2 text-xs text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForwardId(null);
                              setForwardNote("");
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-app hover:bg-surface-3 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => handleForward(m.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {isActing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Forward className="w-3.5 h-3.5" />
                            )}
                            Confirm forward
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
