"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchMonthlyEnergySheet, saveMonthlyEnergySheet } from "@/lib/api";
import { FEEDERS } from "@/lib/constants";

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
    hint: "Outgoing 33 kV · H-3 / T-3 · PDB + WZPDCL meters",
  },
  {
    id: "11kv",
    label: "11 kV Feeders",
    hint: "11 kV outgoing · WZPDCL meter only by default",
  },
  {
    id: "auxiliary",
    label: "Auxiliary",
    hint: "Station auxiliary · add as needed",
  },
];

/** H-3 / T-3 and all core Bottail feeders are 33 kV on this sheet */
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

function meterBg(color?: string) {
  if (color === "yellow") return "bg-yellow-200 dark:bg-yellow-500/30";
  if (color === "cyan") return "bg-cyan-200 dark:bg-cyan-500/30";
  return "bg-surface";
}

function sharedBg() {
  return "bg-surface dark:bg-surface-2/40";
}

function numOrEmpty(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "";
  return String(v);
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
    const owners = Array.isArray(f.meterOwners) && f.meterOwners.length
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
    if (block.maxLoadMw == null && r.maxLoadMw != null) block.maxLoadMw = r.maxLoadMw;
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

function rowsToBlocks(rows: any[]): FeederBlock[] {
  const defaults = buildDefaultBlocks();
  const byId = new Map<number, FeederBlock>();
  for (const b of defaults) {
    byId.set(b.feederId, {
      ...b,
      meters: b.meters.map((m) => ({ ...m })),
    });
  }

  for (const r of rows || []) {
    const id = Number(r.feederId);
    const cat = (r.category as SheetKind) || categoryForFeederId(id);
    if (!byId.has(id)) {
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

    if (block.maxLoadMw == null && r.maxLoadMw != null) {
      block.maxLoadMw = r.maxLoadMw;
    }
    if (!block.maxLoadDate && r.maxLoadDate) block.maxLoadDate = r.maxLoadDate;
    if (!block.maxLoadTime && r.maxLoadTime) block.maxLoadTime = r.maxLoadTime;
    if (block.interruptionCount == null && r.interruptionCount != null) {
      block.interruptionCount = r.interruptionCount;
    }
    if (block.interruptionMinutes == null && r.interruptionMinutes != null) {
      block.interruptionMinutes = r.interruptionMinutes;
    }
    if (block.totalLsMinutes == null && r.totalLsMinutes != null) {
      block.totalLsMinutes = r.totalLsMinutes;
    }
  }

  const coreIds = new Set(FEEDERS.map((f) => f.id));
  const list = Array.from(byId.values());
  list.sort((a, b) => {
    const ac = a.category === "33kv" ? 0 : a.category === "11kv" ? 1 : 2;
    const bc = b.category === "33kv" ? 0 : b.category === "11kv" ? 1 : 2;
    if (ac !== bc) return ac - bc;
    const aCore = coreIds.has(a.feederId) ? 0 : 1;
    const bCore = coreIds.has(b.feederId) ? 0 : 1;
    if (aCore !== bCore) return aCore - bCore;
    return a.feederId - b.feederId;
  });
  return list;
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
  const ids = blocks.filter((b) => b.category === category).map((b) => b.feederId);
  const max = ids.length ? Math.max(...ids) : base;
  return Math.max(max + 1, base + 1);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<FeederModalState>(() =>
    defaultAddModal("33kv")
  );
  /** Feeder IDs currently in edit mode (inputs enabled) */
  const [editingIds, setEditingIds] = useState<Set<number>>(() => new Set());
  /** Global feeder registry (shared across all months) */
  const [registry, setRegistry] = useState<any[]>([]);
  const [modalSaving, setModalSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMonthlyEnergySheet({ year, month });
      const sheet = data.sheet || {};
      const raw = Array.isArray(sheet.rows) ? sheet.rows : [];
      const apiFeeders = Array.isArray(data.feeders) ? data.feeders : [];
      // Registry defines which feeders exist for EVERY month
      const base =
        apiFeeders.length > 0
          ? blocksFromRegistry(apiFeeders)
          : buildDefaultBlocks();
      setBlocks(raw.length ? mergeRowsIntoBlocks(base, raw) : base);
      setRegistry(apiFeeders);
      setNotes(sheet.notes || "");
      setDirty(false);
      setEditingIds(new Set());
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sheet");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isAdmin) return;
    load();
  }, [authLoading, isAuthenticated, isAdmin, load]);

  const visibleBlocks = useMemo(
    () => blocks.filter((b) => b.category === sheetKind),
    [blocks, sheetKind]
  );

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
    } catch (err: any) {
      toast.error(err?.message || "Failed to save feeder");
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
  };

  const shiftMonth = (delta: number) => {
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

  const handleSave = async () => {
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
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
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

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="w-full max-w-lg mx-auto mt-16 px-4 text-center">
        <h1 className="text-lg font-semibold text-app">Monthly Energy Reading</h1>
        <p className="text-sm text-muted mt-2">
          This sheet is available to administrators only.
        </p>
        <Link
          href="/admin"
          className="inline-flex mt-4 btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Back to Admin
        </Link>
      </div>
    );
  }

  const energyInput =
    "w-full bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/20 focus:border-accent focus:bg-white/70 dark:focus:bg-black/20 rounded px-1.5 py-1 text-[12px] text-app text-center tabular-nums focus:outline-none disabled:opacity-70 disabled:hover:border-transparent disabled:cursor-default";
  const sharedInput =
    "w-full bg-transparent border border-transparent hover:border-black/20 dark:hover:border-white/20 focus:border-accent focus:bg-white/70 dark:focus:bg-black/20 rounded px-1.5 py-1.5 text-[12px] text-app text-center tabular-nums focus:outline-none disabled:opacity-70 disabled:hover:border-transparent disabled:cursor-default";

  const activeTab = SHEET_TABS.find((t) => t.id === sheetKind)!;

  return (
    <div className="w-full min-w-0 max-w-[1440px] mx-auto px-3 sm:px-5 py-5 space-y-5">
      <div className="rounded-2xl border border-app bg-elevated/80 backdrop-blur-sm px-4 sm:px-5 py-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted text-[11px] mb-1.5">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 hover:text-accent transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Admin
            </Link>
            <span className="text-muted/50">/</span>
            <span className="text-secondary">Monthly Energy</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-app tracking-tight">
            Monthly Energy Reading
          </h1>
          <p className="text-[12px] text-muted mt-1 leading-relaxed">
            {activeTab.hint}
            <span className="mx-1.5 text-muted/40">·</span>
            Feeders apply to all months
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-app bg-elevated overflow-hidden">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-2 text-muted hover:text-app hover:bg-surface-3"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 text-[13px] font-semibold text-app min-w-[9rem] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-2 text-muted hover:text-app hover:bg-surface-3"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={handleSave}
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-45"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </button>
        </div>
      </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-app bg-elevated/90 p-1 gap-0.5 shadow-sm">
          {SHEET_TABS.map((tab) => {
            const count = blocks.filter((b) => b.category === tab.id).length;
            const active = sheetKind === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSheetKind(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
                  active
                    ? "btn-primary shadow-sm"
                    : "text-secondary hover:text-app hover:bg-surface-3/80"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 tabular-nums ${
                    active ? "opacity-80" : "text-muted"
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {visibleBlocks.length > 0 && (
            <button
              type="button"
              onClick={toggleEditAllVisible}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition ${
                allVisibleEditing
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-app bg-elevated text-secondary hover:text-app hover:bg-surface-3"
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
            className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold shadow-sm hover:opacity-95 active:scale-[0.98] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add feeder
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-app bg-elevated shadow-md overflow-hidden">
        <div className="overflow-auto max-h-[68vh]">
          <table className="w-full border-collapse text-[12px] min-w-[1080px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-surface-2 text-app shadow-sm">
                <th
                  rowSpan={2}
                  className="border border-app px-2 py-2 font-semibold sticky left-0 z-30 bg-surface-2 min-w-[7.5rem]"
                >
                  Feeder Name
                </th>
                <th
                  rowSpan={2}
                  className="border border-app px-2 py-2 font-semibold min-w-[5.5rem]"
                >
                  Meter Owner
                </th>
                <th
                  colSpan={3}
                  className="border border-app px-2 py-1.5 font-semibold bg-amber-200/90 dark:bg-amber-500/25"
                >
                  Energy Reading
                </th>
                <th
                  colSpan={3}
                  className="border border-app px-2 py-1.5 font-semibold bg-sky-200/90 dark:bg-sky-500/25"
                >
                  Max Load
                </th>
                <th
                  rowSpan={2}
                  className="border border-app px-2 py-2 font-semibold min-w-[5.5rem] leading-tight"
                >
                  Total Number
                  <br />
                  of Interruption
                </th>
                <th
                  rowSpan={2}
                  className="border border-app px-2 py-2 font-semibold min-w-[5.5rem] leading-tight"
                >
                  Total time of
                  <br />
                  Interruption
                </th>
                <th
                  rowSpan={2}
                  className="border border-app px-2 py-2 font-semibold min-w-[4.5rem]"
                >
                  Total LS
                  <br />
                  (mins)
                </th>
                <th rowSpan={2} className="border border-app w-14 px-1">
                  {" "}
                </th>
              </tr>
              <tr className="bg-surface-2 text-app">
                <th className="border border-app px-2 py-1 font-semibold bg-amber-100/90 dark:bg-amber-500/15 min-w-[7rem]">
                  KWH
                </th>
                <th className="border border-app px-2 py-1 font-semibold bg-amber-100/90 dark:bg-amber-500/15 min-w-[7rem]">
                  Kvarh
                </th>
                <th className="border border-app px-2 py-1 font-semibold bg-amber-100/90 dark:bg-amber-500/15 min-w-[4.5rem]">
                  Avg. PF
                </th>
                <th className="border border-app px-2 py-1 font-semibold bg-sky-100/90 dark:bg-sky-500/15 min-w-[4.5rem]">
                  MW
                </th>
                <th className="border border-app px-2 py-1 font-semibold bg-sky-100/90 dark:bg-sky-500/15 min-w-[7.5rem]">
                  Date
                </th>
                <th className="border border-app px-2 py-1 font-semibold bg-sky-100/90 dark:bg-sky-500/15 min-w-[5.5rem]">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border border-app px-4 py-12 text-center text-muted"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading sheet…
                    </span>
                  </td>
                </tr>
              ) : visibleBlocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border border-app px-4 py-10 text-center text-muted"
                  >
                    No feeders in this sheet. Use <strong>Add feeder</strong> to
                    create one.
                  </td>
                </tr>
              ) : (
                visibleBlocks.map((block) => {
                  const meters = block.meters.length
                    ? block.meters
                    : metersForCategory(block.category);
                  const meterCount = meters.length;
                  const canRemove =
                    block.custom ||
                    block.category === "auxiliary" ||
                    !FEEDERS.some((f) => f.id === block.feederId);
                  const isEditing = editingIds.has(block.feederId);

                  return meters.map((meter, mi) => (
                    <tr
                      key={`${block.feederId}-${mi}`}
                      className={isEditing ? "ring-1 ring-inset ring-accent/25" : undefined}
                    >
                      {mi === 0 && (
                        <td
                          rowSpan={meterCount}
                          className="border border-app px-2 py-1.5 align-middle sticky left-0 z-10 bg-surface-2 font-bold text-app text-[13px] group/feeder"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate flex-1" title={block.feederName}>
                              {block.feederName}
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditFeederModal(block)}
                              className="shrink-0 inline-flex p-1 rounded-md text-muted opacity-65 group-hover/feeder:opacity-100 focus:opacity-100 hover:text-accent hover:bg-accent/10 transition-opacity"
                              title="Edit feeder name / meters"
                              aria-label={`Edit ${block.feederName}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      <td
                        className={`border border-app px-2 py-1 font-semibold text-app align-top ${meterBg(meter.rowColor)}`}
                      >
                        <div className="flex flex-col gap-1">
                          <span>{meter.meterOwner}</span>
                          {isEditing &&
                            meter.meterOwner.toUpperCase() === "PDB" && (
                            <button
                              type="button"
                              onClick={() =>
                                togglePeakOffPeak(block.feederId, mi)
                              }
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border self-start ${
                                meter.hasPeakOffPeak
                                  ? "border-accent text-accent bg-accent/10"
                                  : "border-app text-muted hover:text-app"
                              }`}
                              title="Peak / Off-peak (PDB only)"
                            >
                              {meter.hasPeakOffPeak ? "Peak/Off ✓" : "Peak/Off"}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* KWH — placeholders only, no labels */}
                      <td
                        className={`border border-app px-0.5 py-0.5 align-top ${meterBg(meter.rowColor)}`}
                      >
                        {meter.meterOwner.toUpperCase() === "PDB" &&
                        meter.hasPeakOffPeak ? (
                          <div className="flex flex-col gap-0.5 p-0.5">
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditing}
                              value={numOrEmpty(meter.kwh)}
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
                            <div className="grid grid-cols-2 gap-0.5">
                              <input
                                type="number"
                                step="any"
                                disabled={!isEditing}
                                value={numOrEmpty(meter.peakKwh)}
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
                                onChange={(e) =>
                                  setMeter(
                                    block.feederId,
                                    mi,
                                    "offPeakKwh",
                                    e.target.value
                                  )
                                }
                                className={energyInput}
                                placeholder="Off-peak"
                              />
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            disabled={!isEditing}
                            value={numOrEmpty(meter.kwh)}
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

                      {/* Kvarh — placeholders only */}
                      <td
                        className={`border border-app px-0.5 py-0.5 align-top ${meterBg(meter.rowColor)}`}
                      >
                        {meter.meterOwner.toUpperCase() === "PDB" &&
                        meter.hasPeakOffPeak ? (
                          <div className="flex flex-col gap-0.5 p-0.5">
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditing}
                              value={numOrEmpty(meter.kvarh)}
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
                            <div className="grid grid-cols-2 gap-0.5">
                              <input
                                type="number"
                                step="any"
                                disabled={!isEditing}
                                value={numOrEmpty(meter.peakKvarh)}
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
                                onChange={(e) =>
                                  setMeter(
                                    block.feederId,
                                    mi,
                                    "offPeakKvarh",
                                    e.target.value
                                  )
                                }
                                className={energyInput}
                                placeholder="Off-peak"
                              />
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            disabled={!isEditing}
                            value={numOrEmpty(meter.kvarh)}
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

                      <td
                        className={`border border-app px-0.5 py-0.5 align-middle ${meterBg(meter.rowColor)}`}
                      >
                        <input
                          type="number"
                          step="0.001"
                          disabled={!isEditing}
                          value={numOrEmpty(meter.avgPf)}
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

                      {mi === 0 && (
                        <>
                          <td
                            rowSpan={meterCount}
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
                          >
                            <input
                              type="number"
                              step="0.01"
                              disabled={!isEditing}
                              value={numOrEmpty(block.maxLoadMw)}
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
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
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
                              className={`${sharedInput} min-w-[7.5rem]`}
                            />
                          </td>
                          <td
                            rowSpan={meterCount}
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
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
                              className={`${sharedInput} min-w-[5.5rem]`}
                            />
                          </td>
                          <td
                            rowSpan={meterCount}
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
                          >
                            <input
                              type="number"
                              step="1"
                              disabled={!isEditing}
                              value={numOrEmpty(block.interruptionCount)}
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
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
                          >
                            <input
                              type="number"
                              step="1"
                              disabled={!isEditing}
                              value={numOrEmpty(block.interruptionMinutes)}
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
                            className={`border border-app px-0.5 py-0.5 align-middle ${sharedBg()}`}
                          >
                            <input
                              type="number"
                              step="1"
                              disabled={!isEditing}
                              value={numOrEmpty(block.totalLsMinutes)}
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
                            className="border border-app px-0.5 py-0.5 align-middle text-center"
                          >
                            <div className="flex flex-col items-center gap-0.5">
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => stopEdit(block.feederId)}
                                  className="inline-flex p-1 rounded text-emerald-600 hover:bg-emerald-500/10"
                                  title="Done editing"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(block.feederId)}
                                  className="inline-flex p-1 rounded text-muted hover:text-accent hover:bg-accent/10"
                                  title="Edit feeder"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() => removeFeeder(block.feederId)}
                                  className="inline-flex p-1 rounded text-muted hover:text-rose-500 hover:bg-rose-500/10"
                                  title="Remove feeder"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-app bg-elevated p-4 space-y-2 shadow-sm">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
          rows={2}
          className="w-full rounded-lg border border-app bg-surface px-3 py-2 text-[13px] text-app focus:outline-none focus:ring-1 focus:ring-accent/40 resize-y"
          placeholder="Optional remarks for this month…"
        />
      </div>

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
            <div className="px-5 pt-5 pb-2 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="add-feeder-title"
                  className="text-base font-semibold text-app tracking-tight"
                >
                  {addForm.mode === "edit" ? "Edit feeder" : "Add feeder"}
                </h3>
                <p className="mt-1 text-[12px] text-muted">
                  Name, type, meters, and optional peak / off-peak rows.
                  {addForm.mode === "edit" && (
                    <span className="block mt-0.5 text-muted/80">
                      Changes apply to all months.
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-app hover:bg-surface-3"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">
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
                  placeholder="e.g. New 33 kV feeder"
                  className="w-full rounded-lg border border-app bg-surface px-3 py-2 text-[13px] text-app focus:outline-none focus:ring-1 focus:ring-accent/40"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Feeder type
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
                        className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition ${
                          active
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-app text-secondary hover:bg-surface-3"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Meters
                </label>
                <div className="flex flex-wrap gap-3">
                  {(["WZPDCL", "PDB"] as const).map((owner) => {
                    const checked = addForm.meters[owner];
                    return (
                      <label
                        key={owner}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none text-[13px] font-semibold ${
                          checked
                            ? owner === "PDB"
                              ? "border-yellow-500/60 bg-yellow-200/40 dark:bg-yellow-500/20 text-app"
                              : "border-cyan-500/60 bg-cyan-200/40 dark:bg-cyan-500/20 text-app"
                            : "border-app text-muted hover:bg-surface-3"
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
                className={`flex items-start gap-2.5 select-none ${
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
                  <span className="block text-[13px] font-semibold text-app">
                    Peak / Off-peak (PDB only)
                  </span>
                  <span className="block text-[11px] text-muted mt-0.5">
                    Total · Peak · Off-peak under KWH and Kvarh for PDB meters
                    only. WZPDCL stays single total.
                  </span>
                </span>
              </label>
            </div>

            <div className="px-5 py-4 flex gap-3 justify-end bg-surface-2 border-t border-app">
              <button
                type="button"
                disabled={modalSaving}
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-secondary bg-surface-2 border border-app hover:bg-surface-3 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSaving}
                onClick={submitFeederModal}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {modalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {addForm.mode === "edit" ? "Save changes" : "Add feeder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
