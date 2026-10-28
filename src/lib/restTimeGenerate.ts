/**
 * Rest-time (01:00–07:00) load generation from anchors 00:00 & 08:00
 * and optional intermediate slots.
 */
import { FEEDERS } from "./constants";

export const REST_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const REST_SLOT_LABELS = REST_HOURS.map(
  (h) => `${String(h).padStart(2, "0")}:00`
);
export const REQUIRED_SLOTS = ["00:00", "08:00"];
export const OPTIONAL_REST_SLOTS = [
  "01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00",
];
export const PREV_CONTEXT_SLOTS = ["22:00", "23:00"];
export const RESIDENTIAL_IDS = new Set([3, 4, 5, 6]);
export const STABLE_IDS = new Set([1, 2, 7, 8, 9]);

/** Practical 33 kV bus ceilings at light load (operator guidance) */
export const BUS1_MAX_KV = 36.0;
export const BUS2_MAX_KV = 35.6;

export function approximateFajrHour(month) {
  const m = Math.min(12, Math.max(1, month || 1));
  const table = {
    1: 5.5, 2: 5.3, 3: 5.0, 4: 4.6, 5: 4.3, 6: 4.1,
    7: 4.2, 8: 4.5, 9: 4.7, 10: 5.0, 11: 5.2, 12: 5.4,
  };
  return table[m] ?? 5.0;
}

function parseSlotHour(label) {
  const m = String(label || "").match(/^(\d{1,2}):/);
  return m ? Number(m[1]) : null;
}

function isFridayYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay() === 5;
}

function noise01(dayKey, feederId, hour) {
  const s = `${dayKey}|${feederId}|${hour}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 5000 - 1;
}

function interpKnown(known, hour) {
  const keys = Object.keys(known)
    .map(Number)
    .filter((h) => Number.isFinite(known[h]))
    .sort((a, b) => a - b);
  if (keys.length === 0) return 0;
  if (keys.length === 1) return known[keys[0]];
  if (hour <= keys[0]) return known[keys[0]];
  if (hour >= keys[keys.length - 1]) return known[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (hour >= a && hour <= b) {
      const t = (hour - a) / (b - a);
      return known[a] + (known[b] - known[a]) * t;
    }
  }
  return known[keys[keys.length - 1]];
}

function residentialDipFraction(hour, fajrH) {
  const low = Math.min(6, Math.max(2, fajrH));
  if (hour <= 0 || hour >= 8) return 0;
  if (hour <= low) return -Math.sin(((hour / low) * Math.PI) / 2);
  return -Math.cos((((hour - low) / (8 - low)) * Math.PI) / 2);
}

function sumAmps(ampsMap) {
  let s = 0;
  FEEDERS.forEach((f) => {
    const v = parseFloat(ampsMap?.[f.id] ?? ampsMap?.[String(f.id)]);
    if (Number.isFinite(v) && v > 0) s += v;
  });
  return s;
}

/**
 * Voltage rises when load falls. Uses 00:00 / 08:00 anchors + inverse load lift.
 * Caps: Bus-1 ≤ 36.0 kV, Bus-2 ≤ 35.6 kV.
 */
function predictBusKv({
  hour,
  totalAmps,
  knownBus,
  loadByHour,
  maxKv,
}) {
  if (knownBus[hour] != null) return knownBus[hour];

  const base = interpKnown(knownBus, hour);
  if (!base || base <= 0) {
    // fallback near nominal 33 kV if no voltage anchors
    const nominal = Math.min(maxKv, 33.5);
    return nominal;
  }

  const loads = Object.values(loadByHour).filter((x) => x > 0);
  const loadRef = loads.length ? Math.max(...loads) : totalAmps || 1;
  const loadNow = totalAmps || loadRef;
  // 0 when at max load, 1 when load → 0
  const relief = Math.max(0, Math.min(1, 1 - loadNow / loadRef));
  // How much headroom to ceiling from the lighter of the endpoint voltages
  const v0 = knownBus[0];
  const v8 = knownBus[8];
  const vFloor = Math.min(
    v0 != null ? v0 : base,
    v8 != null ? v8 : base,
    base
  );
  const headroom = Math.max(0, maxKv - vFloor);
  // Stronger lift near deepest residential dip (overnight)
  const dipBoost = Math.abs(residentialDipFraction(hour, 5)) * 0.35 + 0.65;
  const lift = headroom * relief * 0.85 * dipBoost;
  const v = base + lift;
  return Math.round(Math.min(maxKv, Math.max(vFloor * 0.995, v)) * 100) / 100;
}

export function generateRestTimeData({ dayKey, slots = {} }) {
  const month = dayKey ? Number(dayKey.split("-")[1]) : new Date().getMonth() + 1;
  const fajrH = approximateFajrHour(month);
  const friday = isFridayYmd(dayKey);

  if (!slots["00:00"] || !slots["08:00"]) {
    throw new Error("00:00 and 08:00 data are required");
  }

  const knownByFeeder = {};
  const knownBus1 = {};
  const knownBus2 = {};
  FEEDERS.forEach((f) => {
    knownByFeeder[f.id] = {};
  });

  for (const label of REST_SLOT_LABELS) {
    const block = slots[label];
    if (!block) continue;
    const hour = parseSlotHour(label);
    if (hour == null) continue;
    FEEDERS.forEach((f) => {
      const v = parseFloat(block.amps?.[f.id] ?? block.amps?.[String(f.id)]);
      if (Number.isFinite(v) && v >= 0) knownByFeeder[f.id][hour] = v;
    });
    const b1 = parseFloat(block.bus1);
    const b2 = parseFloat(block.bus2);
    if (Number.isFinite(b1) && b1 > 0) knownBus1[hour] = b1;
    if (Number.isFinite(b2) && b2 > 0) knownBus2[hour] = b2;
  }

  if (
    !FEEDERS.some((f) => knownByFeeder[f.id][0] != null) ||
    !FEEDERS.some((f) => knownByFeeder[f.id][8] != null)
  ) {
    throw new Error("Enter feeder amps for both 00:00 and 08:00");
  }

  // First pass: amps
  const ampRows = {};
  const sourceRows = {};
  const loadByHour = {};

  for (const hour of REST_HOURS) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    const amps = {};
    const source = {};
    FEEDERS.forEach((f) => {
      const known = knownByFeeder[f.id];
      if (known[hour] != null) {
        amps[f.id] = Math.round(known[hour]);
        source[f.id] = "anchor";
        return;
      }
      let base = interpKnown(known, hour);
      const a0 = known[0];
      const a8 = known[8];
      const scaleRef =
        a0 != null && a8 != null ? (a0 + a8) / 2 : a0 ?? a8 ?? base;
      if (RESIDENTIAL_IDS.has(f.id)) {
        base =
          base +
          residentialDipFraction(hour, fajrH) * Math.max(0, scaleRef) * 0.22;
      } else if (STABLE_IDS.has(f.id)) {
        base =
          base +
          residentialDipFraction(hour, fajrH) * Math.max(0, scaleRef) * 0.03;
        if (f.id === 1) base = base * (1 + noise01(dayKey, 1, hour) * 0.025);
      }
      if (friday && f.id === 1 && hour >= 7) base = 0;
      else if (friday && f.id === 1 && hour === 6) base = base * 0.35;
      amps[f.id] = Math.max(0, Math.round(base));
      source[f.id] = "predicted";
    });
    ampRows[label] = amps;
    sourceRows[label] = source;
    loadByHour[hour] = sumAmps(amps);
  }

  // Second pass: voltages inverse to load
  const out = {};
  for (const hour of REST_HOURS) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    const amps = ampRows[label];
    const totalAmps = loadByHour[hour];
    const bus1 = predictBusKv({
      hour,
      totalAmps,
      knownBus: knownBus1,
      loadByHour,
      maxKv: BUS1_MAX_KV,
    });
    const bus2 = predictBusKv({
      hour,
      totalAmps,
      knownBus: knownBus2,
      loadByHour,
      maxKv: BUS2_MAX_KV,
    });
    out[label] = {
      amps,
      bus1,
      bus2,
      source: sourceRows[label],
      busSource: {
        bus1: knownBus1[hour] != null ? "anchor" : "predicted",
        bus2: knownBus2[hour] != null ? "anchor" : "predicted",
      },
    };
  }

  return {
    slots: out,
    meta: {
      dayKey,
      friday,
      fajrHour: fajrH,
      requiredOk: true,
      bus1Max: BUS1_MAX_KV,
      bus2Max: BUS2_MAX_KV,
    },
  };
}
