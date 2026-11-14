"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { login as apiLogin, logout as apiLogout, checkAuth } from "@/lib/api";
import {
  getStoredAdmin,
  getStoredToken,
  setStoredSession,
  clearStoredSession,
} from "@/lib/auth";
import {
  getNextShiftCutoffMs,
  isShiftAutoLogoutRole,
  normalizeAuthRole,
} from "@/lib/shiftSession";

const AuthContext = createContext(null);

function decodeJwtPayloadClient(token: string | null): Record<string, any> | null {
  if (!token) return null;
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

function resolveShiftLogoutAt(
  userObj: Record<string, any> | null,
  token: string | null
): number | null {
  if (!userObj || !isShiftAutoLogoutRole(userObj.role)) {
    return null;
  }
  if (
    typeof userObj.shiftLogoutAt === "number" &&
    Number.isFinite(userObj.shiftLogoutAt) &&
    userObj.shiftLogoutAt > 0
  ) {
    return userObj.shiftLogoutAt;
  }
  const payload = decodeJwtPayloadClient(token);
  if (
    payload &&
    typeof payload.shiftLogoutAt === "number" &&
    Number.isFinite(payload.shiftLogoutAt) &&
    payload.shiftLogoutAt > 0
  ) {
    return payload.shiftLogoutAt;
  }
  if (payload && typeof payload.iat === "number" && payload.iat > 0) {
    return getNextShiftCutoffMs(payload.iat * 1000);
  }
  return getNextShiftCutoffMs(Date.now());
}

const DUTY_NOTES_PENDING_KEY = "wzpdcl_duty_notes_login_pending";
const DUTY_NOTES_DISMISSED_KEY = "wzpdcl_duty_notes_login_dismissed";

function writeDutyNotesLoginPending(userObj: Record<string, any> | null) {
  if (typeof window === "undefined") return;
  try {
    const normRole = normalizeAuthRole(userObj?.role);
    if (normRole === "duty" && userObj?.username) {
      window.sessionStorage.removeItem(DUTY_NOTES_DISMISSED_KEY);
      window.sessionStorage.setItem(
        DUTY_NOTES_PENDING_KEY,
        JSON.stringify({
          username: String(userObj.username).toLowerCase(),
          shiftLogoutAt: userObj.shiftLogoutAt ?? null,
          ts: Date.now(),
        })
      );
      window.dispatchEvent(
        new CustomEvent("wzpdcl:duty-login", {
          detail: { username: userObj.username, role: normRole },
        })
      );
    } else {
      window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
      window.sessionStorage.removeItem(DUTY_NOTES_DISMISSED_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

function clearDutyNotesLoginFlags() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DUTY_NOTES_PENDING_KEY);
    window.sessionStorage.removeItem(DUTY_NOTES_DISMISSED_KEY);
    window.dispatchEvent(new CustomEvent("wzpdcl:duty-logout"));
  } catch {
    /* ignore storage errors */
  }
}

export function AuthProvider({ children }) {
  // CRITICAL: start with null/false/true on BOTH server and first client paint.
  // Reading localStorage during useState() causes hydration mismatch, while
  // starting loading=false causes child useEffects on /dashboard to redirect
  // to /login before refresh() completes.
  const [admin, setAdmin] = useState<any>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shiftCutoffNotice, setShiftCutoffNotice] = useState<{
    cutoffAt: number | null;
    triggeredAt: number;
  } | null>(null);
  const shiftLogoutLockRef = useRef(false);

  const dismissShiftCutoffNotice = useCallback(() => {
    setShiftCutoffNotice(null);
  }, []);

  const performShiftAutoLogout = useCallback(
    async (cutoffAt?: number | null) => {
      if (shiftLogoutLockRef.current) return;
      shiftLogoutLockRef.current = true;
      try {
        clearStoredSession();
        clearDutyNotesLoginFlags();
        setAuthenticated(false);
        setAdmin(null);
        await apiLogout().catch(() => {});
        setShiftCutoffNotice({
          cutoffAt: cutoffAt ?? null,
          triggeredAt: Date.now(),
        });
      } finally {
        setTimeout(() => {
          shiftLogoutLockRef.current = false;
        }, 1500);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setAuthenticated(false);
        setAdmin(null);
        return;
      }

      const cached = getStoredAdmin();
      const cachedCutoff = resolveShiftLogoutAt(cached, token);
      if (cachedCutoff && Date.now() >= cachedCutoff) {
        await performShiftAutoLogout(cachedCutoff);
        return;
      }

      const result = await checkAuth();
      if (result?.authenticated && (result.admin || result.data)) {
        const nextUser = result.admin || result.data;
        const effectiveCutoff = resolveShiftLogoutAt(nextUser, token);
        if (effectiveCutoff && Date.now() >= effectiveCutoff) {
          await performShiftAutoLogout(effectiveCutoff);
          return;
        }
        const hydrated = {
          ...nextUser,
          shiftLogoutAt: effectiveCutoff,
        };
        setStoredSession(token, hydrated);
        setAuthenticated(true);
        setAdmin(hydrated);
      } else {
        clearStoredSession();
        setAuthenticated(false);
        setAdmin(null);
        if (result?.reason === "shift_cutoff") {
          setShiftCutoffNotice({
            cutoffAt: result.cutoffAt ?? null,
            triggeredAt: Date.now(),
          });
        }
      }
    } catch {
      const token = getStoredToken();
      const cached = getStoredAdmin();
      if (cached && token) {
        const cachedCutoff = resolveShiftLogoutAt(cached, token);
        if (cachedCutoff && Date.now() >= cachedCutoff) {
          await performShiftAutoLogout(cachedCutoff);
          return;
        }
        setAuthenticated(true);
        setAdmin({ ...cached, shiftLogoutAt: cachedCutoff });
      } else {
        setAuthenticated(false);
        setAdmin(null);
      }
    }
  }, [performShiftAutoLogout]);

  useEffect(() => {
    // Mark loading BEFORE the async work so consumers know auth is resolving.
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    const user = data.data || null;
    const effectiveCutoff = resolveShiftLogoutAt(user, data.token || getStoredToken());
    const nextAdmin = user ? { ...user, shiftLogoutAt: effectiveCutoff } : null;
    if (nextAdmin) {
      setStoredSession(data.token || getStoredToken(), nextAdmin);
    }
    setShiftCutoffNotice(null);
    setAuthenticated(true);
    setAdmin(nextAdmin);
    writeDutyNotesLoginPending(nextAdmin);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearStoredSession();
      clearDutyNotesLoginFlags();
      setAuthenticated(false);
      setAdmin(null);
    }
  }, []);

  /** Apply updated profile fields after self-service edit (keeps session & shift cutoff). */
  const applyAdminUpdate = useCallback((next) => {
    if (!next) return;
    setAdmin((prev) => {
      const merged = { ...(prev || {}), ...next };
      const effectiveCutoff = resolveShiftLogoutAt(merged, getStoredToken());
      const finalUser = { ...merged, shiftLogoutAt: effectiveCutoff };
      setStoredSession(getStoredToken(), finalUser);
      return finalUser;
    });
    setAuthenticated(true);
  }, []);

  const role = (() => {
    if (!authenticated && !admin) return null;
    const norm = normalizeAuthRole(admin?.role);
    return authenticated ? norm : null;
  })();

  const shiftLogoutAt: number | null = useMemo(() => {
    if (!authenticated || !admin) return null;
    if (!isShiftAutoLogoutRole(admin.role)) return null;
    return resolveShiftLogoutAt(admin, getStoredToken());
  }, [authenticated, admin]);

  // Scheduled auto-logout at 08:30, 14:30, and 20:30 BST for admin & duty ONLY
  useEffect(() => {
    if (!authenticated || !shiftLogoutAt || !isShiftAutoLogoutRole(role)) {
      return;
    }

    const checkCutoff = () => {
      if (Date.now() >= shiftLogoutAt) {
        performShiftAutoLogout(shiftLogoutAt);
      }
    };

    const delayMs = Math.max(0, shiftLogoutAt - Date.now());
    const timerId = window.setTimeout(checkCutoff, Math.min(delayMs + 250, 2147483647));
    const intervalId = window.setInterval(checkCutoff, 15000);

    const onWake = () => {
      if (document.visibilityState !== "hidden") {
        checkCutoff();
      }
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [authenticated, role, shiftLogoutAt, performShiftAutoLogout]);

  // Listen for server-detected shift cutoffs from any API call
  useEffect(() => {
    const onShiftLogoutEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (authenticated && isShiftAutoLogoutRole(role)) {
        performShiftAutoLogout(detail?.cutoffAt ?? shiftLogoutAt);
      }
    };
    window.addEventListener("wzpdcl:shift-logout", onShiftLogoutEvent);
    return () => {
      window.removeEventListener("wzpdcl:shift-logout", onShiftLogoutEvent);
    };
  }, [authenticated, role, shiftLogoutAt, performShiftAutoLogout]);

  const value = useMemo(
    () => ({
      admin,
      loading,
      authenticated,
      isAuthenticated: authenticated,
      role,
      shiftLogoutAt,
      shiftCutoffNotice,
      dismissShiftCutoffNotice,
      isViewer: role === "viewer" || role === "circle-load-input",
      isDuty: role === "duty" || role === "admin",
      isAdmin: role === "admin",
      isCircleInput: role === "circle-load-input",
      canWrite: role === "duty" || role === "admin",
      canWriteCircle:
        role === "admin" ||
        role === "duty" ||
        role === "circle-load-input",
      login,
      logout,
      refresh,
      applyAdminUpdate,
    }),
    [
      admin,
      loading,
      authenticated,
      role,
      shiftLogoutAt,
      shiftCutoffNotice,
      dismissShiftCutoffNotice,
      login,
      logout,
      refresh,
      applyAdminUpdate,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}