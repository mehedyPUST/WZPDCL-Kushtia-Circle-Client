import crypto from "node:crypto";
import { buildCalculationResult } from "./calculations";
import { BOTTAIL_11KV_IDS, FEEDERS } from "./constants";
import { dhakaNowParts } from "./dutyShifts";
import { normalizeAuthRole, type NormalizedRole } from "./shiftSession";
import {
  currentShiftInfo,
  nextShiftId,
  normalizePriority,
  type SerializedReadReceipt,
  type StationNotePriority,
} from "./stationNoteUtils";

export interface StoreUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: NormalizedRole;
  passwordHash: string;
  active: boolean;
  assignedStations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreCalculation {
  _id: string;
  id: string;
  date: string;
  time: string;
  hourSlot: string;
  isRegularHour: boolean;
  isSpecialSlot: boolean;
  bus1Voltage: number;
  bus2Voltage: number;
  busVoltages: { bus1: number; bus2: number };
  feeders: Record<string, any>;
  feederAmps: Record<string, number>;
  ringActive: Record<string, boolean>;
  loadshedMW: Record<string, number>;
  totalMW: number;
  bus1TotalMW: number;
  bus2TotalMW: number;
  bus1Amps: number;
  bus2Amps: number;
  totalAmps: number;
  bottail11TotalMW: number;
  totalLoadshedMW: number;
  notes: string;
  createdBy: string | null;
  createdByUsername: string;
  createdByDisplayName: string;
  createdByRole: string;
  deleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreStationNote {
  id: string;
  content: string;
  createdBy: string | null;
  createdByUsername: string;
  createdByDisplayName: string;
  dutyDay: string;
  fromShift: string;
  targetShift: string;
  status: "pending" | "acknowledged" | "forwarded";
  priority: StationNotePriority;
  acknowledgedBy: string | null;
  acknowledgedByUsername: string;
  acknowledgedByDisplayName: string;
  acknowledgedAt: string | null;
  forwardedFrom: string | null;
  forwardNote: string;
  readReceipts: SerializedReadReceipt[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreCircleEntry {
  actualLoad: number | null;
  pgcbAllotment: number | null;
  loadshed: number | null;
  pbsLoad?: number | null;
  pbsAllotment?: number | null;
  pbsLoadshed?: number | null;
  updatedByUsername?: string;
  updatedAt?: string;
}

export interface StoreState {
  users: StoreUser[];
  calculations: StoreCalculation[];
  stationNotes: StoreStationNote[];
  settings: Record<string, any>;
  circleEntries: Record<string, StoreCircleEntry>;
  monthlyEnergySheets: Record<string, any>;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(8).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

export function sanitizeUser(u: StoreUser) {
  return {
    id: u.id,
    _id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: normalizeAuthRole(u.role),
    active: u.active,
    assignedStations: u.assignedStations || [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function dhakaTimestamp(ymd: string, hour: number, minute = 0): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour - 6, minute, 0, 0);
  return new Date(utcMs).toISOString();
}

function shiftDateYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function seedCalculations(todayYmd: string): StoreCalculation[] {
  const sampleSpecs = [
    {
      ymd: todayYmd,
      hour: 6,
      user: { id: "u-duty-2", username: "bottail.dilip", displayName: "Dilip Kumar", role: "duty" },
      v1: 33.2,
      v2: 33.0,
      amps: { 1: 42, 2: 18, 3: 112, 4: 86, 5: 64, 6: 94, 7: 78, 8: 22, 9: 34 },
      ls: { 3: 0.4, 6: 0.3 },
    },
    {
      ymd: todayYmd,
      hour: 8,
      user: { id: "u-duty-1", username: "duty", displayName: "Duty Officer", role: "duty" },
      v1: 33.4,
      v2: 33.1,
      amps: { 1: 48, 2: 20, 3: 126, 4: 95, 5: 72, 6: 108, 7: 88, 8: 26, 9: 40 },
      ls: { 4: 0.5 },
    },
    {
      ymd: todayYmd,
      hour: 12,
      user: { id: "u-admin", username: "admin", displayName: "Bottail SS Admin", role: "admin" },
      v1: 33.1,
      v2: 32.9,
      amps: { 1: 54, 2: 22, 3: 138, 4: 104, 5: 80, 6: 118, 7: 96, 8: 30, 9: 44 },
      ls: {},
    },
    {
      ymd: shiftDateYmd(todayYmd, -1),
      hour: 19,
      user: { id: "u-duty-1", username: "duty", displayName: "Duty Officer", role: "duty" },
      v1: 32.8,
      v2: 32.6,
      amps: { 1: 60, 2: 26, 3: 152, 4: 116, 5: 90, 6: 134, 7: 110, 8: 35, 9: 52 },
      ls: { 3: 0.8, 7: 0.6 },
    },
    {
      ymd: shiftDateYmd(todayYmd, -1),
      hour: 23,
      user: { id: "u-duty-2", username: "bottail.dilip", displayName: "Dilip Kumar", role: "duty" },
      v1: 33.3,
      v2: 33.2,
      amps: { 1: 36, 2: 14, 3: 94, 4: 72, 5: 55, 6: 82, 7: 66, 8: 18, 9: 28 },
      ls: {},
    },
  ];

  return sampleSpecs.map((spec, idx) => {
    const slot = `${String(spec.hour).padStart(2, "0")}:00`;
    const calc = buildCalculationResult(
      spec.amps,
      { bus1: spec.v1, bus2: spec.v2 },
      {}
    );
    const ts = dhakaTimestamp(spec.ymd, spec.hour, 2);
    const feedersObj: Record<string, any> = {};
    let totalLs = 0;
    let bus1TotalMW = 0;
    let bus2TotalMW = 0;
    let bus1Amps = 0;
    let bus2Amps = 0;
    for (const f of calc.feeders) {
      const lsMw = Number((spec.ls as Record<number, number>)[f.id] || 0);
      totalLs += lsMw;
      if (f.bus === 1) {
        bus1TotalMW += f.mw;
        bus1Amps += f.amps;
      } else {
        bus2TotalMW += f.mw;
        bus2Amps += f.amps;
      }
      feedersObj[String(f.id)] = {
        ...f,
        lsMW: lsMw,
      };
    }

    return {
      _id: `calc-seed-${idx + 1}`,
      id: `calc-seed-${idx + 1}`,
      date: spec.ymd,
      time: slot,
      hourSlot: slot,
      isRegularHour: true,
      isSpecialSlot: false,
      bus1Voltage: spec.v1,
      bus2Voltage: spec.v2,
      busVoltages: { bus1: spec.v1, bus2: spec.v2 },
      feeders: feedersObj,
      feederAmps: Object.fromEntries(
        Object.entries(spec.amps).map(([k, v]) => [k, Number(v)])
      ),
      ringActive: {},
      loadshedMW: Object.fromEntries(
        Object.entries(spec.ls).map(([k, v]) => [k, Number(v)])
      ),
      totalMW: calc.totalMW,
      bus1TotalMW: Number(bus1TotalMW.toFixed(2)),
      bus2TotalMW: Number(bus2TotalMW.toFixed(2)),
      bus1Amps: Number(bus1Amps.toFixed(1)),
      bus2Amps: Number(bus2Amps.toFixed(1)),
      totalAmps: Number((bus1Amps + bus2Amps).toFixed(1)),
      bottail11TotalMW: calc.bottail11kV,
      totalLoadshedMW: Number(totalLs.toFixed(2)),
      notes: idx === 0 ? "Morning grid dispatch nominal" : "",
      createdBy: spec.user.id,
      createdByUsername: spec.user.username,
      createdByDisplayName: spec.user.displayName,
      createdByRole: spec.user.role,
      deleted: false,
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
  });
}

function createInitialStore(): StoreState {
  const now = new Date();
  const nowIso = now.toISOString();
  const dhaka = dhakaNowParts(now);
  const shiftMeta = currentShiftInfo(now);
  const nextShift = nextShiftId(shiftMeta.shift);

  const users: StoreUser[] = [
    {
      id: "u-admin",
      username: "admin",
      displayName: "Bottail SS Admin",
      email: "admin@wzpdcl.gov.bd",
      role: "admin",
      passwordHash: hashPassword("admin123"),
      active: true,
      assignedStations: ["bottail", "kushtia", "bheramara", "kumarkhali", "khoksha"],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "u-duty-1",
      username: "duty",
      displayName: "Duty Officer",
      email: "duty@wzpdcl.gov.bd",
      role: "duty",
      passwordHash: hashPassword("duty123"),
      active: true,
      assignedStations: ["bottail"],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "u-duty-2",
      username: "bottail.dilip",
      displayName: "Dilip Kumar",
      email: "dilip@wzpdcl.gov.bd",
      role: "duty",
      passwordHash: hashPassword("duty123"),
      active: true,
      assignedStations: ["bottail"],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "u-circle-1",
      username: "bheramara.op",
      displayName: "Bheramara Operator",
      email: "bheramara@wzpdcl.gov.bd",
      role: "circle-load-input",
      passwordHash: hashPassword("circle123"),
      active: true,
      assignedStations: ["bheramara"],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "u-viewer",
      username: "viewer",
      displayName: "Control Room Viewer",
      email: "viewer@wzpdcl.gov.bd",
      role: "viewer",
      passwordHash: hashPassword("viewer123"),
      active: true,
      assignedStations: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const t1 = new Date(now.getTime() - 25 * 60 * 1000).toISOString();
  const t2 = new Date(now.getTime() - 125 * 60 * 1000).toISOString();
  const t3 = new Date(now.getTime() - 260 * 60 * 1000).toISOString();
  const t4 = new Date(now.getTime() - 410 * 60 * 1000).toISOString();

  const stationNotes: StoreStationNote[] = [
    {
      id: "note-seed-1",
      content:
        "33 kV Kushtia-2 feeder experiencing peak evening industrial draw; monitor relay OLTC tap at Step-4 before 18:00 changeover.",
      createdBy: "u-duty-2",
      createdByUsername: "bottail.dilip",
      createdByDisplayName: "Dilip Kumar",
      dutyDay: shiftMeta.dutyDay,
      fromShift: shiftMeta.shift,
      targetShift: nextShift,
      status: "pending",
      priority: "critical",
      acknowledgedBy: null,
      acknowledgedByUsername: "",
      acknowledgedByDisplayName: "",
      acknowledgedAt: null,
      forwardedFrom: null,
      forwardNote: "",
      readReceipts: [
        {
          userId: "u-duty-1",
          username: "duty",
          displayName: "Duty Officer",
          shift: shiftMeta.shift,
          readAt: t1,
        },
      ],
      createdAt: t1,
      updatedAt: t1,
    },
    {
      id: "note-seed-2",
      content:
        "Circle control instructed 0.5 MW rotational relief on feeder F-4 during Grid peak if Bus-1 falls below 32.4 kV.",
      createdBy: "u-admin",
      createdByUsername: "admin",
      createdByDisplayName: "Bottail SS Admin",
      dutyDay: shiftMeta.dutyDay,
      fromShift: shiftMeta.shift,
      targetShift: nextShift,
      status: "pending",
      priority: "high",
      acknowledgedBy: null,
      acknowledgedByUsername: "",
      acknowledgedByDisplayName: "",
      acknowledgedAt: null,
      forwardedFrom: null,
      forwardNote: "",
      readReceipts: [],
      createdAt: t2,
      updatedAt: t2,
    },
    {
      id: "note-seed-3",
      content:
        "Bottail H-3 & T-3 transformer oil temperature normal (46°C / 44°C). Morning hourly logsheet slots verified and synced.",
      createdBy: "u-duty-1",
      createdByUsername: "duty",
      createdByDisplayName: "Duty Officer",
      dutyDay: shiftMeta.dutyDay,
      fromShift: "A",
      targetShift: "B",
      status: "acknowledged",
      priority: "normal",
      acknowledgedBy: "u-duty-2",
      acknowledgedByUsername: "bottail.dilip",
      acknowledgedByDisplayName: "Dilip Kumar",
      acknowledgedAt: t2,
      forwardedFrom: null,
      forwardNote: "",
      readReceipts: [
        {
          userId: "u-duty-2",
          username: "bottail.dilip",
          displayName: "Dilip Kumar",
          shift: "B",
          readAt: t2,
        },
      ],
      createdAt: t3,
      updatedAt: t2,
    },
    {
      id: "note-seed-4",
      content:
        "Routine switchyard breaker SF6 pressure inspection completed for Bus-1 and Bus-2 bays. All gauges green.",
      createdBy: "u-duty-2",
      createdByUsername: "bottail.dilip",
      createdByDisplayName: "Dilip Kumar",
      dutyDay: shiftDateYmd(dhaka.ymd, -1),
      fromShift: "C",
      targetShift: "A",
      status: "forwarded",
      priority: "normal",
      acknowledgedBy: "u-admin",
      acknowledgedByUsername: "admin",
      acknowledgedByDisplayName: "Bottail SS Admin",
      acknowledgedAt: t3,
      forwardedFrom: null,
      forwardNote: "Carry forward into A-shift logbook",
      readReceipts: [
        {
          userId: "u-admin",
          username: "admin",
          displayName: "Bottail SS Admin",
          shift: "A",
          readAt: t3,
        },
      ],
      createdAt: t4,
      updatedAt: t3,
    },
  ];

  return {
    users,
    calculations: seedCalculations(dhaka.ymd),
    stationNotes,
    settings: {
      stationName: "Bottail SS",
      stationOrg: "WZPDCL",
      defaultBus1Kv: 33,
      defaultBus2Kv: 33,
      bus1MaxKv: 36,
      bus2MaxKv: 35.6,
      maxLoadRingMode: "with",
      calculatorRingActive: {},
      trashRetentionDays: 30,
      circleRelaxUntil: "12:00",
      circleRelaxedSlots: ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00", "08:00"],
      districtDayBoundary: "22:00",
      nightLogStartSlot: "00:00",
      nightLogEndSlot: "08:00",
      nightLogUseAi: true,
    },
    circleEntries: {},
    monthlyEnergySheets: {},
  };
}

declare global {
  var __wzpdclMockStore: StoreState | undefined;
}

export function getStore(): StoreState {
  if (!globalThis.__wzpdclMockStore) {
    globalThis.__wzpdclMockStore = createInitialStore();
  }
  return globalThis.__wzpdclMockStore;
}

export function normalizeFeederRecord(calc: StoreCalculation) {
  return {
    ...calc,
    _id: calc._id || calc.id,
    id: calc.id || calc._id,
    bottail11TotalMW:
      calc.bottail11TotalMW ??
      BOTTAIL_11KV_IDS.reduce((acc, fid) => {
        const f = calc.feeders?.[String(fid)];
        return acc + Number(f?.mw || 0);
      }, 0),
  };
}

export function getDefaultFeederRegistry() {
  return FEEDERS.map((f) => ({
    id: f.id,
    name: f.name,
    bus: f.bus,
    category: BOTTAIL_11KV_IDS.includes(f.id) ? "11kv" : "33kv",
  }));
}
