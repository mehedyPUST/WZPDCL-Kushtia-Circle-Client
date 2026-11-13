import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { connectDB, isDbConnected } from "@/lib/db";
import MonthlyEnergyReading from "@/lib/models/MonthlyEnergyReading";
import Settings from "@/lib/models/Settings";
import { getMockStore, generateId } from "@/lib/mockStore";
import { FEEDERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const DEFAULT_METER_OWNERS = ["PDB", "WZPDCL"];

function isAdminUser(admin: any) {
  const r = String(admin?.role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
}

function coreFeederDefs() {
  return FEEDERS.map((f) => ({
    feederId: f.id,
    feederName: f.name,
    category: "33kv",
    meterOwners: [...DEFAULT_METER_OWNERS],
    hasPeakOffPeak: false,
    custom: false,
  }));
}

function normalizeFeederDef(raw: any) {
  const feederId = Number(raw?.feederId) || 0;
  if (!feederId) return null;
  const owners = Array.isArray(raw?.meterOwners)
    ? raw.meterOwners.map((o: any) => String(o || "").trim()).filter(Boolean)
    : DEFAULT_METER_OWNERS;
  const cat = String(raw?.category || "33kv").trim().toLowerCase();
  const category =
    cat === "11kv" || cat === "auxiliary" || cat === "33kv" ? cat : "33kv";
  return {
    feederId,
    feederName: String(raw?.feederName || `Feeder ${feederId}`).trim(),
    category,
    meterOwners: owners.length ? owners : [...DEFAULT_METER_OWNERS],
    hasPeakOffPeak: !!raw?.hasPeakOffPeak,
    custom:
      raw?.custom !== false && !FEEDERS.some((c) => c.id === feederId),
  };
}

function mergeFeederRegistry(stored: any[]) {
  const byId = new Map<number, any>();
  for (const f of coreFeederDefs()) byId.set(f.feederId, f);
  const hasAux = (Array.isArray(stored) ? stored : []).some(
    (s) => String(s.category || "").toLowerCase() === "auxiliary"
  );
  if (!hasAux) {
    byId.set(9001, {
      feederId: 9001,
      feederName: "Station Auxiliary",
      category: "auxiliary",
      meterOwners: [...DEFAULT_METER_OWNERS],
      hasPeakOffPeak: false,
      custom: true,
    });
  }
  for (const s of Array.isArray(stored) ? stored : []) {
    const n = normalizeFeederDef(s);
    if (!n) continue;
    if (FEEDERS.some((c) => c.id === n.feederId)) {
      const prev = byId.get(n.feederId);
      byId.set(n.feederId, {
        ...prev,
        feederName: n.feederName || prev.feederName,
        hasPeakOffPeak: n.hasPeakOffPeak,
        meterOwners: n.meterOwners?.length ? n.meterOwners : prev.meterOwners,
        custom: false,
      });
    } else {
      byId.set(n.feederId, n);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ac = a.category === "33kv" ? 0 : a.category === "11kv" ? 1 : 2;
    const bc = b.category === "33kv" ? 0 : b.category === "11kv" ? 1 : 2;
    if (ac !== bc) return ac - bc;
    const aCore = FEEDERS.some((c) => c.id === a.feederId) ? 0 : 1;
    const bCore = FEEDERS.some((c) => c.id === b.feederId) ? 0 : 1;
    if (aCore !== bCore) return aCore - bCore;
    return a.feederId - b.feederId;
  });
}

function rowsFromFeeders(feeders: any[]) {
  const rows: any[] = [];
  for (const f of feeders) {
    const owners =
      Array.isArray(f.meterOwners) && f.meterOwners.length
        ? f.meterOwners
        : DEFAULT_METER_OWNERS;
    for (const owner of owners) {
      rows.push({
        feederId: f.feederId,
        feederName: f.feederName,
        category: f.category,
        meterOwner: owner,
        kwh: null,
        kvarh: null,
        avgPf: null,
        hasPeakOffPeak: !!f.hasPeakOffPeak,
        peakKwh: null,
        offPeakKwh: null,
        peakKvarh: null,
        offPeakKvarh: null,
        maxLoadMw: null,
        maxLoadDate: "",
        maxLoadTime: "",
        interruptionCount: null,
        interruptionMinutes: null,
        totalLsMinutes: null,
        rowColor:
          owner === "PDB" ? "yellow" : owner === "WZPDCL" ? "cyan" : "",
      });
    }
  }
  return rows;
}

function ensureRowsForFeeders(existingRows: any[], feeders: any[]) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const key = (fid: any, owner: any) =>
    `${Number(fid)}::${String(owner || "").toLowerCase()}`;
  const map = new Map<string, any>();
  for (const r of existing) {
    map.set(key(r.feederId, r.meterOwner), r);
  }
  const out: any[] = [];
  for (const f of feeders) {
    const owners =
      Array.isArray(f.meterOwners) && f.meterOwners.length
        ? f.meterOwners
        : DEFAULT_METER_OWNERS;
    for (const owner of owners) {
      const k = key(f.feederId, owner);
      const prev = map.get(k);
      if (prev) {
        out.push({
          ...prev,
          feederName: f.feederName || prev.feederName,
          category: f.category || prev.category,
          meterOwner: owner,
          hasPeakOffPeak:
            prev.hasPeakOffPeak != null
              ? !!prev.hasPeakOffPeak
              : !!f.hasPeakOffPeak,
        });
        map.delete(k);
      } else {
        out.push({
          feederId: f.feederId,
          feederName: f.feederName,
          category: f.category,
          meterOwner: owner,
          kwh: null,
          kvarh: null,
          avgPf: null,
          hasPeakOffPeak: !!f.hasPeakOffPeak,
          peakKwh: null,
          offPeakKwh: null,
          peakKvarh: null,
          offPeakKvarh: null,
          maxLoadMw: null,
          maxLoadDate: "",
          maxLoadTime: "",
          interruptionCount: null,
          interruptionMinutes: null,
          totalLsMinutes: null,
          rowColor:
            owner === "PDB" ? "yellow" : owner === "WZPDCL" ? "cyan" : "",
        });
      }
    }
  }
  return out;
}

function feedersFromRows(rows: any[]) {
  const byId = new Map<number, any>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = Number(r.feederId) || 0;
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        feederId: id,
        feederName: String(r.feederName || `Feeder ${id}`),
        category: String(r.category || "33kv"),
        meterOwners: [] as string[],
        hasPeakOffPeak: !!r.hasPeakOffPeak,
        custom: !FEEDERS.some((c) => c.id === id),
      });
    }
    const f = byId.get(id)!;
    if (r.feederName) f.feederName = String(r.feederName);
    if (r.category) f.category = String(r.category);
    if (r.hasPeakOffPeak) f.hasPeakOffPeak = true;
    const owner = String(r.meterOwner || "").trim();
    if (owner && !f.meterOwners.includes(owner)) f.meterOwners.push(owner);
  }
  return Array.from(byId.values());
}

function serialize(doc: any) {
  if (!doc) return null;
  const id = doc._id?.toString?.() || doc.id || String(doc._id);
  return {
    id,
    year: doc.year,
    month: doc.month,
    stationName: doc.stationName || "Bottail SS",
    rows: Array.isArray(doc.rows) ? doc.rows : [],
    notes: doc.notes || "",
    updatedByUsername: doc.updatedByUsername || "",
    updatedByDisplayName: doc.updatedByDisplayName || "",
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

const numOrNull = (v: any) =>
  v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v);

function mapRows(rowsIn: any[]) {
  return (Array.isArray(rowsIn) ? rowsIn : []).map((r: any) => ({
    feederId: Number(r.feederId) || 0,
    feederName: String(r.feederName || "").trim(),
    meterOwner: String(r.meterOwner || "").trim(),
    category: String(r.category || "").trim(),
    kwh: numOrNull(r.kwh),
    kvarh: numOrNull(r.kvarh),
    avgPf: numOrNull(r.avgPf),
    hasPeakOffPeak: !!r.hasPeakOffPeak,
    peakKwh: numOrNull(r.peakKwh),
    offPeakKwh: numOrNull(r.offPeakKwh),
    peakKvarh: numOrNull(r.peakKvarh),
    offPeakKvarh: numOrNull(r.offPeakKvarh),
    maxLoadMw: numOrNull(r.maxLoadMw),
    maxLoadDate: String(r.maxLoadDate || "").trim(),
    maxLoadTime: String(r.maxLoadTime || "").trim(),
    interruptionCount: numOrNull(r.interruptionCount),
    interruptionMinutes: numOrNull(r.interruptionMinutes),
    totalLsMinutes: numOrNull(r.totalLsMinutes),
    rowColor: String(r.rowColor || "").trim(),
  }));
}

async function getSettingsDoc() {
  let doc = await Settings.findOne({ key: "app" });
  if (!doc) doc = await Settings.create({ key: "app" });
  return doc;
}

async function loadRegistryDb() {
  const settings = await getSettingsDoc();
  return mergeFeederRegistry(settings.energyFeeders || []);
}

async function saveRegistryDb(feeders: any[]) {
  const settings = await getSettingsDoc();
  const normalized = mergeFeederRegistry(feeders);
  settings.energyFeeders = normalized;
  settings.markModified?.("energyFeeders");
  await settings.save();
  return normalized;
}

function loadRegistryMock(store: any) {
  store.energyFeeders = store.energyFeeders || [];
  return mergeFeederRegistry(store.energyFeeders);
}

function saveRegistryMock(store: any, feeders: any[]) {
  const normalized = mergeFeederRegistry(feeders);
  store.energyFeeders = normalized;
  return normalized;
}

/** GET ?year=&month= */
export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    let year = parseInt(searchParams.get("year") || "", 10);
    let month = parseInt(searchParams.get("month") || "", 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      year = now.getFullYear();
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      month = now.getMonth() + 1;
    }

    if (!isDbConnected()) await connectDB();

    if (!isDbConnected()) {
      const store = getMockStore();
      store.monthlyEnergySheets = store.monthlyEnergySheets || [];
      let feeders = loadRegistryMock(store);
      let sheet = store.monthlyEnergySheets.find(
        (s: any) => s.year === year && s.month === month
      );
      if (!sheet) {
        sheet = {
          id: generateId(),
          year,
          month,
          stationName: "Bottail SS",
          rows: rowsFromFeeders(feeders),
          notes: "",
          updatedByUsername: "",
          updatedByDisplayName: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.monthlyEnergySheets.push(sheet);
      } else {
        sheet.rows = ensureRowsForFeeders(sheet.rows, feeders);
      }
      return NextResponse.json({
        success: true,
        sheet: serialize(sheet),
        feeders,
      });
    }

    let feeders = await loadRegistryDb();
    let doc = await MonthlyEnergyReading.findOne({ year, month });
    if (!doc) {
      doc = await MonthlyEnergyReading.create({
        year,
        month,
        stationName: "Bottail SS",
        rows: rowsFromFeeders(feeders),
        notes: "",
      });
    } else {
      const aligned = ensureRowsForFeeders(doc.rows, feeders);
      doc.rows = aligned;
      await doc.save();
    }

    return NextResponse.json({
      success: true,
      sheet: serialize(doc.toObject ? doc.toObject() : doc),
      feeders,
    });
  } catch (err: any) {
    console.error("[monthly-energy GET]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to load sheet" },
      { status: 500 }
    );
  }
}

/** PUT — save sheet + global feeder registry */
export async function PUT(request: Request) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!isAdminUser(auth.admin)) {
    return NextResponse.json(
      { success: false, message: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    let year = parseInt(String(body?.year ?? ""), 10);
    let month = parseInt(String(body?.month ?? ""), 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, message: "Valid year is required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Valid month is required" },
        { status: 400 }
      );
    }

    const rows = mapRows(body?.rows);
    const admin = auth.admin || {};
    const username = admin.username || "";
    const displayName = admin.displayName || admin.username || "";
    const notes = String(body?.notes || "").trim();

    if (!isDbConnected()) await connectDB();

    if (!isDbConnected()) {
      const store = getMockStore();
      store.monthlyEnergySheets = store.monthlyEnergySheets || [];
      let feeders: any[];
      if (Array.isArray(body?.feeders)) {
        feeders = saveRegistryMock(store, body.feeders);
      } else {
        const derived = feedersFromRows(rows);
        const current = loadRegistryMock(store);
        feeders = saveRegistryMock(store, [...current, ...derived]);
      }
      const alignedRows = ensureRowsForFeeders(rows, feeders);
      let sheet = store.monthlyEnergySheets.find(
        (s: any) => s.year === year && s.month === month
      );
      const nowIso = new Date().toISOString();
      if (!sheet) {
        sheet = {
          id: generateId(),
          year,
          month,
          stationName: "Bottail SS",
          createdAt: nowIso,
        };
        store.monthlyEnergySheets.push(sheet);
      }
      sheet.rows = alignedRows;
      sheet.notes = notes;
      sheet.updatedByUsername = username;
      sheet.updatedByDisplayName = displayName;
      sheet.updatedAt = nowIso;
      return NextResponse.json({
        success: true,
        sheet: serialize(sheet),
        feeders,
      });
    }

    let feeders: any[];
    if (Array.isArray(body?.feeders)) {
      feeders = await saveRegistryDb(body.feeders);
    } else {
      const derived = feedersFromRows(rows);
      const current = await loadRegistryDb();
      feeders = await saveRegistryDb([...current, ...derived]);
    }
    const alignedRows = ensureRowsForFeeders(rows, feeders);

    const doc = await MonthlyEnergyReading.findOneAndUpdate(
      { year, month },
      {
        $set: {
          rows: alignedRows,
          notes,
          stationName: "Bottail SS",
          updatedByUsername: username,
          updatedByDisplayName: displayName,
        },
        $setOnInsert: { year, month },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      sheet: serialize(doc.toObject ? doc.toObject() : doc),
      feeders,
    });
  } catch (err: any) {
    console.error("[monthly-energy PUT]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to save sheet" },
      { status: 500 }
    );
  }
}
