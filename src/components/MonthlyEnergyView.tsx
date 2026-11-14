"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchMonthlyEnergySheet, saveMonthlyEnergySheet } from "@/lib/api";
import { FEEDERS } from "@/lib/constants";
import ConfirmModal from "./ConfirmModal";

type SheetKind = "33kv" | "11kv" | "auxiliary";

type MeterReading = {
  meterOwner: string;
  kwh: number | null;
  kvarh: number | null;
  avgPf: number | null;
  rowColor: string;
  /** When true, show peak / off-peak sub-rows under total for KWH & Kvarh */
  hasPeakOffPeak?: boolean;
  peakKwh?: number | null;
  offPeakKwh?: number | null;
  peakKvarh?: number | null;
  offPeakKvarh?: number | null;
};

type FeederBlock = {
  feederId: number;
  feederName: string;
  category: SheetKind;
  meters: MeterReading[];
  maxLoadMw: number | null;
  maxLoadDate: string;
  maxLoadTime: string;
  interruptionCount: number | null;
  interruptionMinutes: number | null;
  totalLsMinutes: number | null;
  /** user-added (not from core FEEDERS list) */
  custom?: boolean;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHEET_TABS: { id: SheetKind; label: string; hint: string }[] = [
  {
    id: "33kv",
    label: "33 kV Feeders",
    hint: "Outgoing 33 kV · H-3 / T-3 · PDB & WZPDCL meters",
  },
  {
    id: "11kv",
    label: "11 kV Feeders",
    hint: "11 kV outgoing feeders · WZPDCL meter by default",
  },
  {
    id: "auxiliary",
    label: "Auxiliary",
    hint: "Station auxiliary supply & local consumption",
  },
];

function categoryForFeederId(id: number): SheetKind {
  if (id >= 1000) return "auxiliary";
  return "33kv";
}

function metersForCategory(
  cat: SheetKind,
  owners?: string[]
): MeterReading[] {
  const list =
    owners && owners.length
      ? owners
      : cat === "11kv"
        ? ["WZPDCL"]
        : ["PDB", "WZPDCL"];

  return list.map((owner) => ({
    meterOwner: owner,
    kwh: null,
    kvarh: null,
    avgPf: null,
    rowColor: owner === "PDB" ? "yellow" : owner === "WZPDCL" ? "cyan" : "",
    hasPeakOffPeak: false,
    peakKwh: null,
    offPeakKwh: null,
    peakKvarh: null,
    offPeakKvarh: null,
  }));
}

function meterOwnerAccent(owner: string, color?: string) {
  const upper = owner.toUpperCase();
  if (upper === "PDB" || color === "yellow") {
    return "shadow-[inset_3px_0_0_0_rgba(245,158,11,0.75)]";
  }
  if (upper === "WZPDCL" || color === "cyan") {
    return "shadow-[inset_3px_0_0_0_rgba(14,165,233,0.75)]";
  }
  return "";
}

function ownerLabelClass(owner: string) {
  const upper = owner.toUpperCase();
  if (upper === "PDB") return "text-amber-700 dark:text-amber-300";
  if (upper === "WZPDCL") return "text-sky-700 dark:text-sky-300";
  return "text-app";
}

function numOrEmpty(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return String(v);
}

function formatStatNum(v: number, decimals = 0) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSavedWhen(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
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
    return "";
  }
}

function buildDefaultBlocks(): FeederBlock[] {
  const blocks: FeederBlock[] = [];

  for (const f of FEEDERS) {
    const cat = categoryForFeederId(f.id);
    blocks.push({
      feederId: f.id,
      feederName: f.name,
      category: cat,
      meters: metersForCategory(cat),
      maxLoadMw: null,
      maxLoadDate: "",
      maxLoadTime: "",
      interruptionCount: null,
      interruptionMinutes: null,
      totalLsMinutes: null,
      custom: false,
    });
  }

  blocks.push({
    feederId: 9001,
    feederName: "Station Auxiliary",
    category: "auxiliary",
    meters: metersForCategory("auxiliary"),
    maxLoadMw: null,
    maxLoadDate: "",
    maxLoadTime: "",
    interruptionCount: null,
    interruptionMinutes: null,
    totalLsMinutes: null,
    custom: true,
  });

  return blocks;
}

function blocksFromRegistry(feeders: any[]): FeederBlock[] {
  const list = Array.isArray(feeders) ? feeders : [];
  if (!list.length) return buildDefaultBlocks();
  return list.map((f) => {
    const cat = (f.category as SheetKind) || "33kv";
    const owners =
      Array.isArray(f.meterOwners) && f.meterOwners.length
        ? f.meterOwners
        : undefined;
    return {
      feederId: Number(f.feederId),
      feederName: String(f.feederName || `Feeder ${f.feederId}`),
      category: cat,
      meters: metersForCategory(cat, owners).map((m) => ({
        ...m,
        hasPeakOffPeak:
          m.meterOwner.toUpperCase() === "PDB" && !!f.hasPeakOffPeak,
      })),
      maxLoadMw: null,
      maxLoadDate: "",
      maxLoadTime: "",
      interruptionCount: null,
      interruptionMinutes: null,
      totalLsMinutes: null,
      custom: !!f.custom || !FEEDERS.some((c) => c.id === Number(f.feederId)),
    };
  });
}

function mergeRowsIntoBlocks(base: FeederBlock[], rows: any[]): FeederBlock[] {
  const byId = new Map<number, FeederBlock>();
  for (const b of base) {
    byId.set(b.feederId, {
      ...b,
      meters: b.meters.map((m) => ({ ...m })),
    });
  }
  for (const r of rows || []) {
    const id = Number(r.feederId);
    if (!byId.has(id)) {
      const cat = (r.category as SheetKind) || categoryForFeederId(id);
      byId.set(id, {
        feederId: id,
        feederName: String(r.feederName || `Feeder ${id}`),
        category: cat,
        meters: metersForCategory(cat),
        maxLoadMw: null,
        maxLoadDate: "",
        maxLoadTime: "",
        interruptionCount: null,
        interruptionMinutes: null,
        totalLsMinutes: null,
        custom: true,
      });
    }
    const block = byId.get(id)!;
    if (r.feederName) block.feederName = String(r.feederName);
    if (r.category) block.category = r.category as SheetKind;
    const owner = String(r.meterOwner || "").trim();
    let meter = block.meters.find(
      (m) => m.meterOwner.toLowerCase() === owner.toLowerCase()
    );
    if (!meter && owner) {
      meter = {
        meterOwner: owner,
        kwh: null,
        kvarh: null,
        avgPf: null,
        rowColor:
          owner.toUpperCase() === "PDB"
            ? "yellow"
            : owner.toUpperCase() === "WZPDCL"
              ? "cyan"
              : "",
        hasPeakOffPeak: false,
        peakKwh: null,
        offPeakKwh: null,
        peakKvarh: null,
        offPeakKvarh: null,
      };
      block.meters.push(meter);
    }
    if (meter) {
      meter.kwh = r.kwh ?? null;
      meter.kvarh = r.kvarh ?? null;
      meter.avgPf = r.avgPf ?? null;
      if (r.rowColor) meter.rowColor = r.rowColor;
      if (r.hasPeakOffPeak != null) meter.hasPeakOffPeak = !!r.hasPeakOffPeak;
      if (
        r.peakKwh != null ||
        r.offPeakKwh != null ||
        r.peakKvarh != null ||
        r.offPeakKvarh != null
      ) {
        meter.hasPeakOffPeak = true;
      }
      if (r.peakKwh != null) meter.peakKwh = r.peakKwh;
      if (r.offPeakKwh != null) meter.offPeakKwh = r.offPeakKwh;
      if (r.peakKvarh != null) meter.peakKvarh = r.peakKvarh;
      if (r.offPeakKvarh != null) meter.offPeakKvarh = r.offPeakKvarh;
    }
    if (block.maxLoadMw == null && r.maxLoadMw != null)
      block.maxLoadMw = r.maxLoadMw;
    if (!block.maxLoadDate && r.maxLoadDate) block.maxLoadDate = r.maxLoadDate;
    if (!block.maxLoadTime && r.maxLoadTime) block.maxLoadTime = r.maxLoadTime;
    if (block.interruptionCount == null && r.interruptionCount != null)
      block.interruptionCount = r.interruptionCount;
    if (block.interruptionMinutes == null && r.interruptionMinutes != null)
      block.interruptionMinutes = r.interruptionMinutes;
    if (block.totalLsMinutes == null && r.totalLsMinutes != null)
      block.totalLsMinutes = r.totalLsMinutes;
  }
  return Array.from(byId.values());
}

function blocksToRegistry(blocks: FeederBlock[]) {
  return blocks.map((b) => ({
    feederId: b.feederId,
    feederName: b.feederName,
    category: b.category,
    meterOwners: b.meters.map((m) => m.meterOwner),
    hasPeakOffPeak: b.meters.some(
      (m) => m.meterOwner.toUpperCase() === "PDB" && !!m.hasPeakOffPeak
    ),
    custom: !!b.custom,
  }));
}

function blocksToRows(blocks: FeederBlock[]) {
  const rows: any[] = [];
  for (const b of blocks) {
    b.meters.forEach((m, idx) => {
      rows.push({
        feederId: b.feederId,
        feederName: b.feederName,
        category: b.category,
        meterOwner: m.meterOwner,
        kwh: m.kwh,
        kvarh: m.kvarh,
        avgPf: m.avgPf,
        hasPeakOffPeak: !!m.hasPeakOffPeak,
        peakKwh: m.hasPeakOffPeak ? (m.peakKwh ?? null) : null,
        offPeakKwh: m.hasPeakOffPeak ? (m.offPeakKwh ?? null) : null,
        peakKvarh: m.hasPeakOffPeak ? (m.peakKvarh ?? null) : null,
        offPeakKvarh: m.hasPeakOffPeak ? (m.offPeakKvarh ?? null) : null,
        maxLoadMw: idx === 0 ? b.maxLoadMw : null,
        maxLoadDate: idx === 0 ? b.maxLoadDate : "",
        maxLoadTime: idx === 0 ? b.maxLoadTime : "",
        interruptionCount: idx === 0 ? b.interruptionCount : null,
        interruptionMinutes: idx === 0 ? b.interruptionMinutes : null,
        totalLsMinutes: idx === 0 ? b.totalLsMinutes : null,
        rowColor: m.rowColor,
      });
    });
  }
  return rows;
}

function nextCustomId(blocks: FeederBlock[], category: SheetKind) {
  const base =
    category === "auxiliary" ? 9000 : category === "11kv" ? 8000 : 7000;
  const ids = blocks
    .filter((b) => b.category === category)
    .map((b) => b.feederId);
  const max = ids.length ? Math.max(...ids) : base;
  return Math.max(max + 1, base + 1);
}

function csvCell(val: string | number | null | undefined) {
  const s = val == null ? "" : String(val);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type FeederModalState = {
  mode: "add" | "edit";
  feederId: number | null;
  name: string;
  category: SheetKind;
  meters: { PDB: boolean; WZPDCL: boolean };
  hasPeakOffPeak: boolean;
};

const defaultAddModal = (cat: SheetKind): FeederModalState => ({
  mode: "add",
  feederId: null,
  name: "",
  category: cat,
  meters: {
    PDB: cat !== "11kv",
    WZPDCL: true,
  },
  hasPeakOffPeak: false,
});

function modalFromBlock(block: FeederBlock): FeederModalState {
  const owners = block.meters.map((m) => m.meterOwner.toUpperCase());
  return {
    mode: "edit",
    feederId: block.feederId,
    name: block.feederName,
    category: block.category,
    meters: {
      PDB: owners.includes("PDB"),
      WZPDCL: owners.includes("WZPDCL"),
    },
    hasPeakOffPeak: block.meters.some(
      (m) => m.meterOwner.toUpperCase() === "PDB" && !!m.hasPeakOffPeak
    ),
  };
}

export default function MonthlyEnergyView() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sheetKind, setSheetKind] = useState<SheetKind>("33kv");
  const [blocks, setBlocks] = useState<FeederBlock[]>(() => buildDefaultBlocks());
  const [notes, setNotes] = useState("");
  const [auditInfo, setAuditInfo] = useState<{
    by: string;
    at: string | null;
  }>({ by: "", at: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<FeederModalState>(() =>
    defaultAddModal("33kv")
  );
  const [editingIds, setEditingIds] = useState<Set<number>>(() => new Set());
  const [modalSaving, setModalSaving] = useState(false);

  const [pendingMonthShift, setPendingMonthShift] = useState<number | null>(null);
  const [confirmRemoveFeeder, setConfirmRemoveFeeder] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const data = await fetchMonthlyEnergySheet({ year, month });
      const sheet = data.sheet || {};
      const raw = Array.isArray(sheet.rows) ? sheet.rows : [];
      const apiFeeders = Array.isArray(data.feeders) ? data.feeders : [];
      const base =
        apiFeeders.length > 0
          ? blocksFromRegistry(apiFeeders)
          : buildDefaultBlocks();
      setBlocks(raw.length ? mergeRowsIntoBlocks(base, raw) : base);
      setNotes(sheet.notes || "");
      setAuditInfo({
        by: sheet.updatedByDisplayName || sheet.updatedByUsername || "",
        at: sheet.updatedAt || null,
      });
      setDirty(false);
      setEditingIds(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load sheet";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  const categoryBlocks = useMemo(
    () => blocks.filter((b) => b.category === sheetKind),
    [blocks, sheetKind]
  );

  const visibleBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryBlocks;
    return categoryBlocks.filter((b) =>
      b.feederName.toLowerCase().includes(q)
    );
  }, [categoryBlocks, searchQuery]);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Disallow mouse-wheel changes on all numeric inputs inside the sheet
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement &&
        target.type === "number"
      ) {
        if (document.activeElement === target) {
          target.blur();
        }
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleNumberWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  };

  // Table footer totals
  const sheetStats = useMemo(() => {
    let totalKwhAll = 0;
    let totalKvarhAll = 0;
    let pfSum = 0;
    let pfCount = 0;
    let peakMw = -Infinity;
    let peakFeederName = "";
    let totalInterruptions = 0;
    let totalInterruptionMins = 0;
    let totalLsMins = 0;

    for (const b of visibleBlocks) {
      for (const m of b.meters) {
        if (m.kwh != null && Number.isFinite(m.kwh)) {
          totalKwhAll += m.kwh;
        }
        if (m.kvarh != null && Number.isFinite(m.kvarh)) {
          totalKvarhAll += m.kvarh;
        }
        if (m.avgPf != null && Number.isFinite(m.avgPf)) {
          pfSum += m.avgPf;
          pfCount += 1;
        }
      }
      if (b.maxLoadMw != null && Number.isFinite(b.maxLoadMw) && b.maxLoadMw > peakMw) {
        peakMw = b.maxLoadMw;
        peakFeederName = b.feederName;
      }
      if (b.interruptionCount != null && Number.isFinite(b.interruptionCount)) {
        totalInterruptions += b.interruptionCount;
      }
      if (b.interruptionMinutes != null && Number.isFinite(b.interruptionMinutes)) {
        totalInterruptionMins += b.interruptionMinutes;
      }
      if (b.totalLsMinutes != null && Number.isFinite(b.totalLsMinutes)) {
        totalLsMins += b.totalLsMinutes;
      }
    }

    return {
      totalKwhAll,
      totalKvarhAll,
      avgPf: pfCount > 0 ? pfSum / pfCount : null,
      peakMw: peakMw > -Infinity ? peakMw : null,
      peakFeederName,
      totalInterruptions,
      totalInterruptionMins,
      totalLsMins,
    };
  }, [visibleBlocks]);

  const startEdit = (feederId: number) => {
    setEditingIds((prev) => new Set(prev).add(feederId));
  };

  const stopEdit = (feederId: number) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(feederId);
      return next;
    });
  };

  const allVisibleEditing =
    visibleBlocks.length > 0 &&
    visibleBlocks.every((b) => editingIds.has(b.feederId));

  const toggleEditAllVisible = () => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (allVisibleEditing) {
        visibleBlocks.forEach((b) => next.delete(b.feederId));
      } else {
        visibleBlocks.forEach((b) => next.add(b.feederId));
      }
      return next;
    });
  };

  const setMeter = (
    feederId: number,
    meterIdx: number,
    key: keyof MeterReading,
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.feederId !== feederId) return b;
        const meters = b.meters.map((m) => ({ ...m }));
        const meter = meters[meterIdx];
        if (!meter) return b;
        if (
          key === "kwh" ||
          key === "kvarh" ||
          key === "avgPf" ||
          key === "peakKwh" ||
          key === "offPeakKwh" ||
          key === "peakKvarh" ||
          key === "offPeakKvarh"
        ) {
          (meter as any)[key] = value === "" ? null : Number(value);
        } else if (key === "hasPeakOffPeak") {
          meter.hasPeakOffPeak = value === "true";
        } else {
          (meter as any)[key] = value;
        }
        return { ...b, meters };
      })
    );
    setDirty(true);
  };

  const togglePeakOffPeak = (feederId: number, meterIdx: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.feederId !== feederId) return b;
        const meters = b.meters.map((m, i) => {
          if (i !== meterIdx) return { ...m };
          const next = !m.hasPeakOffPeak;
          return {
            ...m,
            hasPeakOffPeak: next,
            peakKwh: next ? m.peakKwh ?? null : null,
            offPeakKwh: next ? m.offPeakKwh ?? null : null,
            peakKvarh: next ? m.peakKvarh ?? null : null,
            offPeakKvarh: next ? m.offPeakKvarh ?? null : null,
          };
        });
        return { ...b, meters };
      })
    );
    setDirty(true);
  };

  const setShared = (
    feederId: number,
    key: keyof FeederBlock,
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.feederId !== feederId) return b;
        const next = { ...b, meters: b.meters.map((m) => ({ ...m })) };
        if (
          key === "maxLoadMw" ||
          key === "interruptionCount" ||
          key === "interruptionMinutes" ||
          key === "totalLsMinutes"
        ) {
          (next as any)[key] = value === "" ? null : Number(value);
        } else if (key === "maxLoadDate" || key === "maxLoadTime") {
          (next as any)[key] = value;
        } else if (key === "feederName") {
          next.feederName = value;
        }
        return next;
      })
    );
    setDirty(true);
  };

  const openAddModal = () => {
    setAddForm(defaultAddModal(sheetKind));
    setShowAddModal(true);
  };

  const openEditFeederModal = (block: FeederBlock) => {
    setAddForm(modalFromBlock(block));
    setShowAddModal(true);
  };

  const persistBlocks = async (
    nextBlocks: FeederBlock[],
    successMsg: string
  ) => {
    await saveMonthlyEnergySheet({
      year,
      month,
      rows: blocksToRows(nextBlocks),
      feeders: blocksToRegistry(nextBlocks),
      notes,
    });
    setBlocks(nextBlocks);
    setDirty(false);
    toast.success(successMsg);
  };

  const submitFeederModal = async () => {
    const name = addForm.name.trim();
    if (!name) {
      toast.error("Enter a feeder name");
      return;
    }
    const owners: string[] = [];
    if (addForm.meters.PDB) owners.push("PDB");
    if (addForm.meters.WZPDCL) owners.push("WZPDCL");
    if (owners.length === 0) {
      toast.error("Select at least one meter (WZPDCL or PDB)");
      return;
    }

    let nextBlocks: FeederBlock[];
    let successMsg: string;
    let newId: number | null = null;

    if (addForm.mode === "edit" && addForm.feederId != null) {
      const fid = addForm.feederId;
      nextBlocks = blocks.map((b) => {
        if (b.feederId !== fid) return b;
        const byOwner = new Map(
          b.meters.map((m) => [m.meterOwner.toUpperCase(), m])
        );
        const meters = owners.map((owner) => {
          const prevM = byOwner.get(owner.toUpperCase());
          if (prevM) {
            return {
              ...prevM,
              meterOwner: owner,
              rowColor:
                owner === "PDB"
                  ? "yellow"
                  : owner === "WZPDCL"
                    ? "cyan"
                    : prevM.rowColor,
              hasPeakOffPeak:
                owner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak,
              peakKwh:
                owner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak
                  ? prevM.peakKwh ?? null
                  : null,
              offPeakKwh:
                owner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak
                  ? prevM.offPeakKwh ?? null
                  : null,
              peakKvarh:
                owner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak
                  ? prevM.peakKvarh ?? null
                  : null,
              offPeakKvarh:
                owner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak
                  ? prevM.offPeakKvarh ?? null
                  : null,
            };
          }
          return {
            meterOwner: owner,
            kwh: null,
            kvarh: null,
            avgPf: null,
            rowColor:
              owner === "PDB" ? "yellow" : owner === "WZPDCL" ? "cyan" : "",
            hasPeakOffPeak: addForm.hasPeakOffPeak,
            peakKwh: null,
            offPeakKwh: null,
            peakKvarh: null,
            offPeakKvarh: null,
          };
        });
        return {
          ...b,
          feederName: name,
          category: addForm.category,
          meters,
        };
      });
      successMsg = `Saved ${name} (all months)`;
    } else {
      const id = nextCustomId(blocks, addForm.category);
      newId = id;
      const meters = metersForCategory(addForm.category, owners).map((m) => ({
        ...m,
        hasPeakOffPeak:
          m.meterOwner.toUpperCase() === "PDB" && addForm.hasPeakOffPeak,
        peakKwh: null,
        offPeakKwh: null,
        peakKvarh: null,
        offPeakKvarh: null,
      }));
      const block: FeederBlock = {
        feederId: id,
        feederName: name,
        category: addForm.category,
        meters,
        maxLoadMw: null,
        maxLoadDate: "",
        maxLoadTime: "",
        interruptionCount: null,
        interruptionMinutes: null,
        totalLsMinutes: null,
        custom: true,
      };
      nextBlocks = [...blocks, block];
      successMsg = `Added ${name} (all months)`;
    }

    try {
      setModalSaving(true);
      await persistBlocks(nextBlocks, successMsg);
      setSheetKind(addForm.category);
      if (newId != null) {
        setEditingIds((prev) => new Set(prev).add(newId));
      }
      setShowAddModal(false);
      setAddForm(defaultAddModal(addForm.category));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save feeder");
    } finally {
      setModalSaving(false);
    }
  };

  const removeFeeder = (feederId: number) => {
    setBlocks((prev) => prev.filter((b) => b.feederId !== feederId));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(feederId);
      return next;
    });
    setDirty(true);
    setConfirmRemoveFeeder(null);
    toast.success("Feeder removed — click Save Changes to apply");
  };

  const applyMonthShift = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const requestMonthShift = (delta: number) => {
    if (dirty) {
      setPendingMonthShift(delta);
      return;
    }
    applyMonthShift(delta);
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await saveMonthlyEnergySheet({
        year,
        month,
        rows: blocksToRows(blocks),
        feeders: blocksToRegistry(blocks),
        notes,
      });
      toast.success("Monthly energy sheet saved");
      setDirty(false);
      setEditingIds(new Set());
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [year, month, blocks, notes, load]);

  // Ctrl / Cmd + S quick save shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dirty, saving, handleSave]);

  const handleExportCsv = () => {
    const headers = [
      "Category",
      "Feeder Name",
      "Meter Owner",
      "Total KWH",
      "Peak KWH",
      "Off-Peak KWH",
      "Total Kvarh",
      "Peak Kvarh",
      "Off-Peak Kvarh",
      "Avg PF",
      "Max Load (MW)",
      "Max Load Date",
      "Max Load Time",
      "Interruptions (Count)",
      "Interruption Time (min)",
      "Total LS (min)",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const b of blocks) {
      b.meters.forEach((m, idx) => {
        lines.push(
          [
            b.category.toUpperCase(),
            b.feederName,
            m.meterOwner,
            m.kwh ?? "",
            m.hasPeakOffPeak ? m.peakKwh ?? "" : "",
            m.hasPeakOffPeak ? m.offPeakKwh ?? "" : "",
            m.kvarh ?? "",
            m.hasPeakOffPeak ? m.peakKvarh ?? "" : "",
            m.hasPeakOffPeak ? m.offPeakKvarh ?? "" : "",
            m.avgPf ?? "",
            idx === 0 ? b.maxLoadMw ?? "" : "",
            idx === 0 ? b.maxLoadDate || "" : "",
            idx === 0 ? b.maxLoadTime || "" : "",
            idx === 0 ? b.interruptionCount ?? "" : "",
            idx === 0 ? b.interruptionMinutes ?? "" : "",
            idx === 0 ? b.totalLsMinutes ?? "" : "",
          ]
            .map(csvCell)
            .join(",")
        );
      });
    }
    if (notes.trim()) {
      lines.push("");
      lines.push([csvCell("Monthly Remarks"), csvCell(notes.trim())].join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `WZPDCL_Monthly_Energy_${year}_${String(month).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${MONTH_NAMES[month - 1]} ${year} CSV`);
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        <div className="h-24 rounded-xl bg-surface border border-app animate-pulse" />
        <div className="h-96 rounded-xl bg-surface border border-app animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="w-full max-w-md mx-auto mt-16 px-4">
        <div className="rounded-xl border border-app bg-surface p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-app tracking-tight">
            Monthly Energy Reading
          </h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">
            This engineering ledger is restricted to substation administrators.
          </p>
          <Link
            href="/admin"
            className="inline-flex mt-5 btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const getEnergyInputClass = (editing: boolean) =>
    `w-full rounded px-2 py-1 text-xs text-app text-center font-mono tabular-nums transition-colors focus:outline-none ${
      editing
        ? "border border-app bg-surface hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/40"
        : "border border-transparent bg-transparent cursor-default opacity-90"
    }`;

  const getSharedInputClass = (editing: boolean) =>
    `w-full rounded px-2 py-1.5 text-xs text-app text-center font-mono tabular-nums transition-colors focus:outline-none ${
      editing
        ? "border border-app bg-surface hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/40"
        : "border border-transparent bg-transparent cursor-default opacity-90"
    }`;

  const activeTab = SHEET_TABS.find((t) => t.id === sheetKind)!;
  const savedLabel = formatSavedWhen(auditInfo.at);

  return (
    <div className="w-full min-w-0 max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-5">
      {/* Executive Header */}
      <header className="rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-muted mb-1.5"
            >
              <Link
                href="/admin"
                className="hover:text-accent transition-colors font-medium whitespace-nowrap"
              >
                Admin
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-secondary font-medium">
                Monthly Energy Reading
              </span>
            </nav>

            <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight">
              Monthly Energy Reading
            </h1>

            <p className="text-xs sm:text-sm text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{activeTab.hint}</span>
              {savedLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-secondary">
                    Last saved {savedLabel}
                    {auditInfo.by ? ` by ${auditInfo.by}` : ""}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Right Action Cluster */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center rounded-lg border border-app bg-surface-2 overflow-hidden">
              <button
                type="button"
                onClick={() => requestMonthShift(-1)}
                className="p-2 text-secondary hover:text-app hover:bg-surface-3 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-app min-w-[9.5rem] text-center tabular-nums whitespace-nowrap">
                {MONTH_NAMES[month - 1]} {year}
              </div>
              <button
                type="button"
                onClick={() => requestMonthShift(1)}
                className="p-2 text-secondary hover:text-app hover:bg-surface-3 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-app bg-surface-2 text-secondary hover:text-app hover:bg-surface-3 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Download CSV report for this month"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleSave}
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-45 whitespace-nowrap shrink-0 shadow-sm"
              title="Save sheet changes (Ctrl/Cmd + S)"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {dirty ? "Save Changes" : "Saved"}
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar: Category Tabs, Search & Row Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div
          role="tablist"
          aria-label="Voltage level sheet selector"
          className="inline-flex flex-wrap rounded-lg border border-app bg-surface p-1 gap-1 self-start"
        >
          {SHEET_TABS.map((tab) => {
            const count = blocks.filter((b) => b.category === tab.id).length;
            const active = sheetKind === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSheetKind(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "btn-primary shadow-sm"
                    : "text-secondary hover:text-app hover:bg-surface-2"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 font-mono tabular-nums ${
                    active ? "opacity-85" : "text-muted"
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter feeders by name..."
            className="w-full rounded-lg border border-app bg-surface pl-8 pr-8 py-2 text-xs text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-app"
              aria-label="Clear feeder filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          {dirty && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 px-1 whitespace-nowrap">
              Unsaved changes
            </span>
          )}

          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-app bg-surface text-secondary hover:text-app hover:bg-surface-2 transition-colors whitespace-nowrap disabled:opacity-50"
            title="Reload sheet from server"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Reload
          </button>

          {visibleBlocks.length > 0 && (
            <button
              type="button"
              onClick={toggleEditAllVisible}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                allVisibleEditing
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-app bg-surface text-secondary hover:text-app hover:bg-surface-2"
              }`}
            >
              {allVisibleEditing ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Done editing
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit all rows
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add feeder
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1 rounded-md border border-rose-500/40 font-semibold hover:bg-rose-500/15 whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* High-Density Engineering Data Table */}
      <div className="rounded-xl border bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/30 border-emerald-200 dark:from-teal-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-teal-500/25 shadow-sm overflow-hidden">
        <div ref={tableScrollRef} className="overflow-auto max-h-[70vh]">
          <table className="w-full border-separate border-spacing-0 text-xs min-w-[1140px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-2 text-app">
                <th
                  rowSpan={2}
                  className="border-b border-r border-app px-3 py-2.5 text-center align-middle font-semibold sticky left-0 z-30 bg-surface-2 min-w-[11.5rem] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.14)]"
                >
                  Feeder Name
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-r border-app px-2.5 py-2.5 text-center align-middle font-semibold min-w-[5.5rem]"
                >
                  Meter
                </th>
                <th
                  colSpan={3}
                  className="border-b border-r border-app px-2.5 py-2 font-semibold text-center align-middle bg-amber-500/[0.08] dark:bg-amber-400/[0.09]"
                >
                  Energy Reading
                </th>
                <th
                  colSpan={3}
                  className="border-b border-r border-app px-2.5 py-2 font-semibold text-center align-middle bg-sky-500/[0.08] dark:bg-sky-400/[0.09]"
                >
                  Max Load
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-r border-app px-2.5 py-2.5 font-semibold text-center align-middle min-w-[6rem] leading-tight"
                >
                  Interruptions
                  <br />
                  <span className="font-normal text-[11px] text-muted">
                    (Count)
                  </span>
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-r border-app px-2.5 py-2.5 font-semibold text-center align-middle min-w-[6.25rem] leading-tight"
                >
                  Outage Time
                  <br />
                  <span className="font-normal text-[11px] text-muted">
                    (Minutes)
                  </span>
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-r border-app px-2.5 py-2.5 font-semibold text-center align-middle min-w-[5.5rem] leading-tight"
                >
                  Total LS
                  <br />
                  <span className="font-normal text-[11px] text-muted">
                    (Minutes)
                  </span>
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-app px-2 py-2.5 font-semibold text-center align-middle w-24"
                >
                  Actions
                </th>
              </tr>
              <tr className="bg-surface-2 text-app">
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-amber-500/[0.06] dark:bg-amber-400/[0.06] min-w-[7.5rem]">
                  KWH
                </th>
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-amber-500/[0.06] dark:bg-amber-400/[0.06] min-w-[7.5rem]">
                  Kvarh
                </th>
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-amber-500/[0.06] dark:bg-amber-400/[0.06] min-w-[5rem]">
                  Avg. PF
                </th>
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-sky-500/[0.06] dark:bg-sky-400/[0.06] min-w-[5.25rem]">
                  MW
                </th>
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-sky-500/[0.06] dark:bg-sky-400/[0.06] min-w-[8rem]">
                  Date
                </th>
                <th className="border-b border-r border-app px-2.5 py-1.5 font-semibold text-center align-middle bg-sky-500/[0.06] dark:bg-sky-400/[0.06] min-w-[6.25rem]">
                  Time
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border-b border-app px-4 py-14 text-center align-middle text-muted"
                  >
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading {MONTH_NAMES[month - 1]} {year} energy ledger…
                    </span>
                  </td>
                </tr>
              ) : visibleBlocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border-b border-app px-4 py-12 text-center align-middle text-muted space-y-2"
                  >
                    <p className="text-sm font-medium text-app">
                      {searchQuery.trim()
                        ? `No feeders matching "${searchQuery.trim()}"`
                        : "No feeders configured in this category"}
                    </p>
                    <div className="pt-1 flex items-center justify-center gap-2">
                      {searchQuery.trim() ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-app bg-surface-2 text-app hover:bg-surface-3"
                        >
                          Clear search
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={openAddModal}
                          className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add feeder
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleBlocks.map((block, blockIndex) => {
                  const meters = block.meters.length
                    ? block.meters
                    : metersForCategory(block.category);
                  const meterCount = meters.length;
                  const canRemove =
                    block.custom ||
                    block.category === "auxiliary" ||
                    !FEEDERS.some((f) => f.id === block.feederId);
                  const isEditing = editingIds.has(block.feederId);
                  const isEvenFeeder = blockIndex % 2 === 0;
                  const rowBg = isEvenFeeder ? "bg-surface" : "bg-surface-2";
                  const energyInput = getEnergyInputClass(isEditing);
                  const sharedInput = getSharedInputClass(isEditing);

                  return meters.map((meter, mi) => {
                    const ownerAccent = meterOwnerAccent(
                      meter.meterOwner,
                      meter.rowColor
                    );
                    const isLastOfBlock = mi === meterCount - 1;
                    const rowBorderBottom = isLastOfBlock
                      ? "border-b-2 border-b-[var(--app-border-strong)]"
                      : "border-b border-b-app";

                    return (
                      <tr
                        key={`${block.feederId}-${mi}`}
                        onDoubleClick={() => {
                          if (!isEditing) startEdit(block.feederId);
                        }}
                        className={`transition-colors ${
                          isEditing ? "ring-1 ring-inset ring-accent/20" : ""
                        }`}
                      >
                        {mi === 0 && (
                          <td
                            rowSpan={meterCount}
                            className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-2 py-2 text-center align-middle sticky left-0 z-10 ${rowBg} font-semibold text-app text-[13px] shadow-[2px_0_8px_-2px_rgba(0,0,0,0.12)]`}
                          >
                            <div className="relative flex items-center justify-center px-6 min-w-0">
                              <span
                                className="truncate font-semibold text-center"
                                title={`${block.feederName} (double-click row to edit)`}
                              >
                                {block.feederName}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditFeederModal(block)}
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-app hover:bg-surface-3 transition-colors"
                                title="Configure feeder name & meters"
                                aria-label={`Configure ${block.feederName}`}
                              >
                                <Settings2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}

                        <td
                          className={`${rowBorderBottom} border-r border-r-app px-2.5 py-2 font-semibold text-center align-middle ${rowBg} ${ownerAccent}`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span
                              className={`text-xs font-bold tracking-wide text-center ${ownerLabelClass(meter.meterOwner)}`}
                            >
                              {meter.meterOwner}
                            </span>
                            {isEditing &&
                              meter.meterOwner.toUpperCase() === "PDB" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePeakOffPeak(block.feederId, mi)
                                  }
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border self-center whitespace-nowrap transition-colors ${
                                    meter.hasPeakOffPeak
                                      ? "border-accent text-accent bg-accent/10"
                                      : "border-app text-muted hover:text-app bg-surface"
                                  }`}
                                  title="Toggle Peak / Off-peak breakdown (PDB)"
                                >
                                  {meter.hasPeakOffPeak
                                    ? "Peak / Off ✓"
                                    : "+ Peak / Off"}
                                </button>
                              )}
                          </div>
                        </td>

                        {/* KWH */}
                        <td
                          className={`${rowBorderBottom} border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                        >
                          {meter.meterOwner.toUpperCase() === "PDB" &&
                          meter.hasPeakOffPeak ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                disabled={!isEditing}
                                value={numOrEmpty(meter.kwh)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setMeter(
                                    block.feederId,
                                    mi,
                                    "kwh",
                                    e.target.value
                                  )
                                }
                                className={energyInput}
                                placeholder="Total"
                              />
                              <div className="grid grid-cols-2 gap-1 w-full">
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditing}
                                  value={numOrEmpty(meter.peakKwh)}
                                  onWheel={handleNumberWheel}
                                  onKeyDown={handleNumberKeyDown}
                                  onChange={(e) =>
                                    setMeter(
                                      block.feederId,
                                      mi,
                                      "peakKwh",
                                      e.target.value
                                    )
                                  }
                                  className={energyInput}
                                  placeholder="Peak"
                                />
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditing}
                                  value={numOrEmpty(meter.offPeakKwh)}
                                  onWheel={handleNumberWheel}
                                  onKeyDown={handleNumberKeyDown}
                                  onChange={(e) =>
                                    setMeter(
                                      block.feederId,
                                      mi,
                                      "offPeakKwh",
                                      e.target.value
                                    )
                                  }
                                  className={energyInput}
                                  placeholder="Off"
                                />
                              </div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditing}
                              value={numOrEmpty(meter.kwh)}
                              onWheel={handleNumberWheel}
                              onKeyDown={handleNumberKeyDown}
                              onChange={(e) =>
                                setMeter(
                                  block.feederId,
                                  mi,
                                  "kwh",
                                  e.target.value
                                )
                              }
                              className={energyInput}
                              placeholder="—"
                            />
                          )}
                        </td>

                        {/* Kvarh */}
                        <td
                          className={`${rowBorderBottom} border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                        >
                          {meter.meterOwner.toUpperCase() === "PDB" &&
                          meter.hasPeakOffPeak ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                disabled={!isEditing}
                                value={numOrEmpty(meter.kvarh)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setMeter(
                                    block.feederId,
                                    mi,
                                    "kvarh",
                                    e.target.value
                                  )
                                }
                                className={energyInput}
                                placeholder="Total"
                              />
                              <div className="grid grid-cols-2 gap-1 w-full">
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditing}
                                  value={numOrEmpty(meter.peakKvarh)}
                                  onWheel={handleNumberWheel}
                                  onKeyDown={handleNumberKeyDown}
                                  onChange={(e) =>
                                    setMeter(
                                      block.feederId,
                                      mi,
                                      "peakKvarh",
                                      e.target.value
                                    )
                                  }
                                  className={energyInput}
                                  placeholder="Peak"
                                />
                                <input
                                  type="number"
                                  step="any"
                                  disabled={!isEditing}
                                  value={numOrEmpty(meter.offPeakKvarh)}
                                  onWheel={handleNumberWheel}
                                  onKeyDown={handleNumberKeyDown}
                                  onChange={(e) =>
                                    setMeter(
                                      block.feederId,
                                      mi,
                                      "offPeakKvarh",
                                      e.target.value
                                    )
                                  }
                                  className={energyInput}
                                  placeholder="Off"
                                />
                              </div>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditing}
                              value={numOrEmpty(meter.kvarh)}
                              onWheel={handleNumberWheel}
                              onKeyDown={handleNumberKeyDown}
                              onChange={(e) =>
                                setMeter(
                                  block.feederId,
                                  mi,
                                  "kvarh",
                                  e.target.value
                                )
                              }
                              className={energyInput}
                              placeholder="—"
                            />
                          )}
                        </td>

                        {/* Avg PF */}
                        <td
                          className={`${rowBorderBottom} border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                        >
                          <input
                            type="number"
                            step="0.001"
                            disabled={!isEditing}
                            value={numOrEmpty(meter.avgPf)}
                            onWheel={handleNumberWheel}
                            onKeyDown={handleNumberKeyDown}
                            onChange={(e) =>
                              setMeter(
                                block.feederId,
                                mi,
                                "avgPf",
                                e.target.value
                              )
                            }
                            className={energyInput}
                            placeholder="—"
                          />
                        </td>

                        {/* Shared Feeder-level Max Load + Interruption + LS Columns */}
                        {mi === 0 && (
                          <>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="number"
                                step="0.01"
                                disabled={!isEditing}
                                value={numOrEmpty(block.maxLoadMw)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "maxLoadMw",
                                    e.target.value
                                  )
                                }
                                className={sharedInput}
                                placeholder="—"
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="date"
                                disabled={!isEditing}
                                value={block.maxLoadDate || ""}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "maxLoadDate",
                                    e.target.value
                                  )
                                }
                                className={`${sharedInput} min-w-[7.75rem]`}
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="time"
                                disabled={!isEditing}
                                value={block.maxLoadTime || ""}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "maxLoadTime",
                                    e.target.value
                                  )
                                }
                                className={`${sharedInput} min-w-[5.75rem]`}
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="number"
                                step="1"
                                disabled={!isEditing}
                                value={numOrEmpty(block.interruptionCount)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "interruptionCount",
                                    e.target.value
                                  )
                                }
                                className={sharedInput}
                                placeholder="—"
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="number"
                                step="1"
                                disabled={!isEditing}
                                value={numOrEmpty(block.interruptionMinutes)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "interruptionMinutes",
                                    e.target.value
                                  )
                                }
                                className={sharedInput}
                                placeholder="—"
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] border-r border-r-app px-1.5 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <input
                                type="number"
                                step="1"
                                disabled={!isEditing}
                                value={numOrEmpty(block.totalLsMinutes)}
                                onWheel={handleNumberWheel}
                                onKeyDown={handleNumberKeyDown}
                                onChange={(e) =>
                                  setShared(
                                    block.feederId,
                                    "totalLsMinutes",
                                    e.target.value
                                  )
                                }
                                className={sharedInput}
                                placeholder="—"
                              />
                            </td>
                            <td
                              rowSpan={meterCount}
                              className={`border-b-2 border-b-[var(--app-border-strong)] px-2 py-1.5 text-center align-middle ${rowBg}`}
                            >
                              <div className="inline-flex items-center justify-center gap-1">
                                {isEditing ? (
                                  <button
                                    type="button"
                                    onClick={() => stopEdit(block.feederId)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors"
                                    title="Lock row"
                                  >
                                    <Lock className="w-3 h-3" />
                                    Done
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(block.feederId)}
                                    className="inline-flex p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                                    title="Edit feeder readings"
                                    aria-label={`Edit ${block.feederName}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canRemove && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmRemoveFeeder({
                                        id: block.feederId,
                                        name: block.feederName,
                                      })
                                    }
                                    className="inline-flex p-1.5 rounded-md text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    title="Remove custom feeder"
                                    aria-label={`Remove ${block.feederName}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>

            {!loading && visibleBlocks.length > 0 && (
              <tfoot className="sticky bottom-0 z-20 bg-surface-2 text-app font-semibold">
                <tr>
                  <td
                    colSpan={2}
                    className="border-t border-r border-app px-3 py-2.5 sticky left-0 z-30 bg-surface-2 text-xs font-bold text-center align-middle shadow-[2px_0_8px_-2px_rgba(0,0,0,0.14)]"
                  >
                    Sheet Totals ({visibleBlocks.length} feeders)
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs">
                    {formatStatNum(sheetStats.totalKwhAll, 0)}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs">
                    {formatStatNum(sheetStats.totalKvarhAll, 0)}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs text-muted">
                    {sheetStats.avgPf != null
                      ? sheetStats.avgPf.toFixed(3)
                      : "—"}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs text-accent">
                    {sheetStats.peakMw != null
                      ? sheetStats.peakMw.toFixed(2)
                      : "—"}
                  </td>
                  <td
                    colSpan={2}
                    className="border-t border-r border-app px-3 py-2.5 text-center align-middle text-[11px] text-muted truncate"
                  >
                    {sheetStats.peakFeederName
                      ? `Peak: ${sheetStats.peakFeederName}`
                      : "—"}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs">
                    {formatStatNum(sheetStats.totalInterruptions)}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs">
                    {formatStatNum(sheetStats.totalInterruptionMins)}
                  </td>
                  <td className="border-t border-r border-app px-3 py-2.5 text-center align-middle font-mono tabular-nums text-xs">
                    {formatStatNum(sheetStats.totalLsMins)}
                  </td>
                  <td className="border-t border-app px-2 py-2.5 text-center align-middle text-[11px] text-muted">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Monthly Remarks */}
      <section className="rounded-xl border bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200 dark:from-amber-950/50 dark:via-[#0f1726] dark:to-[#0f1726] dark:border-amber-500/25 p-4 sm:p-5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="monthly-energy-notes"
            className="text-xs font-semibold text-orange-700 dark:text-amber-200"
          >
            Monthly Remarks &amp; Metering Notes
          </label>
          <span className="text-xs text-muted font-mono tabular-nums">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>
        <textarea
          id="monthly-energy-notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
          rows={2}
          className="w-full rounded-lg border border-app bg-surface-2/50 px-3.5 py-2.5 text-xs sm:text-sm text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
          placeholder="Optional remarks about meter replacement, CT ratio notes, or billing anomalies for this month…"
        />
      </section>

      {/* Add / Edit Feeder Configuration Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-feeder-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-app overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-app">
              <div>
                <h3
                  id="add-feeder-title"
                  className="text-base font-semibold text-app tracking-tight"
                >
                  {addForm.mode === "edit"
                    ? "Configure Feeder"
                    : "Add New Feeder"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Configure feeder name, voltage group, meters, and optional peak/off-peak split. Changes apply across all months.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Feeder name
                </label>
                <input
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((s) => ({ ...s, name: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitFeederModal();
                  }}
                  placeholder="e.g. Kushtia Sugar Mill 11 kV"
                  className="w-full rounded-lg border border-app bg-surface-2/60 px-3 py-2 text-sm text-app focus:outline-none focus:ring-2 focus:ring-accent/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Feeder group
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "33kv", label: "33 kV" },
                      { id: "11kv", label: "11 kV" },
                      { id: "auxiliary", label: "Auxiliary" },
                    ] as const
                  ).map((opt) => {
                    const active = addForm.category === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setAddForm((s) => ({
                            ...s,
                            category: opt.id,
                            meters: {
                              PDB: opt.id !== "11kv",
                              WZPDCL: true,
                            },
                          }))
                        }
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-app text-secondary hover:bg-surface-2"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Installed Meters
                </label>
                <div className="flex flex-wrap gap-3">
                  {(["WZPDCL", "PDB"] as const).map((owner) => {
                    const checked = addForm.meters[owner];
                    return (
                      <label
                        key={owner}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none text-xs font-semibold transition-colors ${
                          checked
                            ? owner === "PDB"
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            : "border-app text-muted hover:bg-surface-2"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setAddForm((s) => ({
                              ...s,
                              meters: {
                                ...s.meters,
                                [owner]: e.target.checked,
                              },
                            }))
                          }
                          className="rounded border-app accent-accent"
                        />
                        {owner}
                      </label>
                    );
                  })}
                </div>
              </div>

              <label
                className={`flex items-start gap-2.5 select-none rounded-lg border border-app bg-surface-2/50 p-3 ${
                  addForm.meters.PDB
                    ? "cursor-pointer"
                    : "opacity-45 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={addForm.hasPeakOffPeak && addForm.meters.PDB}
                  disabled={!addForm.meters.PDB}
                  onChange={(e) =>
                    setAddForm((s) => ({
                      ...s,
                      hasPeakOffPeak: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-app accent-accent"
                />
                <span>
                  <span className="block text-xs font-semibold text-app">
                    Peak / Off-peak breakdown (PDB only)
                  </span>
                  <span className="block text-[11px] text-muted mt-0.5">
                    Adds Peak and Off-peak sub-fields under KWH &amp; Kvarh for the PDB meter.
                  </span>
                </span>
              </label>
            </div>

            <div className="px-5 py-4 flex gap-3 justify-end bg-surface-2 border-t border-app">
              <button
                type="button"
                disabled={modalSaving}
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-secondary bg-surface border border-app hover:bg-surface-3 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSaving}
                onClick={submitFeederModal}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-60"
              >
                {modalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {addForm.mode === "edit" ? "Save configuration" : "Add feeder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Month Navigation Guard */}
      <ConfirmModal
        open={pendingMonthShift !== null}
        title="Unsaved monthly changes"
        message="You have unsaved edits on this month's energy ledger. Switch months and discard unsaved changes?"
        confirmLabel="Discard & Switch"
        cancelLabel="Stay Here"
        danger
        onCancel={() => setPendingMonthShift(null)}
        onConfirm={() => {
          const delta = pendingMonthShift;
          setPendingMonthShift(null);
          if (delta !== null) applyMonthShift(delta);
        }}
      />

      {/* Confirm Remove Custom Feeder */}
      <ConfirmModal
        open={confirmRemoveFeeder !== null}
        title="Remove custom feeder"
        message={
          confirmRemoveFeeder
            ? `Remove "${confirmRemoveFeeder.name}" from the feeder registry? Remember to click Save Changes afterwards to persist.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmRemoveFeeder(null)}
        onConfirm={() => {
          if (confirmRemoveFeeder) removeFeeder(confirmRemoveFeeder.id);
        }}
      />
    </div>
  );
}
