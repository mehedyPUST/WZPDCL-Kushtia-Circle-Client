import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { purgeExpiredTrash } from "@/lib/trash";
import { requireAuth } from "@/lib/serverAuth";
import { getMockStore, generateId } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

const activeFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};
const trashFilter = { deletedAt: { $ne: null } };

function dayBoundsFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  const OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka UTC+6
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - OFFSET_MS);
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0) - OFFSET_MS);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end };
}

function resolveDateBounds(searchParams) {
  const single = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (single) {
    return dayBoundsFromYmd(single);
  }
  const fromB = from ? dayBoundsFromYmd(from) : null;
  const toB = to ? dayBoundsFromYmd(to) : null;
  if (!fromB && !toB) return null;
  return {
    start: fromB ? fromB.start : null,
    end: toB ? toB.end : null,
  };
}

function buildEventDateFilter(searchParams) {
  const b = resolveDateBounds(searchParams);
  if (!b) return null;
  const eventAt = { $ifNull: ["$calculatedAt", "$createdAt"] };
  const parts = [];
  if (b.start) parts.push({ $gte: [eventAt, b.start] });
  if (b.end) parts.push({ $lt: [eventAt, b.end] });
  if (parts.length === 0) return null;
  return { $expr: parts.length === 1 ? parts[0] : { $and: parts } };
}

export async function GET(request) {
  try {
    await connectDB();
    const purged = await purgeExpiredTrash();

    const { searchParams } = new URL(request.url);

    const rawLimit = (searchParams.get("limit") || "50").toLowerCase();
    let limit;
    if (rawLimit === "0" || rawLimit === "all") {
      limit = 0;
    } else {
      const n = parseInt(rawLimit, 10);
      limit = Math.min(Number.isFinite(n) && n > 0 ? n : 50, 200);
    }
    const pageRaw = parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const trash =
      searchParams.get("trash") === "1" || searchParams.get("trash") === "true";

    if (!isDbConnected()) {
      const store = getMockStore();
      const bounds = resolveDateBounds(searchParams);
      const activeDocs = store.calculations.filter((d) => !d.deletedAt);
      const trashedDocs = store.calculations.filter((d) => !!d.deletedAt);
      let matched = (trash ? trashedDocs : activeDocs).filter((d) => {
        if (!bounds) return true;
        const ev = new Date(d.calculatedAt || d.createdAt).getTime();
        if (Number.isNaN(ev)) return false;
        if (bounds.start && ev < bounds.start.getTime()) return false;
        if (bounds.end && ev >= bounds.end.getTime()) return false;
        return true;
      });

      matched.sort((a, b) => {
        const key = trash ? "deletedAt" : "createdAt";
        return new Date(b[key] || 0).getTime() - new Date(a[key] || 0).getTime();
      });

      const total = matched.length;
      const docs =
        limit > 0
          ? matched.slice(skip, skip + limit)
          : matched.slice(0, 10000);
      const pages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

      return NextResponse.json({
        success: true,
        count: docs.length,
        total,
        page: limit > 0 ? page : 1,
        limit: limit > 0 ? limit : total,
        pages,
        inboxCount: activeDocs.length,
        trashCount: trashedDocs.length,
        purged,
        trash,
        data: docs,
      });
    }

    const baseFilter = trash ? trashFilter : activeFilter;
    const dateFilter = buildEventDateFilter(searchParams);
    const filter = dateFilter
      ? { $and: [baseFilter, dateFilter] }
      : baseFilter;

    const sort = trash ? { deletedAt: -1 } : { createdAt: -1 };

    const query = Calculation.find(filter).sort(sort);
    if (limit > 0) {
      query.skip(skip).limit(limit);
    } else {
      query.limit(10000);
    }

    const [docs, total, inboxCount, trashCount] = await Promise.all([
      query.lean(),
      Calculation.countDocuments(filter),
      Calculation.countDocuments(activeFilter),
      Calculation.countDocuments(trashFilter),
    ]);

    const pages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

    return NextResponse.json({
      success: true,
      count: docs.length,
      total,
      page: limit > 0 ? page : 1,
      limit: limit > 0 ? limit : total,
      pages,
      inboxCount,
      trashCount,
      purged,
      trash,
      data: docs,
    });
  } catch (err) {
    console.error("GET /api/calculations:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    await connectDB();
    const body = await request.json();

    if (body.action && Array.isArray(body.ids)) {
      return handleBulk(body, auth.admin);
    }

    // Empty entire trash — admin only
    if (body.action === "empty_trash") {
      const role = String(auth.admin?.role || "").toLowerCase();
      if (role !== "admin" && role !== "superadmin") {
        return NextResponse.json(
          { success: false, message: "Admin access required to empty trash" },
          { status: 403 }
        );
      }
      await purgeExpiredTrash();
      if (!isDbConnected()) {
        const store = getMockStore();
        const before = store.calculations.length;
        store.calculations = store.calculations.filter((d) => !d.deletedAt);
        return NextResponse.json({
          success: true,
          message: "Trash emptied",
          deleted: before - store.calculations.length,
        });
      }
      const result = await Calculation.deleteMany(trashFilter);
      return NextResponse.json({
        success: true,
        message: "Trash emptied",
        deleted: result.deletedCount,
      });
    }

    const { busVoltages, feeders, bottail11kV, totalMW, note } = body;

    if (
      !busVoltages ||
      busVoltages.bus1 == null ||
      busVoltages.bus2 == null ||
      !Array.isArray(feeders)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: busVoltages and feeders",
        },
        { status: 400 }
      );
    }

    let calculatedAt = new Date();
    if (body.calculatedAt) {
      const parsed = new Date(body.calculatedAt);
      if (!Number.isNaN(parsed.getTime())) calculatedAt = parsed;
    }
    const hourSlot =
      typeof body.hourSlot === "string" && body.hourSlot.trim()
        ? body.hourSlot.trim()
        : null;
    const isHourly = body.isHourly === true || !!hourSlot;

    const normalizedFeeders = (feeders || []).map((f) => ({
      id: f.id,
      name: f.name,
      bus: f.bus,
      amps: Number(f.amps) || 0,
      mw: Number(f.mw) || 0,
      lsMW: Math.max(0, Number(f.lsMW) || 0),
      ringActive: f.ringActive === true,
    }));
    const hasActiveRing = normalizedFeeders.some((f) => f.ringActive === true);

    const allotmentRaw = body.allotment;
    const allotment =
      allotmentRaw === null || allotmentRaw === undefined || allotmentRaw === ""
        ? null
        : Number(allotmentRaw);
    const allotmentVal =
      allotment != null && Number.isFinite(allotment) && allotment >= 0
        ? allotment
        : null;

    const fields = {
      busVoltages: {
        bus1: Number(busVoltages.bus1),
        bus2: Number(busVoltages.bus2),
      },
      feeders: normalizedFeeders,
      bottail11kV: Number(bottail11kV) || 0,
      totalMW: Number(totalMW) || 0,
      allotment: allotmentVal,
      note: note || "",
      calculatedAt,
      hourSlot,
      isHourly,
      hasActiveRing,
      deletedAt: null,
    };

    if (!isDbConnected()) {
      const store = getMockStore();
      const nowIso = new Date().toISOString();
      if (body.replaceExistingId) {
        const idx = store.calculations.findIndex(
          (d) => String(d._id) === String(body.replaceExistingId) && !d.deletedAt
        );
        if (idx === -1) {
          return NextResponse.json(
            {
              success: false,
              message: "Existing slot record not found or already removed",
            },
            { status: 404 }
          );
        }
        const updated = {
          ...store.calculations[idx],
          ...fields,
          calculatedAt: calculatedAt.toISOString(),
          updatedAt: nowIso,
        };
        store.calculations[idx] = updated;
        return NextResponse.json({
          success: true,
          message: "Slot data replaced successfully",
          replaced: true,
          data: updated,
        });
      }

      const doc = {
        _id: generateId(),
        ...fields,
        calculatedAt: calculatedAt.toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      store.calculations.unshift(doc);
      return NextResponse.json(
        {
          success: true,
          message: "Calculation saved successfully",
          data: doc,
        },
        { status: 201 }
      );
    }

    if (body.replaceExistingId) {
      const updated = await Calculation.findOneAndUpdate(
        {
          _id: body.replaceExistingId,
          $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        },
        { $set: fields },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json(
          {
            success: false,
            message: "Existing slot record not found or already removed",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Slot data replaced successfully",
        replaced: true,
        data: updated,
      });
    }

    const doc = await Calculation.create(fields);

    return NextResponse.json(
      {
        success: true,
        message: "Calculation saved successfully",
        data: doc,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/calculations:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to save" },
      { status: 500 }
    );
  }
}

async function handleBulk(body, admin) {
  const { action, ids } = body;
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map(String))];

  if (uniqueIds.length === 0) {
    return NextResponse.json(
      { success: false, message: "No items selected" },
      { status: 400 }
    );
  }

  await connectDB();
  await purgeExpiredTrash();

  if (!isDbConnected()) {
    const store = getMockStore();
    const idSet = new Set(uniqueIds);
    if (action === "trash") {
      let modified = 0;
      const nowIso = new Date().toISOString();
      store.calculations = store.calculations.map((d) => {
        if (idSet.has(String(d._id)) && !d.deletedAt) {
          modified++;
          return { ...d, deletedAt: nowIso, updatedAt: nowIso };
        }
        return d;
      });
      return NextResponse.json({
        success: true,
        message: "Moved to trash",
        modified,
      });
    }
    if (action === "restore") {
      let modified = 0;
      const nowIso = new Date().toISOString();
      store.calculations = store.calculations.map((d) => {
        if (idSet.has(String(d._id)) && d.deletedAt) {
          modified++;
          return { ...d, deletedAt: null, updatedAt: nowIso };
        }
        return d;
      });
      return NextResponse.json({
        success: true,
        message: "Restored to history",
        modified,
      });
    }
    if (action === "purge") {
      const role = String(admin?.role || "").toLowerCase();
      if (role !== "admin" && role !== "superadmin") {
        return NextResponse.json(
          {
            success: false,
            message: "Admin access required to permanently delete",
          },
          { status: 403 }
        );
      }
      const before = store.calculations.length;
      store.calculations = store.calculations.filter(
        (d) => !(idSet.has(String(d._id)) && d.deletedAt)
      );
      return NextResponse.json({
        success: true,
        message: "Permanently deleted",
        deleted: before - store.calculations.length,
      });
    }
    return NextResponse.json(
      { success: false, message: "Unknown action" },
      { status: 400 }
    );
  }

  if (action === "trash") {
    const result = await Calculation.updateMany(
      {
        _id: { $in: uniqueIds },
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      { $set: { deletedAt: new Date() } }
    );
    return NextResponse.json({
      success: true,
      message: "Moved to trash",
      modified: result.modifiedCount,
    });
  }

  if (action === "restore") {
    const result = await Calculation.updateMany(
      { _id: { $in: uniqueIds }, deletedAt: { $ne: null } },
      { $set: { deletedAt: null } }
    );
    return NextResponse.json({
      success: true,
      message: "Restored to history",
      modified: result.modifiedCount,
    });
  }

  if (action === "purge") {
    const role = String(admin?.role || "").toLowerCase();
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json(
        { success: false, message: "Admin access required to permanently delete" },
        { status: 403 }
      );
    }
    const result = await Calculation.deleteMany({
      _id: { $in: uniqueIds },
      deletedAt: { $ne: null },
    });
    return NextResponse.json({
      success: true,
      message: "Permanently deleted",
      deleted: result.deletedCount,
    });
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  );
}
