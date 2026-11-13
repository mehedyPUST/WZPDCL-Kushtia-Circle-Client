"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  MapPin,
  ShieldCheck,
  LogOut,
  Check,
} from "lucide-react";

interface DashboardAccountPanelProps {
  username: string;
  roleLabel: string;
  assignedStation: string;
  lastLoginLabel: string;
  canWrite: boolean;
  isAdmin: boolean;
  displayNameDraft: string;
  emailDraft: string;
  savingProfile: boolean;
  onChangeDisplayName: (val: string) => void;
  onChangeEmail: (val: string) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingPassword: boolean;
  onChangeCurrentPassword: (val: string) => void;
  onChangeNewPassword: (val: string) => void;
  onChangeConfirmPassword: (val: string) => void;
  onChangePassword: (e: React.FormEvent) => void;
  onLogout: () => void;
}

export default function DashboardAccountPanel({
  username,
  roleLabel,
  assignedStation,
  lastLoginLabel,
  canWrite,
  isAdmin,
  displayNameDraft,
  emailDraft,
  savingProfile,
  onChangeDisplayName,
  onChangeEmail,
  onSaveProfile,
  currentPassword,
  newPassword,
  confirmPassword,
  savingPassword,
  onChangeCurrentPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onChangePassword,
  onLogout,
}: DashboardAccountPanelProps) {
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const lengthOk = newPassword.length >= 8;
  const matchOk = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="space-y-4">
      {/* Account & Role Summary Strip */}
      <div className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-[#092532] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-zinc-200 dark:border-app/70">
          <div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-white tracking-tight font-display">
              Operator Credentials &amp; Access Scope
            </h2>
            <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
              Role assignment and station permissions are managed by system administrators.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-app text-zinc-700 dark:text-slate-200 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50 dark:hover:border-rose-500/40 dark:hover:text-rose-300 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out of console
          </button>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-slate-400">
              Username
            </dt>
            <dd className="mt-1 font-mono font-semibold text-zinc-800 dark:text-white">
              @{username || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-slate-400">
              Access Role
            </dt>
            <dd className="mt-1 font-semibold text-emerald-700 dark:text-[#00ED64] inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {roleLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-slate-400">
              Assigned Substation
            </dt>
            <dd className="mt-1 font-semibold text-zinc-800 dark:text-white inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400 shrink-0" />
              {assignedStation || "Bottail 33/11 kV (All)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-slate-400">
              Capabilities
            </dt>
            <dd className="mt-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
              {isAdmin
                ? "Full control · Users · Duty Roster"
                : canWrite
                  ? "Record loads · Loadshed · Night logs"
                  : "Read-only analytics & history"}
              {lastLoginLabel !== "—" ? ` · Last login ${lastLoginLabel}` : ""}
            </dd>
          </div>
        </dl>
      </div>

      {/* Two-column forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={onSaveProfile}
          className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-[#092532] p-4 sm:p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="pb-3 border-b border-zinc-200 dark:border-app/70">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white font-display">
                Profile Details
              </h3>
              <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
                Display name appears on saved hourly sheets and shift audit logs.
              </p>
            </div>

            <div>
              <label
                htmlFor="dash-profile-username"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                Username (system-locked)
              </label>
              <input
                id="dash-profile-username"
                type="text"
                value={username || ""}
                disabled
                className="w-full h-10 rounded-lg border border-zinc-200 dark:border-app bg-zinc-50 dark:bg-[#0D3349]/60 px-3 text-sm font-mono text-zinc-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label
                htmlFor="dash-profile-displayname"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                Display name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-slate-400 pointer-events-none" />
                <input
                  id="dash-profile-displayname"
                  type="text"
                  value={displayNameDraft}
                  onChange={(e) => onChangeDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Duty Operator — Bottail"
                  className="w-full h-10 rounded-lg border border-zinc-300 dark:border-app bg-white dark:bg-[#0D3349] pl-9 pr-3 text-sm font-medium text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="dash-profile-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                Official email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-slate-400 pointer-events-none" />
                <input
                  id="dash-profile-email"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => onChangeEmail(e.target.value)}
                  placeholder="operator@wzpdcl.gov.bd"
                  className="w-full h-10 rounded-lg border border-zinc-300 dark:border-app bg-white dark:bg-[#0D3349] pl-9 pr-3 text-sm font-medium text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:focus:ring-[#00ED64]/25 focus:border-emerald-600 dark:focus:border-[#00ED64] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-zinc-100 dark:border-app/50">
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
            >
              <Save className="w-3.5 h-3.5" />
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <form
          onSubmit={onChangePassword}
          className="rounded-xl border border-zinc-200 dark:border-app bg-white dark:bg-[#092532] p-4 sm:p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="pb-3 border-b border-zinc-200 dark:border-app/70">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white font-display">
                Password &amp; Security
              </h3>
              <p className="text-xs text-zinc-600 dark:text-slate-400 mt-0.5">
                Minimum 8 characters. Active session remains signed in after updating.
              </p>
            </div>

            <div>
              <label
                htmlFor="dash-pw-current"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                Current password
              </label>
              <div className="relative">
                <input
                  id="dash-pw-current"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => onChangeCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter current password"
                  className="w-full h-10 rounded-lg border border-zinc-300 dark:border-app bg-white dark:bg-[#0D3349] pl-3 pr-10 text-sm text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#00ED64]/25 focus:border-blue-500 dark:focus:border-[#00ED64] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  aria-label={showCurrentPw ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="dash-pw-new"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="dash-pw-new"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => onChangeNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  placeholder="Minimum 8 characters"
                  className="w-full h-10 rounded-lg border border-zinc-300 dark:border-app bg-white dark:bg-[#0D3349] pl-3 pr-10 text-sm text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#00ED64]/25 focus:border-blue-500 dark:focus:border-[#00ED64] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  aria-label={showNewPw ? "Hide new password" : "Show new password"}
                >
                  {showNewPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="dash-pw-confirm"
                className="block text-xs font-semibold text-zinc-700 dark:text-slate-300 mb-1.5"
              >
                Confirm new password
              </label>
              <input
                id="dash-pw-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => onChangeConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="Re-enter new password"
                className="w-full h-10 rounded-lg border border-zinc-300 dark:border-app bg-white dark:bg-[#0D3349] px-3 text-sm text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#00ED64]/25 focus:border-blue-500 dark:focus:border-[#00ED64] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5">
              <span
                className={`inline-flex items-center gap-1 ${
                  lengthOk
                    ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                    : "text-zinc-500 dark:text-slate-400"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                At least 8 characters
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  matchOk
                    ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                    : "text-zinc-500 dark:text-slate-400"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Confirmation matches
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-zinc-100 dark:border-app/50">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
