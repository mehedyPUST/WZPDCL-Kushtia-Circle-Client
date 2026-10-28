"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UserPlus, X, RefreshCw } from "lucide-react";
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  fetchSettings,
  patchAppSettings,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import SkeletonTable, { SkeletonAdmin } from "./SkeletonTable";

const ROLE_LABEL = {
  viewer: "Viewer",
  duty: "Duty person",
  admin: "Admin",
  "circle-load-input": "Circle load input",
  operator: "Duty person",
  "duty-person": "Duty person",
  superadmin: "Admin",
};

/** Manual circle-load stations (Bottail is calculator-fed) */
const CIRCLE_STATION_OPTIONS = [
  { id: "", label: "— Not assigned —" },
  { id: "jhinaidah", label: "Jhinaidah" },
  { id: "kaligonj", label: "Kaligonj" },
  { id: "bheramara", label: "Bheramara" },
  { id: "chuadanga", label: "Chuadanga" },
];

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer — view only (no save)" },
  { value: "duty", label: "Duty person — full ops except admin" },
  { value: "circle-load-input", label: "Circle load input — own station only" },
  { value: "admin", label: "Admin — users & settings" },
];

function isValidHHmm(s) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(s || "").trim());
}

/** Match server normalizeRole so duty / duty-person / operator always show as duty */
function normalizeRoleClient(role) {
  const r = String(role || "").toLowerCase().replace(/_/g, "-");
  if (r === "viewer") return "viewer";
  if (r === "circle-load-input" || r === "circleloadinput" || r === "circle-input")
    return "circle-load-input";
  if (r === "duty" || r === "duty-person" || r === "operator") return "duty";
  if (r === "admin" || r === "superadmin") return "admin";
  return "viewer";
}

function roleBadge(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin" || r === "superadmin")
    return "text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 border px-2 py-0.5 rounded-md font-semibold";
  if (r === "circle-load-input")
    return "text-amber-700 bg-amber-50 border-amber-300 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 border px-2 py-0.5 rounded-md font-semibold";
  if (r === "duty" || r === "duty-person" || r === "operator")
    return "text-sky-700 bg-sky-50 border-sky-300 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/20 border px-2 py-0.5 rounded-md font-semibold";
  return "text-secondary bg-surface-3/60 border border-app-strong/50 px-2 py-0.5 rounded-md";
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete = "new-password",
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-xs font-medium text-secondary">
      {label}
      <div className="mt-1 relative">
        <input
          type={show ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-3 pr-10 rounded-lg border border-app text-sm bg-elevated text-app placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-secondary hover:bg-surface-3"
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </label>
  );
}

const emptyForm = {
  displayName: "",
  username: "",
  role: "viewer",
  assignedStation: "",
  password: "",
  confirm: "",
};

export default function AdminPanel() {
  const { isAuthenticated, admin, login, loading: authLoading, isAdmin } =
    useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [tab, setTab] = useState("users");
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const canManage = isAdmin || admin?.role === "admin" || admin?.role === "superadmin";

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchAdminUsers();
      const list = (res.data || []).map((u) => ({
        ...u,
        role: normalizeRoleClient(u.role),
      }));
      setUsers(list);
    } catch (err) {
      toast.error(err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchSettings();
      const data = res?.data ? res.data : res || {};
      setSettingsDraft({
        stationName: data.stationName || "Bottail SS",
        stationOrg: data.stationOrg || "WZPDCL",
        defaultBus1Kv: data.defaultBus1Kv ?? 33,
        defaultBus2Kv: data.defaultBus2Kv ?? 33,
        bus1MaxKv: data.bus1MaxKv ?? 36,
        bus2MaxKv: data.bus2MaxKv ?? 35.6,
        maxLoadRingMode: data.maxLoadRingMode || "with",
        trashRetentionDays: data.trashRetentionDays ?? 30,
        circleRelaxUntil: data.circleRelaxUntil || "12:00",
        circleRelaxedSlots: Array.isArray(data.circleRelaxedSlots)
          ? data.circleRelaxedSlots.join(", ")
          : "01:00, 02:00, 03:00, 04:00, 05:00, 06:00, 07:00, 08:00",
        districtDayBoundary: data.districtDayBoundary || "22:00",
      });
    } catch (err) {
      toast.error(err.message || "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !canManage) return;
    loadUsers();
    loadSettings();
  }, [isAuthenticated, canManage, loadUsers, loadSettings]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!username || !form.password) {
      toast.error("Username and password are required");
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      toast.error("Username: 3–32 chars, lowercase letters, numbers, . _ -");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Password and confirm password do not match");
      return;
    }
    if (form.role === "circle-load-input" && !String(form.assignedStation || "").trim()) {
      toast.error("Assign a grid station for circle-load-input users");
      return;
    }
    setCreating(true);
    try {
      await createAdminUser({
        username,
        password: form.password,
        displayName: form.displayName.trim(),
        role: form.role,
        assignedStation: form.assignedStation || "",
      });
      toast.success("User created");
      setForm(emptyForm);
      setShowCreateUser(false);
      await loadUsers();
    } catch (err) {
      toast.error(err.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditDraft({
      displayName: u.displayName || "",
      username: u.username || "",
      role: u.role === "operator" || u.role === "duty-person" ? "duty" : u.role === "superadmin" ? "admin" : u.role || "viewer",
      assignedStation: u.assignedStation || "",
      isActive: u.isActive !== false,
      password: "",
      confirm: "",
    });
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editUser) return;
    if (editDraft.password) {
      if (editDraft.password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (editDraft.password !== editDraft.confirm) {
        toast.error("Password and confirm password do not match");
        return;
      }
    }
    if (
      editDraft.role === "circle-load-input" &&
      !String(editDraft.assignedStation || "").trim()
    ) {
      toast.error("Assign a grid station for circle-load-input users");
      return;
    }
    setSavingEdit(true);
    try {
      const payload = {
        displayName: editDraft.displayName,
        role: editDraft.role,
        assignedStation: editDraft.assignedStation || "",
        isActive: editDraft.isActive,
      };
      if (editDraft.password) payload.password = editDraft.password;
      await updateAdminUser(editUser.id, payload);
      toast.success("User updated");
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(err.message || "Update failed");
    } finally {
      setSavingEdit(false);
    }
  };

  const setBlocked = async (u, blocked) => {
    const myId = admin?.id || admin?._id;
    if (blocked && myId && String(u.id) === String(myId)) {
      toast.error("You cannot block your own account");
      return;
    }
    try {
      await updateAdminUser(u.id, { isActive: !blocked });
      toast.success(blocked ? "User blocked" : "User activated");
      await loadUsers();
    } catch (err) {
      toast.error(err.message || "Update failed");
    }
  };

  const removeUser = async (u) => {
    const myId = admin?.id || admin?._id;
    if (myId && String(u.id) === String(myId)) {
      toast.error("You cannot delete your own account");
      return;
    }
    if (!confirm(`Delete user “${u.username}”? This cannot be undone.`)) return;
    try {
      await deleteAdminUser(u.id);
      toast.success("User deleted");
      await loadUsers();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  };

  const saveSettings = async () => {
    const relaxUntil = String(settingsDraft.circleRelaxUntil || "").trim();
    const boundary = String(settingsDraft.districtDayBoundary || "").trim();
    if (relaxUntil && !isValidHHmm(relaxUntil)) {
      toast.error("Circle relax-until must be HH:mm (e.g. 12:00)");
      return;
    }
    if (boundary && !isValidHHmm(boundary)) {
      toast.error("District day boundary must be HH:mm (e.g. 22:00)");
      return;
    }
    setSavingSettings(true);
    try {
      const payload = { ...settingsDraft };
      if (typeof payload.circleRelaxedSlots === "string") {
        payload.circleRelaxedSlots = payload.circleRelaxedSlots
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      for (const key of [
        "defaultBus1Kv",
        "defaultBus2Kv",
        "bus1MaxKv",
        "bus2MaxKv",
        "trashRetentionDays",
      ]) {
        if (payload[key] != null && payload[key] !== "") {
          const n = Number(payload[key]);
          if (!Number.isFinite(n)) {
            toast.error(`${key} must be a number`);
            setSavingSettings(false);
            return;
          }
          payload[key] = n;
        }
      }
      if (relaxUntil) {
        const [h, m] = relaxUntil.split(":");
        payload.circleRelaxUntil = `${h.padStart(2, "0")}:${m}`;
      }
      if (boundary) {
        const [h, m] = boundary.split(":");
        payload.districtDayBoundary = `${h.padStart(2, "0")}:${m}`;
      }
      await patchAppSettings(payload);
      toast.success("Settings saved");
      await loadSettings();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return <SkeletonAdmin />;
  }

  if (!isAuthenticated) {
    return (
      <div className="page-frame">
        <div className="max-w-md mx-auto w-full py-16 text-center">
          <div className="rounded-2xl border border-app-strong bg-surface-2 p-8 shadow-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400 mb-3">
              Restricted
            </p>
            <h1 className="text-xl font-semibold text-app">Admin Panel</h1>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              Sign in with an admin account to manage Bottail SS users and
              station settings. Session uses secure cookies.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
            >
              Sign in
            </button>
          </div>
          <LoginModal
            open={showLogin}
            onClose={() => setShowLogin(false)}
            onLogin={async (u, p) => {
              await login(u, p);
              setShowLogin(false);
            }}
          />
        </div>
      </div>
    );
  }

  const roleCounts = users.reduce((acc, u) => {
    const r = normalizeRoleClient(u.role);
    acc[r] = (acc[r] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, { all: 0 });

  const filteredUsers =
    roleFilter === "all"
      ? users
      : users.filter((u) => normalizeRoleClient(u.role) === roleFilter);

  if (!canManage) {
    return (
      <div className="page-frame">
        <div className="page-panel p-8 text-center">
          <h1 className="text-lg font-semibold text-app">Access denied</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as <strong className="text-secondary">{admin?.username}</strong> (
            {ROLE_LABEL[admin?.role] || admin?.role}). Admin role is required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-frame">
      <div className="mb-1.5 sm:mb-2 shrink-0 px-0.5">
        <h1 className="text-base sm:text-lg font-semibold text-app tracking-tight">
          Admin Panel
        </h1>
        <p className="text-[11px] sm:text-xs text-muted mt-0.5">
          Users & station settings ·{" "}
          <span className="text-emerald-400 font-semibold">{admin?.username}</span>
        </p>
      </div>

      <div className="page-panel flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 flex gap-1 p-1.5 sm:p-2 border-b border-app bg-elevated/90">
          {[
            { id: "users", label: "Users" },
            { id: "settings", label: "Settings" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors whitespace-nowrap min-h-[2.5rem] ${
                tab === t.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted hover:text-app hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-4 space-y-4">
            {/* Action Bar & Role filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {[
                  { id: "all", label: "All" },
                  { id: "duty", label: "Duty" },
                  { id: "viewer", label: "Viewer" },
                  { id: "circle-load-input", label: "Circle" },
                  { id: "admin", label: "Admin" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRoleFilter(f.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[2.25rem] flex items-center gap-1.5 ${
                      roleFilter === f.id
                        ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500"
                        : "bg-surface border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:border-app dark:bg-surface-2 dark:text-muted dark:hover:text-app dark:hover:bg-surface-3"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                        roleFilter === f.id
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-muted"
                      }`}
                    >
                      {roleCounts[f.id] || 0}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:border-app dark:bg-surface-3 dark:text-secondary dark:hover:text-app min-h-[2.25rem] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUser((v) => !v)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[2.25rem] inline-flex items-center gap-1.5 transition-all shadow-sm ${
                    showCreateUser
                      ? "bg-surface border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-app-strong dark:bg-surface-3 dark:text-secondary"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/20 active:scale-95"
                  }`}
                >
                  {showCreateUser ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      Close Form
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Create User Interface */}
            {showCreateUser && (
              <form
                onSubmit={handleCreate}
                className="rounded-xl border border-emerald-500/30 bg-surface-2 p-4 shadow-xl shadow-black/40 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-app">
                  <div>
                    <h2 className="text-sm font-semibold text-app tracking-tight flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-400" />
                      Create New Account
                    </h2>
                    <p className="text-[11px] text-muted mt-0.5">
                      Configure user details, permissions, and initial password
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateUser(false);
                      setForm(emptyForm);
                    }}
                    className="p-1 rounded-lg text-muted hover:text-app hover:bg-surface-3 transition-colors"
                    aria-label="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-secondary">
                    Name
                    <input
                      value={form.displayName}
                      onChange={(e) =>
                        setForm({ ...form, displayName: e.target.value })
                      }
                      placeholder="Full name"
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </label>
                  <label className="block text-xs font-medium text-secondary">
                    Username *
                    <input
                      required
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      placeholder="login id"
                      autoComplete="off"
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </label>
                  <label className="block text-xs font-medium text-secondary">
                    Role *
                    <select
                      value={form.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        setForm({
                          ...form,
                          role,
                          assignedStation:
                            role === "circle-load-input"
                              ? form.assignedStation
                              : "",
                        });
                      }}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="viewer">Viewer — view only</option>
                      <option value="circle-load-input">
                        Circle load input — view site + assigned SS entry
                      </option>
                      <option value="duty">Duty person — can save data</option>
                      <option value="admin">Admin — users & settings</option>
                    </select>
                  </label>
                  {form.role === "circle-load-input" ? (
                    <label className="block text-xs font-medium text-secondary sm:col-span-1">
                      Assigned circle station *
                      <select
                        required
                        value={form.assignedStation}
                        onChange={(e) =>
                          setForm({ ...form, assignedStation: e.target.value })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      >
                        <option value="">— Select station —</option>
                        <option value="jhinaidah">Jhinaidah</option>
                        <option value="kaligonj">Kaligonj</option>
                        <option value="bheramara">Bheramara</option>
                        <option value="chuadanga">Chuadanga</option>
                        <option value="bottail">Bottail (from calculator)</option>
                      </select>
                      <span className="mt-1 block text-[10px] text-faint font-normal">
                        This user can submit circle load only for the assigned grid SS.
                      </span>
                    </label>
                  ) : null}
                  <PasswordField
                    label="Password *"
                    required
                    value={form.password}
                    onChange={(v) => setForm({ ...form, password: v })}
                    placeholder="Min 8 characters"
                  />
                  <PasswordField
                    label="Confirm password *"
                    required
                    value={form.confirm}
                    onChange={(v) => setForm({ ...form, confirm: v })}
                    placeholder="Repeat password"
                  />
                  <div className="flex items-end gap-2 sm:col-span-2 pt-1 border-t border-app justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateUser(false);
                        setForm(emptyForm);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-app bg-slate-100 hover:bg-slate-200 dark:bg-surface-3 dark:hover:bg-surface-3 text-xs font-semibold text-slate-700 dark:text-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold tracking-wide hover:bg-emerald-500 disabled:opacity-50 shadow-md shadow-emerald-950/20 dark:shadow-emerald-950 transition-colors whitespace-nowrap"
                    >
                      {creating ? "Creating…" : "Save User"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* User list — table desktop, cards mobile */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-app bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-elevated text-secondary text-xs font-semibold border-b border-app uppercase tracking-wider sticky top-0 z-[1]">
                  <tr>
                    <th className="px-3.5 py-2.5 bg-surface-2 text-secondary border-r border-app/80">Name / Username</th>
                    <th className="px-3.5 py-2.5 bg-surface-2 text-secondary border-r border-app/80">Role</th>
                    <th className="px-3.5 py-2.5 bg-surface-2 text-secondary border-r border-app/80">Station</th>
                    <th className="px-3.5 py-2.5 bg-surface-2 text-secondary border-r border-app/80">Status</th>
                    <th className="px-3.5 py-2.5 bg-surface-2 text-secondary border-r border-app/80">Last login</th>
                    <th className="px-3.5 py-2.5 text-right bg-surface-2 text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loadingUsers && (
                    <tr>
                      <td colSpan={6} className="p-3">
                        <SkeletonTable rows={4} columns={6} dark showHeader={false} />
                      </td>
                    </tr>
                  )}
                  {!loadingUsers && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-10 text-center text-muted">
                        {users.length === 0
                          ? "No users yet — create a duty person or viewer above."
                          : `No users with role “${roleFilter}”. Try All.`}
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((u) => {
                    const active = u.isActive !== false;
                    return (
                      <tr
                        key={u.id}
                        className={
                          active
                            ? "hover:bg-surface-3/50 transition-colors"
                            : "bg-rose-950/25 hover:bg-rose-950/40 transition-colors"
                        }
                      >
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-app">
                            {u.displayName || "—"}
                          </div>
                          <div className="text-[11px] text-muted font-mono">
                            @{u.username}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`text-xs font-semibold ${roleBadge(
                              u.role
                            )}`}
                          >
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 hidden sm:table-cell text-xs text-secondary font-mono">
                          {u.role === "circle-load-input"
                            ? (u.assignedStation || "—")
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {active ? (
                            <span className="text-xs font-semibold text-emerald-400">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-400">
                              Blocked
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-[11px] text-muted font-mono tabular-nums hidden md:table-cell">
                          {u.lastLogin
                            ? new Date(u.lastLogin).toLocaleString("en-GB")
                            : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-surface-3 dark:hover:bg-surface-3 dark:text-secondary dark:border-app transition-colors whitespace-nowrap shadow-2xs"
                            >
                              Edit
                            </button>
                            {active ? (
                              <button
                                type="button"
                                onClick={() => setBlocked(u, true)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/20 transition-colors whitespace-nowrap shadow-2xs"
                              >
                                Block
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setBlocked(u, false)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20 transition-colors whitespace-nowrap shadow-2xs"
                              >
                                Activate
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUser(u)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/20 transition-colors whitespace-nowrap shadow-2xs"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile user cards */}
            <div className="md:hidden space-y-2.5">
              {loadingUsers && (
                <div className="p-2 space-y-2">
                  <SkeletonTable rows={3} columns={3} dark showHeader={false} />
                </div>
              )}
              {!loadingUsers && filteredUsers.length === 0 && (
                <p className="text-center text-muted text-sm py-8">
                  {users.length === 0
                    ? "No users yet — click Create User above to get started."
                    : `No users with role “${roleFilter}”.`}
                </p>
              )}
              {filteredUsers.map((u) => {
                const active = u.isActive !== false;
                return (
                  <div
                    key={`m-${u.id}`}
                    className="rounded-xl border border-app bg-surface-2 p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-app truncate">
                          {u.displayName || u.username}
                        </p>
                        <p className="text-[11px] font-mono text-muted truncate">
                          @{u.username}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          active
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {active ? "Active" : "Blocked"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <span className={`font-semibold ${roleBadge(u.role)}`}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                      {u.role === "circle-load-input" && (
                        <span className="text-muted">
                          Station: {u.assignedStation || "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-app">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="flex-1 min-h-[2.5rem] px-2 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-surface-3 dark:hover:bg-surface-3 dark:text-secondary dark:border-app"
                      >
                        Edit
                      </button>
                      {active ? (
                        <button
                          type="button"
                          onClick={() => setBlocked(u, true)}
                          className="flex-1 min-h-[2.5rem] px-2 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/20"
                        >
                          Block
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBlocked(u, false)}
                          className="flex-1 min-h-[2.5rem] px-2 rounded-lg text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/20"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeUser(u)}
                        className="min-h-[2.5rem] px-3 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>


            <p className="text-[11px] text-muted leading-relaxed max-w-2xl">
              <strong className="text-secondary">Viewer</strong> — site view only (no save).{" "}
              <strong className="text-amber-300">Circle load input</strong> — same views as viewer; may
              enter circle load for their assigned station only.{" "}
              <strong className="text-sky-300">Duty person</strong> — operational pages and save.{" "}
              <strong className="text-purple-300">Admin</strong> — users, settings, Bottail override on
              circle load. Blocked users cannot sign in.
            </p>
          </div>
        )}

        {tab === "settings" && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-4 space-y-4 max-w-2xl w-full mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                ["stationName", "Station name", "text"],
                ["stationOrg", "Organization", "text"],
                ["defaultBus1Kv", "Default Bus‑1 (kV)", "number"],
                ["defaultBus2Kv", "Default Bus‑2 (kV)", "number"],
                ["bus1MaxKv", "Bus‑1 max guidance (kV)", "number"],
                ["bus2MaxKv", "Bus‑2 max guidance (kV)", "number"],
                ["trashRetentionDays", "Trash retention (days)", "number"],
              ].map(([key, label, type]) => (
                <label key={key} className="block text-xs font-medium text-secondary">
                  {label}
                  <input
                    type={type}
                    step={type === "number" ? "0.1" : undefined}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={settingsDraft[key] ?? ""}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
              <label className="block text-xs font-medium text-secondary">
                MAX Load default ring filter
                <select
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  value={settingsDraft.maxLoadRingMode || "with"}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      maxLoadRingMode: e.target.value,
                    })
                  }
                >
                  <option value="without">No ring only</option>
                  <option value="with">Include ring data</option>
                </select>
              </label>
            </div>
            <div className="col-span-full border-t border-app pt-4 mt-1">
              <p className="text-xs font-semibold text-secondary mb-1.5">
                Circle load · relaxed slots
              </p>
              <p className="text-[11px] text-muted mb-3 leading-relaxed">
                These slots stay open until the deadline (Dhaka time) the same
                day. Other slots stay open until the next slot starts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block text-xs font-medium text-secondary">
                  Relaxed slots (comma-separated HH:mm)
                  <input
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={settingsDraft.circleRelaxedSlots ?? ""}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        circleRelaxedSlots: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-secondary">
                  Open until (HH:mm)
                  <input
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app font-mono tabular-nums placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={settingsDraft.circleRelaxUntil ?? "12:00"}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        circleRelaxUntil: e.target.value,
                      })
                    }
                    placeholder="12:00"
                  />
                </label>
                <label className="block text-xs font-medium text-secondary sm:col-span-2">
                  Kushtia district day boundary (HH:mm)
                  <input
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app font-mono tabular-nums placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    value={settingsDraft.districtDayBoundary ?? "22:00"}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        districtDayBoundary: e.target.value,
                      })
                    }
                    placeholder="22:00"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-muted">
                    District day labelled with end date D runs from previous day
                    at this time through D at this time (default 22:00).
                  </span>
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-xs font-semibold tracking-wide hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap"
            >
              {savingSettings ? "Saving…" : "Save settings"}
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3">
          <div
            className="absolute inset-0 bg-elevated/75 backdrop-blur-sm"
            onClick={() => setEditUser(null)}
            aria-hidden
          />
          <form
            onSubmit={saveEdit}
            className="relative z-10 w-full max-w-md rounded-2xl bg-surface-2 shadow-2xl border border-app overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-app bg-elevated/90 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-app">Edit user</h3>
                <p className="text-[11px] text-muted font-mono">
                  @{editUser.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="w-9 h-9 rounded-lg text-muted hover:text-app hover:bg-surface-3"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs font-medium text-secondary">
                Name
                <input
                  value={editDraft.displayName}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, displayName: e.target.value })
                  }
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app bg-elevated text-sm text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-medium text-secondary">
                Username
                <input
                  value={editDraft.username}
                  disabled
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated/50 text-faint font-mono"
                  title="Username cannot be changed"
                />
              </label>
              <label className="block text-xs font-medium text-secondary">
                Role
                <select
                  value={editDraft.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setEditDraft({
                      ...editDraft,
                      role,
                      assignedStation:
                        role === "circle-load-input"
                          ? editDraft.assignedStation
                          : "",
                    });
                  }}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="circle-load-input">Circle load input</option>
                  <option value="duty">Duty person</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {editDraft.role === "circle-load-input" ? (
              <label className="block text-xs font-medium text-secondary">
                Assigned circle station *
                <select
                  required
                  value={editDraft.assignedStation || ""}
                  onChange={(e) =>
                    setEditDraft({
                      ...editDraft,
                      assignedStation: e.target.value,
                    })
                  }
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">— Select station —</option>
                  <option value="jhinaidah">Jhinaidah</option>
                  <option value="kaligonj">Kaligonj</option>
                  <option value="bheramara">Bheramara</option>
                  <option value="chuadanga">Chuadanga</option>
                  <option value="bottail">Bottail</option>
                </select>
              </label>
              ) : null}
              <label className="block text-xs font-medium text-secondary">
                Status
                <select
                  value={editDraft.isActive ? "active" : "blocked"}
                  onChange={(e) =>
                    setEditDraft({
                      ...editDraft,
                      isActive: e.target.value === "active",
                    })
                  }
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-app text-sm bg-elevated text-app focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <PasswordField
                label="New password (optional)"
                value={editDraft.password}
                onChange={(v) => setEditDraft({ ...editDraft, password: v })}
                placeholder="Leave blank to keep current"
              />
              <PasswordField
                label="Confirm new password"
                value={editDraft.confirm}
                onChange={(v) => setEditDraft({ ...editDraft, confirm: v })}
                placeholder="Repeat if changing"
              />
            </div>
            <div className="px-4 py-3 border-t border-app bg-surface-2 dark:bg-elevated/90 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="h-10 px-4 rounded-lg border border-slate-300 dark:border-app bg-slate-100 hover:bg-slate-200 dark:bg-surface-3 dark:hover:bg-surface-3 text-xs font-semibold text-slate-700 dark:text-secondary whitespace-nowrap transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap shadow-sm shadow-emerald-900/20"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
