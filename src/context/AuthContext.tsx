"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { login as apiLogin, logout as apiLogout, checkAuth } from "@/lib/api";
import {
  getStoredAdmin,
  getStoredToken,
  clearStoredSession,
} from "@/lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // CRITICAL: start with null/false/true on BOTH server and first client paint.
  // Reading localStorage during useState() causes hydration mismatch, while
  // starting loading=false causes child useEffects on /dashboard to redirect
  // to /login before refresh() completes.
  const [admin, setAdmin] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setAuthenticated(false);
        setAdmin(null);
        return;
      }

      const result = await checkAuth();
      if (result?.authenticated && (result.admin || result.data)) {
        setAuthenticated(true);
        setAdmin(result.admin || result.data);
      } else {
        clearStoredSession();
        setAuthenticated(false);
        setAdmin(null);
      }
    } catch {
      const cached = getStoredAdmin();
      if (cached && getStoredToken()) {
        setAuthenticated(true);
        setAdmin(cached);
      } else {
        setAuthenticated(false);
        setAdmin(null);
      }
    }
  }, []);

  useEffect(() => {
    // Mark loading BEFORE the async work so consumers know auth is resolving.
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    setAuthenticated(true);
    setAdmin(data.data || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearStoredSession();
      setAuthenticated(false);
      setAdmin(null);
    }
  }, []);

  /** Apply updated profile fields after self-service edit (keeps session). */
  const applyAdminUpdate = useCallback((next) => {
    if (!next) return;
    setAdmin((prev) => ({ ...(prev || {}), ...next }));
    setAuthenticated(true);
  }, []);

  const role = (() => {
    const r = String(admin?.role || "")
      .toLowerCase()
      .replace(/_/g, "-");
    if (r === "viewer") return "viewer";
    if (
      r === "circle-load-input" ||
      r === "circleloadinput" ||
      r === "circle-input"
    )
      return "circle-load-input";
    if (r === "duty" || r === "duty-person" || r === "operator") return "duty";
    if (r === "admin" || r === "superadmin") return "admin";
    return authenticated ? "viewer" : null;
  })();

  const value = useMemo(
    () => ({
      admin,
      loading,
      authenticated,
      isAuthenticated: authenticated,
      role,
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
    [admin, loading, authenticated, role, login, logout, refresh, applyAdminUpdate]
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