// frontend/lib/api.js
import { getStoredToken, setStoredSession, clearStoredSession } from "./auth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function url(path) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

async function parseJson(res) {
  try {
    const text = await res.text();
    if (!text) {
      throw new Error("Empty response from server");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
    }
  } catch (err) {
    if (err.message.includes("Invalid JSON")) {
      throw err;
    }
    throw new Error("Invalid response from server");
  }
}

export function isNetworkFailure(err) {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.name === "TypeError" ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Cannot reach API") ||
    msg.includes("API not reachable")
  );
}

function networkError(err) {
  if (
    err.message?.includes("Failed to fetch") ||
    err.message?.includes("NetworkError") ||
    err.name === "TypeError"
  ) {
    const baseUrl = API_BASE || "(same origin)";
    return new Error(
      `Cannot reach API at ${baseUrl}. ` +
        `If the site is deployed, this is usually a CORS issue: set FRONTEND_URL on the API project to your frontend URL and redeploy.`
    );
  }
  return err;
}

// Cookies + Bearer token (required when FE/BE are on different Vercel domains)
async function fetchWithCredentials(url_, options = {}) {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url_, {
    ...options,
    credentials: "include",
    headers,
  });
}

// ============================================
// CALCULATION API FUNCTIONS
// ============================================

/**
 * Save a calculation to the database
 * @param {Object} payload - Calculation data
 * @returns {Promise<Object>} - Saved calculation
 */

/**
 * Check if an hourly slot already has data for a local calendar day.
 * @param {{ hourSlot: string, dayStart: string|Date, dayEnd: string|Date }}
 */
export async function checkSlotConflict({ hourSlot, dayStart, dayEnd }) {
  try {
    const qs = new URLSearchParams({
      hourSlot: String(hourSlot),
      dayStart: dayStart instanceof Date ? dayStart.toISOString() : String(dayStart),
      dayEnd: dayEnd instanceof Date ? dayEnd.toISOString() : String(dayEnd),
    });
    const url_ = url(`/api/calculations/slot-check?${qs}`);
    const res = await fetchWithCredentials(url_, {
      method: "GET",
      cache: "no-store",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Slot check failed");
    }
    return {
      exists: data.exists === true,
      data: data.data || null,
    };
  } catch (err) {
    console.error("❌ Slot check error:", err);
    throw networkError(err);
  }
}

export async function saveCalculation(payload) {
  try {
    const url_ = url("/api/calculations");
    console.log(`📤 Sending to: ${url_}`);
    console.log("📦 Payload:", payload);

    const res = await fetchWithCredentials(url_, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log(`📥 Response status: ${res.status}`);

    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      // Handle 401 specifically
      if (res.status === 401) {
        throw new Error("Please log in to save calculations.");
      }
      throw new Error(data.message || "Save failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Save error:", err);
    throw networkError(err);
  }
}

/**
 * Update an existing calculation by id
 * @param {string} id
 * @param {Object} payload - same shape as save (busVoltages, feeders, totals, …)
 */
export async function updateCalculation(id, payload) {
  try {
    const url_ = url(`/api/calculations/${id}`);
    const res = await fetchWithCredentials(url_, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to update calculations.");
      }
      throw new Error(data.message || "Update failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Update error:", err);
    throw networkError(err);
  }
}

/**
 * Fetch a single calculation by id
 */
export async function fetchCalculationById(id) {
  try {
    const url_ = url(`/api/calculations/${id}`);
    const res = await fetchWithCredentials(url_, {
      method: "GET",
      cache: "no-store",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to load record");
    }
    return data.data;
  } catch (err) {
    console.error("❌ Fetch by id error:", err);
    throw networkError(err);
  }
}

/**
 * Fetch calculations from the database (paginated + optional date filter)
 * @param {Object} opts
 * @param {boolean} [opts.trash]
 * @param {number|string} [opts.limit=50] - page size, or "all"
 * @param {number} [opts.page=1]
 * @param {string} [opts.date] - single day YYYY-MM-DD
 * @param {string} [opts.from] - range start YYYY-MM-DD
 * @param {string} [opts.to] - range end YYYY-MM-DD
 */
export async function fetchCalculations(opts = {}) {
  const trash = opts.trash === true;
  const limit = opts.limit === undefined || opts.limit === null ? 50 : opts.limit;
  const page = opts.page ?? 1;
  try {
    const qs = new URLSearchParams({
      limit: String(limit),
      page: String(page),
      ...(trash ? { trash: "1" } : {}),
    });
    if (opts.date) qs.set("date", String(opts.date));
    if (opts.from) qs.set("from", String(opts.from));
    if (opts.to) qs.set("to", String(opts.to));

    const url_ = url(`/api/calculations?${qs}`);
    console.log(`📤 Fetching: ${url_}`);

    const res = await fetchWithCredentials(url_, {
      method: "GET",
      cache: "no-store",
    });

    console.log(`📥 Response status: ${res.status}`);

    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to load history");
    }
    return {
      data: data.data || [],
      count: data.count ?? (data.data || []).length,
      total: data.total ?? data.count ?? (data.data || []).length,
      page: data.page ?? page,
      limit: data.limit ?? limit,
      pages: data.pages ?? 1,
      inboxCount: data.inboxCount ?? 0,
      trashCount: data.trashCount ?? 0,
      isAuthenticated: data.isAuthenticated ?? false,
    };
  } catch (err) {
    console.error("❌ Fetch error:", err);
    throw networkError(err);
  }
}

/**
 * Move a calculation to trash (soft delete)
 * @param {string} id - Calculation ID
 * @returns {Promise<Object>}
 */
export async function trashCalculation(id) {
  try {
    const url_ = url(`/api/calculations/${id}`);
    console.log(`📤 Moving to trash: ${url_}`);

    const res = await fetchWithCredentials(url_, {
      method: "DELETE",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to move items to trash.");
      }
      throw new Error(data.message || "Move to trash failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Trash error:", err);
    throw networkError(err);
  }
}

/**
 * Permanently delete a calculation from trash
 * @param {string} id - Calculation ID
 * @returns {Promise<Object>}
 */
export async function purgeCalculation(id) {
  try {
    const url_ = url(`/api/calculations/${id}?permanent=1`);
    console.log(`📤 Permanently deleting: ${url_}`);

    const res = await fetchWithCredentials(url_, {
      method: "DELETE",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to permanently delete items.");
      }
      throw new Error(data.message || "Delete failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Purge error:", err);
    throw networkError(err);
  }
}

/**
 * Restore a calculation from trash
 * @param {string} id - Calculation ID
 * @returns {Promise<Object>}
 */
export async function restoreCalculation(id) {
  try {
    const url_ = url(`/api/calculations/${id}`);
    console.log(`📤 Restoring: ${url_}`);

    const res = await fetchWithCredentials(url_, {
      method: "PATCH",
      body: JSON.stringify({ action: "restore" }),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to restore items.");
      }
      throw new Error(data.message || "Restore failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Restore error:", err);
    throw networkError(err);
  }
}

/**
 * Perform bulk operations on calculations
 * @param {string} action - 'trash' | 'restore' | 'purge'
 * @param {string[]} ids - Array of calculation IDs
 * @returns {Promise<Object>}
 */
export async function bulkCalculations(action, ids) {
  try {
    const url_ = url("/api/calculations");
    console.log(`📤 Bulk action: ${action} on ${ids.length} items`);

    const res = await fetchWithCredentials(url_, {
      method: "POST",
      body: JSON.stringify({ action, ids }),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to perform bulk actions.");
      }
      throw new Error(data.message || "Bulk action failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Bulk error:", err);
    throw networkError(err);
  }
}

/**
 * Empty the entire trash
 * @returns {Promise<Object>}
 */
export async function emptyTrash() {
  try {
    const url_ = url("/api/calculations");
    console.log(`📤 Emptying trash`);

    const res = await fetchWithCredentials(url_, {
      method: "POST",
      body: JSON.stringify({ action: "empty_trash" }),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      if (res.status === 401) {
        throw new Error("Please log in to empty trash.");
      }
      throw new Error(data.message || "Empty trash failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Empty trash error:", err);
    throw networkError(err);
  }
}

/**
 * Fetch max load per feeder for a period
 * @param {{
 *   range?: 'today'|'last7days'|'lastweek'|'monthly'|'yearly'|'alltime',
 *   year?: number,
 *   month?: number
 * }} opts - month is 1–12 (used for monthly / yearly)
 * @returns {Promise<{ range, label, year, month, sampleCount, data: Array, totalPeak }>}
 */
export async function fetchMaxLoad(opts = {}) {
  try {
    const qs = new URLSearchParams();
    if (opts.range) qs.set("range", String(opts.range));
    if (opts.year != null) qs.set("year", String(opts.year));
    if (opts.month != null) qs.set("month", String(opts.month));
    if (opts.ringMode) qs.set("ringMode", String(opts.ringMode));
    if (opts.peakBy) qs.set("peakBy", String(opts.peakBy));
    const q = qs.toString();
    const url_ = url(`/api/calculations/max-load${q ? `?${q}` : ""}`);
    console.log(`📤 Max load: ${url_}`);

    const res = await fetchWithCredentials(url_, {
      method: "GET",
      cache: "no-store",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to load max load report");
    }
    return {
      range: data.range || opts.range || "monthly",
      label: data.label || "",
      ringMode: data.ringMode || opts.ringMode || "without",
      peakBy: data.peakBy || opts.peakBy || "mw",
      year: data.year,
      month: data.month,
      sampleCount: data.sampleCount ?? 0,
      hourlyOnly: data.hourlyOnly === true,
      data: data.data || [],
      bottail11Peaks: data.bottail11Peaks || [],
      totalPeak: data.totalPeak || null,
    };
  } catch (err) {
    console.error("❌ Max load error:", err);
    throw networkError(err);
  }
}

/**
 * Alias for purgeCalculation - for backward compatibility
 * @param {string} id - Calculation ID
 * @returns {Promise<Object>}
 */
/**
 * Settings endpoints — try several paths so ring preference works whether
 * the app talks to Next API, Express /api/settings, or /api/calculations/settings.
 */
function settingsUrls() {
  const rel = ["/api/settings", "/api/calculations/settings"];
  const paths = [...rel];
  if (API_BASE) {
    for (const r of rel) paths.push(`${API_BASE}${r}`);
  }
  return [...new Set(paths)];
}

/**
 * Load app settings from database (ring mode, calculator ring toggles, etc.)
 * @returns {Promise<{ maxLoadRingMode: 'with'|'without', calculatorRingActive: Record<string,boolean> }>}
 */
export async function fetchSettings() {
  let lastErr = null;
  for (const url_ of settingsUrls()) {
    try {
      const res = await fetchWithCredentials(url_, {
        method: "GET",
        cache: "no-store",
      });
      if (res.status === 404) {
        lastErr = new Error("Route not found");
        continue;
      }
      const data = await parseJson(res);
      if (!res.ok || !data.success) {
        lastErr = new Error(data.message || "Failed to load settings");
        continue;
      }
      const mode = data.data?.maxLoadRingMode;
      const ring = data.data?.calculatorRingActive || {};
      const calculatorRingActive = {};
      for (const [k, v] of Object.entries(ring)) {
        if (v === true) calculatorRingActive[String(k)] = true;
      }
      return {
        maxLoadRingMode: mode === "without" ? "without" : "with",
        calculatorRingActive,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  // Soft-fail: signal localOnly so UI does NOT wipe existing local ring state
  const msg = String(lastErr?.message || "");
  if (
    msg.includes("Route not found") ||
    msg.includes("404") ||
    msg.includes("Failed to fetch") ||
    msg.includes("Network")
  ) {
    return {
      maxLoadRingMode: "with",
      calculatorRingActive: null, // null = "unknown, do not overwrite local"
      localOnly: true,
    };
  }
  throw networkError(lastErr || new Error("Failed to load settings"));
}

/**
 * Persist calculator ring ON/OFF map to the database.
 * @param {Record<number|string, boolean>} ringActive
 */
export async function saveCalculatorRingActive(ringActive) {
  const map = {};
  if (ringActive && typeof ringActive === "object") {
    for (const [k, v] of Object.entries(ringActive)) {
      if (v === true) map[String(k)] = true;
    }
  }
  // Always mirror to localStorage as offline backup
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("calculatorRingActive", JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }

  let lastErr = null;
  for (const url_ of settingsUrls()) {
    try {
      const res = await fetchWithCredentials(url_, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculatorRingActive: map }),
      });
      if (res.status === 404) {
        lastErr = new Error("Route not found");
        continue;
      }
      const data = await parseJson(res);
      if (!res.ok || !data.success) {
        lastErr = new Error(data.message || "Failed to save ring state");
        continue;
      }
      const saved = data.data?.calculatorRingActive || map;
      return { calculatorRingActive: saved };
    } catch (err) {
      lastErr = err;
    }
  }
  const msg = String(lastErr?.message || "");
  if (msg.includes("Route not found") || msg.includes("404")) {
    return { calculatorRingActive: map, localOnly: true };
  }
  // Still keep local mirror even if network fails
  return { calculatorRingActive: map, localOnly: true };
}

/**
 * Save max-load ring mode preference to the database
 * @param {'with'|'without'} maxLoadRingMode
 */
export async function saveMaxLoadRingMode(maxLoadRingMode) {
  const mode = maxLoadRingMode === "without" ? "without" : "with";
  let lastErr = null;
  for (const url_ of settingsUrls()) {
    try {
      const res = await fetchWithCredentials(url_, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxLoadRingMode: mode }),
      });
      if (res.status === 404) {
        lastErr = new Error("Route not found");
        continue;
      }
      const data = await parseJson(res);
      if (!res.ok || !data.success) {
        lastErr = new Error(data.message || "Failed to save ring preference");
        continue;
      }
      return {
        maxLoadRingMode:
          data.data?.maxLoadRingMode === "without" ? "without" : "with",
      };
    } catch (err) {
      lastErr = err;
    }
  }
  // Preference still applied in UI + localStorage; avoid noisy "Route not found"
  const msg = String(lastErr?.message || "");
  if (msg.includes("Route not found") || msg.includes("404")) {
    return { maxLoadRingMode: mode, localOnly: true };
  }
  throw networkError(lastErr || new Error("Failed to save ring preference"));
}


export async function deleteCalculation(id) {
  return purgeCalculation(id);
}

// ============================================
// AUTHENTICATION API FUNCTIONS
// ============================================

/**
 * Login with username and password
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>}
 */
export async function login(username, password) {
  try {
    const url_ = url("/api/auth/login");
    const res = await fetch(url_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Login failed");
    }
    // Persist JWT for cross-origin API calls on Vercel
    if (data.token) {
      setStoredSession(data.token, data.data || null);
    }
    return data;
  } catch (err) {
    console.error("Login error:", err);
    throw networkError(err);
  }
}

/**
 * Logout the current user
 * @returns {Promise<Object>}
 */
export async function logout() {
  try {
    const url_ = url("/api/auth/logout");
    const res = await fetchWithCredentials(url_, { method: "POST" });
    const data = await parseJson(res);
    clearStoredSession();
    if (!res.ok || !data.success) {
      // still clear local session
      return { success: true, message: "Logged out locally" };
    }
    return data;
  } catch (err) {
    clearStoredSession();
    return { success: true, message: "Logged out locally" };
  }
}

/**
 * Check if the user is authenticated
 * @returns {Promise<{ authenticated: boolean, admin?: Object }>}
 */
export async function checkAuth() {
  try {
    const url_ = url("/api/auth/check");
    const res = await fetchWithCredentials(url_, { method: "GET" });
    const data = await parseJson(res);
    return data;
  } catch (err) {
    console.error("Auth check error:", err);
    return { success: true, authenticated: false };
  }
}

/**
 * Get current admin information
 * @returns {Promise<Object>}
 */
export async function getCurrentAdmin() {
  try {
    const url_ = url("/api/auth/me");
    console.log(`📤 Getting admin info: ${url_}`);

    const res = await fetch(url_, {
      credentials: "include",
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to get admin info");
    }
    return data.data;
  } catch (err) {
    console.error("❌ Get admin error:", err);
    throw networkError(err);
  }
}

/**
 * Register a new admin (first admin only or with secret)
 * @param {Object} adminData - { username, password, email, secret? }
 * @returns {Promise<Object>}
 */
export async function registerAdmin(adminData) {
  try {
    const url_ = url("/api/auth/register");
    console.log(`📤 Registering admin: ${url_}`);

    const res = await fetch(url_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminData),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Registration failed");
    }
    return data;
  } catch (err) {
    console.error("❌ Register error:", err);
    throw networkError(err);
  }
}

// ============================================
// CREATE API OBJECT
// ============================================

const api = {
  // Calculation functions
  saveCalculation,
  fetchCalculations,
  trashCalculation,
  purgeCalculation,
  restoreCalculation,
  bulkCalculations,
  emptyTrash,
  deleteCalculation,

  // Auth functions
  login,
  logout,
  checkAuth,
  getCurrentAdmin,
  registerAdmin,
};

// ============================================
// EXPORT AS MODULE DEFAULT
// ============================================

export default api;

/** —— Admin panel —— */
export async function fetchAdminUsers() {
  const res = await fetchWithCredentials(url("/api/admin/users"), {
    method: "GET",
    cache: "no-store",
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to load users");
  }
  return data;
}

export async function createAdminUser(payload) {
  const res = await fetchWithCredentials(url("/api/admin/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to create user");
  }
  return data;
}

export async function updateAdminUser(id, payload) {
  const res = await fetchWithCredentials(url(`/api/admin/users/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to update user");
  }
  return data;
}

export async function deleteAdminUser(id) {
  const res = await fetchWithCredentials(url(`/api/admin/users/${id}`), {
    method: "DELETE",
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to delete user");
  }
  return data;
}

export async function patchAppSettings(payload) {
  const res = await fetchWithCredentials(url("/api/settings"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to save settings");
  }
  return data;
}

export async function fetchCircleSheet({ day, slot }) {
  const q = new URLSearchParams({ day: String(day), slot: String(slot) });
  const res = await fetchWithCredentials(url(`/api/circle-load/sheet?${q}`), {
    method: "GET",
    cache: "no-store",
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to load circle sheet");
  }
  return data;
}

export async function saveCircleEntry(payload) {
  const res = await fetchWithCredentials(url("/api/circle-load/entry"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to save circle entry");
  }
  return data;
}

export async function fetchDistrictDay({ day, signal } = {}) {
  const q = new URLSearchParams({ day: String(day) });
  const res = await fetchWithCredentials(
    url(`/api/circle-load/district-day?${q}`),
    { method: "GET", cache: "no-store", signal }
  );
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to load district load");
  }
  return data;
}
