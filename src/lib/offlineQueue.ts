/**
 * Offline queue for calculation payloads.
 * Primary: IndexedDB. Fallback: localStorage (private mode / IDB failures).
 */

const DB_NAME = "wzpdcl-load-calculator";
const DB_VERSION = 1;
const STORE = "pending_saves";
const LS_KEY = "wzpdcl_pending_saves_v1";

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function lsWrite(rows) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        os.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

/** @param {object} payload calculation payload */
export async function enqueuePendingSave(payload) {
  const record = {
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  // Always write localStorage first (reliable, sync)
  try {
    const rows = lsRead();
    const id = Date.now() + Math.floor(Math.random() * 1000);
    rows.push({ id, ...record });
    lsWrite(rows);
  } catch (e) {
    console.warn("localStorage queue failed", e);
  }

  // Best-effort IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    await new Promise((resolve, reject) => {
      const addReq = store.add(record);
      addReq.onsuccess = () => resolve(addReq.result);
      addReq.onerror = () => reject(addReq.error);
    });
    await txDone(tx);
    db.close();
  } catch (e) {
    console.warn("IndexedDB queue failed (localStorage still used)", e);
  }

  return true;
}

export async function listPendingSaves() {
  // Prefer localStorage as source of truth for UI (always present after enqueue)
  const fromLs = lsRead();
  if (fromLs.length > 0) {
    return fromLs
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  // Fallback read IDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const rows = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    await txDone(tx);
    db.close();
    return rows.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function countPendingSaves() {
  const rows = await listPendingSaves();
  return rows.length;
}

export async function removePendingSave(id) {
  const idNum = Number(id);
  // localStorage
  try {
    const rows = lsRead().filter((r) => Number(r.id) !== idNum);
    lsWrite(rows);
  } catch {
    // ignore
  }
  // IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(idNum);
    await txDone(tx);
    db.close();
  } catch {
    // ignore
  }
}

export async function clearAllPending() {
  try {
    lsWrite([]);
  } catch {
    // ignore
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await txDone(tx);
    db.close();
  } catch {
    // ignore
  }
}

export async function bumpAttempt(id) {
  const idNum = Number(id);
  try {
    const rows = lsRead();
    const next = rows.map((r) =>
      Number(r.id) === idNum ? { ...r, attempts: (r.attempts || 0) + 1 } : r
    );
    lsWrite(next);
  } catch {
    // ignore
  }
}

/** True if error looks like offline / network failure (not auth/validation) */
export function isOfflineError(err) {
  if (!err) return false;
  const msg = String(err.message || err || "").toLowerCase();
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("cannot reach api") ||
    msg.includes("api not reachable") ||
    msg.includes("load failed") ||
    msg.includes("internet") ||
    msg.includes("offline") ||
    msg.includes("err_internet") ||
    msg.includes("err_connection") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("timeout")
  ) {
    return true;
  }
  if (err.name === "TypeError") return true;
  return false;
}

/**
 * Map a queued offline save into a history-row shaped object for the UI.
 */
export function pendingToHistoryRecord(row) {
  const payload = row.payload || {};
  return {
    _id: `offline-${row.id}`,
    offlineId: row.id,
    isOffline: true,
    status: "pending_sync",
    createdAt: row.createdAt,
    calculatedAt: row.createdAt || payload.calculatedAt,
    busVoltages: payload.busVoltages || { bus1: 0, bus2: 0 },
    feeders: Array.isArray(payload.feeders) ? payload.feeders : [],
    bottail11kV: payload.bottail11kV ?? 0,
    totalMW: payload.totalMW ?? 0,
    note: payload.note || "Pending sync (saved offline)",
  };
}

export async function listPendingAsHistory() {
  const rows = await listPendingSaves();
  return rows
    .map(pendingToHistoryRecord)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}
