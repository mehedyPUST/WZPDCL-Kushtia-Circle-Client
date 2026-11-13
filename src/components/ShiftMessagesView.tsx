"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  Check,
  Forward,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  acknowledgeStationNote,
  createStationNote,
  fetchStationNotes,
  forwardStationNote,
} from "@/lib/api";
import { SHIFT_META, type ShiftId } from "@/lib/dutyShifts";

type ShiftMessage = {
  id: string;
  content: string;
  createdByUsername?: string;
  createdByDisplayName?: string;
  dutyDay?: string;
  fromShift?: string;
  targetShift?: string;
  status: string;
  acknowledgedByDisplayName?: string;
  acknowledgedAt?: string | null;
  forwardNote?: string;
  createdAt?: string | null;
};

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

function StatusPill({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/35">
        Pending
      </span>
    );
  }
  if (status === "forwarded") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-sky-500/15 text-sky-800 dark:text-sky-200 border border-sky-500/35">
        Forwarded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/35">
      Acknowledged
    </span>
  );
}

export default function ShiftMessagesView() {
  const { isAuthenticated, canWrite, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentShift, setCurrentShift] = useState("");
  const [nextShift, setNextShift] = useState("");
  const [dutyDay, setDutyDay] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [forwardNote, setForwardNote] = useState("");
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const canPost = isAuthenticated && (canWrite || isAdmin);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await fetchStationNotes({ limit: 40 });
      setMessages(data.messages || []);
      setPendingCount(Number(data.pendingCount) || 0);
      setCurrentShift(data.currentShift || "");
      setNextShift(data.nextShift || "");
      setDutyDay(data.dutyDay || "");
    } catch (err: any) {
      toast.error(err?.message || "Could not load station notes");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load]);

  const visible = useMemo(() => {
    if (filter === "pending") return messages.filter((m) => m.status === "pending");
    return messages;
  }, [messages, filter]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error("Write a station note first");
      return;
    }
    try {
      setSending(true);
      await createStationNote(text);
      setDraft("");
      toast.success(`Note left for ${shiftLabel(nextShift || "next shift")}`);
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
      await acknowledgeStationNote(id);
      toast.success("Message acknowledged");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to acknowledge");
    } finally {
      setActingId(null);
    }
  };

  const handleForward = async (id: string) => {
    try {
      setActingId(id);
      await forwardStationNote(id, forwardNote);
      setForwardId(null);
      setForwardNote("");
      toast.success("Forwarded to next shift");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to forward");
    } finally {
      setActingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-lg mx-auto mt-16 px-4 text-center">
        <MessageSquare className="w-10 h-10 text-muted mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-app">Station Notes</h1>
        <p className="text-sm text-muted mt-2">
          Sign in to leave or acknowledge messages for the next duty shift.
        </p>
        <Link
          href="/login"
          className="inline-flex mt-4 btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted text-[12px] mb-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 hover:text-accent transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent shrink-0" />
            Station Notes
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Leave operational notes for the incoming shift. Duty staff acknowledge
            or forward as needed.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-app text-secondary hover:text-app hover:bg-surface-3/60 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Shift context cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-app bg-elevated/80 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Current shift
          </div>
          <div className="text-[15px] font-bold text-app mt-0.5">
            {shiftLabel(currentShift)}
          </div>
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Next shift
          </div>
          <div className="text-[15px] font-bold text-app mt-0.5">
            {shiftLabel(nextShift)}
          </div>
        </div>
        <div className="rounded-xl border border-app bg-elevated/80 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Duty day · Pending
          </div>
          <div className="text-[15px] font-bold text-app mt-0.5 flex items-center gap-2">
            <span className="font-mono text-[13px]">{dutyDay || "—"}</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.35rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                {pendingCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Compose */}
      {canPost && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-app bg-elevated shadow-sm overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-app bg-surface-2/50 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h2 className="text-[13px] font-semibold text-app">
              Note for next shift
            </h2>
            <span className="text-[11px] text-muted ml-auto">
              → {shiftLabel(nextShift)}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim() && !sending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={4}
              maxLength={2000}
              placeholder="e.g. Feeder-7 still on restricted load. Allotment reduced after 18:00. Inform circle if MW exceeds 12.5…"
              className="w-full rounded-lg border border-app bg-surface px-3 py-2.5 text-[13px] text-app placeholder:text-muted/80 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/50 resize-y min-h-[6rem]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted tabular-nums">
                {draft.length} / 2000
              </span>
              <button
                type="button"
                disabled={sending || !draft.trim()}
                onClick={handleSend}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed shadow-sm transition"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send to {shiftLabel(nextShift)}
              </button>
            </div>
          </div>
        </motion.section>
      )}

      {/* Filters + list */}
      <section className="rounded-xl border border-app bg-elevated shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-app bg-surface-2/50 flex items-center gap-2 flex-wrap">
          <h2 className="text-[13px] font-semibold text-app mr-auto">Messages</h2>
          <div className="inline-flex rounded-lg border border-app p-0.5 bg-surface-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                filter === "all"
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-app"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                filter === "pending"
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : "text-muted hover:text-app"
              }`}
            >
              Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          </div>
        </div>

        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-muted text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading messages…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-14 px-4 text-center text-[13px] text-muted">
            {filter === "pending"
              ? "No pending station notes."
              : "No station notes yet. Leave a note for the incoming shift above."}
          </div>
        ) : (
          <ul className="divide-y divide-app">
            {visible.map((m) => {
              const pending = m.status === "pending";
              const isActing = actingId === m.id;
              return (
                <li
                  key={m.id}
                  className={`px-4 py-3.5 ${
                    pending ? "bg-amber-500/[0.06]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-app truncate">
                        {m.createdByDisplayName ||
                          m.createdByUsername ||
                          "Operator"}
                        {m.fromShift ? (
                          <span className="ml-1.5 text-[11px] font-medium text-muted">
                            · {shiftLabel(m.fromShift)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {formatWhen(m.createdAt)}
                        {m.targetShift ? ` → ${shiftLabel(m.targetShift)}` : ""}
                      </div>
                    </div>
                    <StatusPill status={m.status} />
                  </div>

                  <p className="text-[13px] text-app/95 whitespace-pre-wrap break-words leading-relaxed mt-1">
                    {m.content}
                  </p>

                  {!pending && m.acknowledgedByDisplayName && (
                    <div className="mt-1.5 text-[11px] text-muted">
                      {m.status === "forwarded" ? "Forwarded" : "Acknowledged"} by{" "}
                      {m.acknowledgedByDisplayName}
                      {m.acknowledgedAt ? ` · ${formatWhen(m.acknowledgedAt)}` : ""}
                    </div>
                  )}

                  {pending && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => handleAck(m.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-emerald-600/40 text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                      >
                        {isActing && forwardId !== m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        disabled={isActing}
                        onClick={() => {
                          setForwardId((cur) => (cur === m.id ? null : m.id));
                          setForwardNote("");
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-sky-600/40 text-sky-800 dark:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-50 transition"
                      >
                        <Forward className="w-3.5 h-3.5" />
                        Forward to next
                      </button>
                    </div>
                  )}

                  {forwardId === m.id && (
                    <div className="mt-3 rounded-lg border border-app bg-surface-2/60 p-3 space-y-2">
                      <label className="block text-[11px] font-medium text-muted">
                        Optional note for the following shift
                      </label>
                      <input
                        type="text"
                        value={forwardNote}
                        onChange={(e) => setForwardNote(e.target.value)}
                        maxLength={500}
                        placeholder="e.g. Still unresolved — please check with circle"
                        className="w-full rounded-md border border-app bg-surface px-2.5 py-2 text-[12px] text-app placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForwardId(null);
                            setForwardNote("");
                          }}
                          className="px-2.5 py-1.5 text-[12px] text-muted hover:text-app"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleForward(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
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
  );
}
