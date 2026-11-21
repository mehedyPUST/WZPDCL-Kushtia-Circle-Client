/**
 * Dedicated overtime API helpers.
 * Import from here if @/lib/api does not yet export fetchAllOvertimeSheets.
 */
import { getStoredToken } from "./auth";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");

function apiUrl(path: string) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) throw new Error("Empty response from server");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers,
  });
  const data = await parseJson(res);
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchOvertimeSheet({
  year,
  month,
  userId,
}: {
  year: number;
  month: number;
  userId?: string;
}) {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (userId) q.set("userId", userId);
  return request(`/api/overtime?${q}`, { method: "GET" });
}

export async function fetchAllOvertimeSheets({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  return request(`/api/overtime/all?${q}`, { method: "GET" }) as Promise<{
    success: boolean;
    year: number;
    month: number;
    total: number;
    items: Array<{
      userId: string;
      username: string;
      displayName: string;
      role: string;
      assignedStation: string;
      hasSheet: boolean;
      sheet: any;
      updatedAt: string | null;
    }>;
  }>;
}

export async function saveOvertimeSheet(payload: {
  year: number;
  month: number;
  employeeName: string;
  designation: string;
  weeklyHoliday: number;
  clLeaveDates: string[];
  excludedDates: string[];
  extraDutyEntries: Array<{
    date: string;
    normalFrom: string;
    normalTo: string;
    dutyFrom: string;
    dutyTo: string;
    purpose: string;
  }>;
  dutyShift: "A" | "B" | "C";
  purpose?: string;
  userId?: string;
}) {
  return request("/api/overtime", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
