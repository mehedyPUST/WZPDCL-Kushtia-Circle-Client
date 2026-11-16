import mongoose from "mongoose";
import { connectDB, isDbConnected } from "@/lib/db";
import Admin from "@/lib/models/Admin";
import {
  generateId,
  getMockStore,
  hashPassword,
  verifyPassword,
} from "@/lib/mockStore";
import { normalizeAuthRole } from "@/lib/shiftSession";

export interface StoredUserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  assignedStation: string;
  isActive: boolean;
  passwordHash?: string;
  createdAt: string | null;
  lastLogin: string | null;
}

function mapDocToUser(doc: any): StoredUserRecord {
  return {
    id: String(doc._id || doc.id),
    username: String(doc.username || ""),
    displayName: String(doc.displayName || ""),
    email: String(doc.email || ""),
    role: normalizeAuthRole(doc.role || "viewer"),
    assignedStation: String(doc.assignedStation || ""),
    isActive: doc.isActive !== false,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    lastLogin: doc.lastLogin ? new Date(doc.lastLogin).toISOString() : null,
  };
}

export interface PublicUserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  assignedStation: string;
  isActive: boolean;
  lastLogin: string | null;
  shiftLogoutAt?: number | null;
}

export function toPublicUser(
  user: any,
  extras: { shiftLogoutAt?: number | null } = {}
): PublicUserRecord {
  const base: PublicUserRecord = {
    id: String(user.id || user._id || ""),
    username: String(user.username || ""),
    displayName: String(user.displayName || ""),
    email: String(user.email || ""),
    role: normalizeAuthRole(user.role || "viewer"),
    assignedStation: String(user.assignedStation || ""),
    isActive: user.isActive !== false,
    lastLogin: user.lastLogin
      ? new Date(user.lastLogin).toISOString()
      : null,
  };
  if (extras.shiftLogoutAt !== undefined) {
    base.shiftLogoutAt = extras.shiftLogoutAt;
  } else if (user.shiftLogoutAt !== undefined) {
    base.shiftLogoutAt = user.shiftLogoutAt;
  }
  return base;
}

export async function findUserByUsername(
  username: string
): Promise<StoredUserRecord | null> {
  const uname = String(username || "").trim().toLowerCase();
  if (!uname) return null;

  await connectDB();
  if (isDbConnected()) {
    const doc = await Admin.findOne({ username: uname }).lean();
    if (doc) return mapDocToUser(doc);
  }

  const store = getMockStore();
  const hit = store.users.find(
    (u) => String(u.username || "").toLowerCase() === uname
  );
  return hit ? mapDocToUser(hit) : null;
}

export async function findUserByIdOrUsername({
  id,
  username,
}: {
  id?: string | null;
  username?: string | null;
}): Promise<StoredUserRecord | null> {
  const uid = String(id || "").trim();
  const uname = String(username || "").trim().toLowerCase();

  await connectDB();
  if (isDbConnected()) {
    let doc: any = null;
    if (uid && mongoose.Types.ObjectId.isValid(uid)) {
      doc = await Admin.findById(uid).lean();
    }
    if (!doc && uname) {
      doc = await Admin.findOne({ username: uname }).lean();
    }
    if (doc) return mapDocToUser(doc);
  }

  const store = getMockStore();
  const hit = store.users.find(
    (u) =>
      (uid && String(u.id) === uid) ||
      (uname && String(u.username || "").toLowerCase() === uname)
  );
  return hit ? mapDocToUser(hit) : null;
}

export async function isEmailTakenByOther(
  email: string,
  excludeUserId: string
): Promise<boolean> {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return false;

  await connectDB();
  if (isDbConnected()) {
    const query: Record<string, any> = { email: clean };
    if (mongoose.Types.ObjectId.isValid(excludeUserId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeUserId) };
    }
    const existing = await Admin.findOne(query).select("_id").lean();
    if (existing) return true;
  }

  const store = getMockStore();
  return store.users.some(
    (u) =>
      String(u.id) !== String(excludeUserId) &&
      String(u.email || "").toLowerCase() === clean
  );
}

export async function listAllUsers(): Promise<StoredUserRecord[]> {
  await connectDB();
  if (isDbConnected()) {
    const docs = await Admin.find({}).sort({ createdAt: 1 }).lean();
    return docs.map(mapDocToUser);
  }
  const store = getMockStore();
  return store.users.map(mapDocToUser);
}

export async function createUserAccount(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  role?: string;
  assignedStation?: string;
  lastLogin?: string | null;
}): Promise<{ user?: StoredUserRecord; conflict?: string }> {
  const username = String(input.username || "").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();
  const passwordHash = hashPassword(input.password);
  const role = normalizeAuthRole(input.role || "viewer");
  const displayName = String(input.displayName || "").trim();
  const assignedStation = String(input.assignedStation || "").trim();

  await connectDB();
  if (isDbConnected()) {
    const exists = await Admin.findOne({ username }).select("_id").lean();
    if (exists) return { conflict: "Username already exists" };
    if (email) {
      const emailClash = await Admin.findOne({ email }).select("_id").lean();
      if (emailClash) return { conflict: "Email already in use" };
    }
    const created = await Admin.create({
      username,
      displayName,
      email,
      role,
      assignedStation,
      isActive: true,
      passwordHash,
      lastLogin: input.lastLogin ? new Date(input.lastLogin) : null,
    });
    return { user: mapDocToUser(created) };
  }

  const store = getMockStore();
  if (
    store.users.some(
      (u) => String(u.username || "").toLowerCase() === username
    )
  ) {
    return { conflict: "Username already exists" };
  }
  if (
    email &&
    store.users.some((u) => String(u.email || "").toLowerCase() === email)
  ) {
    return { conflict: "Email already in use" };
  }

  const user = {
    id: generateId(),
    username,
    displayName,
    email,
    role,
    assignedStation,
    isActive: true,
    passwordHash,
    createdAt: new Date().toISOString(),
    lastLogin: input.lastLogin || null,
  };
  store.users.push(user);
  return { user: mapDocToUser(user) };
}

export async function updateUserAccount(
  lookup: { id?: string | null; username?: string | null },
  patch: {
    displayName?: string;
    email?: string;
    role?: string;
    assignedStation?: string;
    isActive?: boolean;
    password?: string;
    lastLogin?: string | Date;
  }
): Promise<StoredUserRecord | null> {
  const uid = String(lookup.id || "").trim();
  const uname = String(lookup.username || "").trim().toLowerCase();

  await connectDB();
  if (isDbConnected()) {
    let doc: any = null;
    if (uid && mongoose.Types.ObjectId.isValid(uid)) {
      doc = await Admin.findById(uid);
    }
    if (!doc && uname) {
      doc = await Admin.findOne({ username: uname });
    }
    if (!doc) return null;

    if (patch.displayName !== undefined) doc.displayName = patch.displayName;
    if (patch.email !== undefined) doc.email = patch.email;
    if (patch.role !== undefined) doc.role = normalizeAuthRole(patch.role);
    if (patch.assignedStation !== undefined)
      doc.assignedStation = patch.assignedStation;
    if (patch.isActive !== undefined) doc.isActive = Boolean(patch.isActive);
    if (patch.password) doc.passwordHash = hashPassword(patch.password);
    if (patch.lastLogin !== undefined) doc.lastLogin = new Date(patch.lastLogin);

    await doc.save();
    return mapDocToUser(doc);
  }

  const store = getMockStore();
  const user = store.users.find(
    (u) =>
      (uid && String(u.id) === uid) ||
      (uname && String(u.username || "").toLowerCase() === uname)
  );
  if (!user) return null;

  if (patch.displayName !== undefined) user.displayName = patch.displayName;
  if (patch.email !== undefined) user.email = patch.email;
  if (patch.role !== undefined) user.role = normalizeAuthRole(patch.role);
  if (patch.assignedStation !== undefined)
    user.assignedStation = patch.assignedStation;
  if (patch.isActive !== undefined) user.isActive = Boolean(patch.isActive);
  if (patch.password) user.passwordHash = hashPassword(patch.password);
  if (patch.lastLogin !== undefined) {
    user.lastLogin =
      patch.lastLogin instanceof Date
        ? patch.lastLogin.toISOString()
        : String(patch.lastLogin);
  }

  return mapDocToUser(user);
}

/**
 * In mock/in-memory mode, if a user has a valid JWT from before a server reload,
 * restore their entry into mockStore so self-service profile updates succeed.
 */
export function ensureMockUserFromAuth(authAdmin: any): StoredUserRecord | null {
  if (!authAdmin || isDbConnected()) return null;
  const uname = String(authAdmin.username || "").trim().toLowerCase();
  const uid = String(authAdmin.id || "").trim();
  if (!uname && !uid) return null;

  const store = getMockStore();
  const existing = store.users.find(
    (u) =>
      (uid && String(u.id) === uid) ||
      (uname && String(u.username || "").toLowerCase() === uname)
  );
  if (existing) return mapDocToUser(existing);

  const restored = {
    id: uid || generateId(),
    username: uname || uid,
    displayName: String(authAdmin.displayName || ""),
    email: String(authAdmin.email || ""),
    role: normalizeAuthRole(authAdmin.role || "viewer"),
    assignedStation: String(authAdmin.assignedStation || ""),
    isActive: true,
    passwordHash: hashPassword("admin123"),
    createdAt: new Date().toISOString(),
    lastLogin: authAdmin.lastLogin || new Date().toISOString(),
  };
  store.users.push(restored);
  return mapDocToUser(restored);
}

export async function deleteUserAccount(id: string): Promise<boolean> {
  const uid = String(id || "").trim();
  if (!uid) return false;

  await connectDB();
  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(uid)) return false;
    const deleted = await Admin.findByIdAndDelete(uid);
    return !!deleted;
  }

  const store = getMockStore();
  const idx = store.users.findIndex((u) => String(u.id) === uid);
  if (idx === -1) return false;
  store.users.splice(idx, 1);
  return true;
}

export function verifyUserPassword(password: string, passwordHash?: string) {
  return verifyPassword(password, passwordHash);
}
