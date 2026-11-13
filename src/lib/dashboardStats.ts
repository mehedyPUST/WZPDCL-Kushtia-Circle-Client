import { toDayKey, recordSlotLabel } from "./logsheetSlots";
import { SHIFT_META, shiftFromHour } from "./dutyShifts";

export type DashboardFilter = "all" | "today" | "loadshed";

export interface DashboardFeederItem {
  id?: number;
  name?: string;
  bus?: number;
  amps?: number;
  mw?: number;
  lsMW?: number;
  ringActive?: boolean;
}

export interface DashboardCalcRow {
  _id: string;
  totalMW?: number;
  totalLsMW?: number;
  allotment?: number | null;
  bottail11kV?: number;
  busVoltages?: { bus1?: number; bus2?: number };
  feeders?: DashboardFeederItem[];
  hourSlot?: string | null;
  isHourly?: boolean;
  hasActiveRing?: boolean;
  note?: string;
  calculatedAt?: string;
  createdAt?: string;
}

export function todayYmdDhaka(now = new Date()): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function getCurrentShiftInfo(now = new Date()) {
  let hour = now.getUTCHours() + 6;
  if (hour >= 24) hour -= 24;
  let timeLabel = "";
  let dateLabel = "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hVal = parts.find((p) => p.type === "hour")?.value;
    const mVal = parts.find((p) => p.type === "minute")?.value;
    if (hVal != null) hour = Number(hVal);
    if (hVal != null && mVal != null) timeLabel = `${hVal}:${mVal}`;
    dateLabel = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    timeLabel = `${String(hour).padStart(2, "0")}:00`;
    dateLabel = todayYmdDhaka(now);
  }
  const shiftId = shiftFromHour(hour);
  const meta = SHIFT_META[shiftId];
  return {
    id: shiftId,
    label: meta.label,
    window: meta.window,
    timeLabel,
    dateLabel,
    todayYmd: todayYmdDhaka(now),
  };
}

export function recordLoadShedMW(row: DashboardCalcRow): number {
  if (Number.isFinite(Number(row?.totalLsMW)) && Number(row.totalLsMW) > 0) {
    return Math.round(Number(row.totalLsMW) * 10) / 10;
  }
  const feeders = Array.isArray(row?.feeders) ? row.feeders : [];
  let sum = 0;
  for (const f of feeders) {
    const ls = Number(f?.lsMW);
    if (Number.isFinite(ls) && ls > 0) sum += ls;
  }
  return Math.round(sum * 10) / 10;
}

export function formatDhakaDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
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

export interface DashboardMetrics {
  totalMine: number;
  todayCount: number;
  todaySlotsCount: number;
  hourlyCount: number;
  avgMw: string;
  peakMw: string;
  latestMw: string;
  latestLsMw: number;
  latestSlot: string;
  latestRow: DashboardCalcRow | null;
  totalLsEntries: number;
  recentTrend: Array<{
    id: string;
    label: string;
    mw: number;
    lsMw: number;
  }>;
}

export function computeDashboardMetrics(
  rows: DashboardCalcRow[],
  totalMine: number,
  todayYmd = todayYmdDhaka()
): DashboardMetrics {
  const list = Array.isArray(rows) ? rows : [];
  let todayCount = 0;
  let hourlyCount = 0;
  let totalMwSum = 0;
  let peakMwNum = 0;
  let totalLsEntries = 0;
  const todaySlotSet = new Set<string>();

  for (const r of list) {
    const day = toDayKey(r.calculatedAt || r.createdAt || "");
    if (day === todayYmd) {
      todayCount++;
      const sl = recordSlotLabel(r);
      if (sl) todaySlotSet.add(sl);
    }
    if (r.isHourly || r.hourSlot) hourlyCount++;
    const mw = Number(r.totalMW) || 0;
    totalMwSum += mw;
    if (mw > peakMwNum) peakMwNum = mw;
    if (recordLoadShedMW(r) > 0) totalLsEntries++;
  }

  const latestRow = list.length > 0 ? list[0] : null;
  const recentTrend = list
    .slice(0, 7)
    .reverse()
    .map((r, idx) => ({
      id: r._id || String(idx),
      label: r.hourSlot || recordSlotLabel(r) || `#${idx + 1}`,
      mw: Math.round((Number(r.totalMW) || 0) * 10) / 10,
      lsMw: recordLoadShedMW(r),
    }));

  return {
    totalMine: Number(totalMine) || 0,
    todayCount,
    todaySlotsCount: todaySlotSet.size,
    hourlyCount,
    avgMw: list.length > 0 ? (totalMwSum / list.length).toFixed(1) : "—",
    peakMw: list.length > 0 ? peakMwNum.toFixed(1) : "—",
    latestMw: latestRow ? (Number(latestRow.totalMW) || 0).toFixed(1) : "—",
    latestLsMw: latestRow ? recordLoadShedMW(latestRow) : 0,
    latestSlot: latestRow
      ? latestRow.hourSlot || recordSlotLabel(latestRow) || "Manual"
      : "—",
    latestRow,
    totalLsEntries,
    recentTrend,
  };
}

export function filterDashboardRows(
  rows: DashboardCalcRow[],
  {
    filter,
    query,
    todayYmd = todayYmdDhaka(),
  }: {
    filter: DashboardFilter;
    query: string;
    todayYmd?: string;
  }
): DashboardCalcRow[] {
  const list = Array.isArray(rows) ? rows : [];
  const q = String(query || "").trim().toLowerCase();

  return list.filter((r) => {
    if (filter === "today") {
      const day = toDayKey(r.calculatedAt || r.createdAt || "");
      if (day !== todayYmd) return false;
    } else if (filter === "loadshed") {
      if (recordLoadShedMW(r) <= 0) return false;
    }

    if (!q) return true;
    const slot = String(r.hourSlot || "").toLowerCase();
    const note = String(r.note || "").toLowerCase();
    const mw = Number(r.totalMW || 0).toFixed(1);
    const when = formatDhakaDateTime(r.calculatedAt || r.createdAt).toLowerCase();
    return (
      slot.includes(q) ||
      note.includes(q) ||
      mw.includes(q) ||
      when.includes(q)
    );
  });
}
