import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, keyHex] = stored.split(":");
  const keyBuf = Buffer.from(keyHex, "hex");
  const derived = scryptSync(String(password), salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}

export function generateId() {
  return randomBytes(12).toString("hex");
}

function createInitialStore() {
  const now = new Date().toISOString();
  return {
    calculations: [],
    settings: {
      key: "app",
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
      circleRelaxedSlots: [
        "01:00",
        "02:00",
        "03:00",
        "04:00",
        "05:00",
        "06:00",
        "07:00",
        "08:00",
      ],
      districtDayBoundary: "22:00",
    },
    circleEntries: new Map(),
    users: [
      {
        id: "admin-default-1",
        username: "admin",
        displayName: "Bottail SS Admin",
        role: "admin",
        assignedStation: "",
        isActive: true,
        passwordHash: hashPassword("admin123"),
        createdAt: now,
        lastLogin: null,
      },
    ],
  };
}

export function getMockStore() {
  if (!globalThis.__wzpdclMockStore) {
    globalThis.__wzpdclMockStore = createInitialStore();
  }
  return globalThis.__wzpdclMockStore;
}
