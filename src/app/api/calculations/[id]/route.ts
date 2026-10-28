import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Calculation from "@/lib/models/Calculation";
import { purgeExpiredTrash } from "@/lib/trash";
import { requireAuth } from "@/lib/serverAuth";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    await connectDB();
    await purgeExpiredTrash();
    const { id } = await params;

    if (!isDbConnected()) {
      const store = getMockStore();
      const doc = store.calculations.find((d) => String(d._id) === String(id));
      if (!doc) {
        return NextResponse.json(
          { success: false, message: "Not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: doc });
    }

    const doc = await Calculation.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to fetch" },
      { status: 500 }
    );
  }
}

/** Soft-delete (to trash) or permanent delete (?permanent=1) */
export async function DELETE(request, { params }) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    await connectDB();
    await purgeExpiredTrash();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent =
      searchParams.get("permanent") === "1" ||
      searchParams.get("permanent") === "true";

    if (!isDbConnected()) {
      const store = getMockStore();
      if (permanent) {
        const role = String(auth.admin?.role || "").toLowerCase();
        if (role !== "admin" && role !== "superadmin") {
          return NextResponse.json(
            {
              success: false,
              message: "Admin access required to permanently delete",
            },
            { status: 403 }
          );
        }
        const idx = store.calculations.findIndex(
          (d) => String(d._id) === String(id) && !!d.deletedAt
        );
        if (idx === -1) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Not found in trash (only trash items can be permanently deleted)",
            },
            { status: 404 }
          );
        }
        store.calculations.splice(idx, 1);
        return NextResponse.json({
          success: true,
          message: "Permanently deleted",
        });
      }

      const idx = store.calculations.findIndex(
        (d) => String(d._id) === String(id) && !d.deletedAt
      );
      if (idx === -1) {
        return NextResponse.json(
          { success: false, message: "Not found or already in trash" },
          { status: 404 }
        );
      }
      const nowIso = new Date().toISOString();
      store.calculations[idx] = {
        ...store.calculations[idx],
        deletedAt: nowIso,
        updatedAt: nowIso,
      };
      return NextResponse.json({
        success: true,
        message: "Moved to trash",
        data: store.calculations[idx],
      });
    }

    if (permanent) {
      const role = String(auth.admin?.role || "").toLowerCase();
      if (role !== "admin" && role !== "superadmin") {
        return NextResponse.json(
          { success: false, message: "Admin access required to permanently delete" },
          { status: 403 }
        );
      }
      const doc = await Calculation.findOneAndDelete({
        _id: id,
        deletedAt: { $ne: null },
      });
      if (!doc) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Not found in trash (only trash items can be permanently deleted)",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Permanently deleted",
      });
    }

    const doc = await Calculation.findOneAndUpdate(
      {
        _id: id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );

    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Not found or already in trash" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Moved to trash",
      data: doc,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to delete" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    await connectDB();
    await purgeExpiredTrash();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.action === "restore") {
      if (!isDbConnected()) {
        const store = getMockStore();
        const idx = store.calculations.findIndex(
          (d) => String(d._id) === String(id) && !!d.deletedAt
        );
        if (idx === -1) {
          return NextResponse.json(
            { success: false, message: "Not found in trash" },
            { status: 404 }
          );
        }
        store.calculations[idx] = {
          ...store.calculations[idx],
          deletedAt: null,
          updatedAt: new Date().toISOString(),
        };
        return NextResponse.json({
          success: true,
          message: "Restored",
          data: store.calculations[idx],
        });
      }

      const doc = await Calculation.findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        { $set: { deletedAt: null } },
        { new: true }
      );

      if (!doc) {
        return NextResponse.json(
          { success: false, message: "Not found in trash" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Restored",
        data: doc,
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

    const normalizedFeeders = feeders.map((f) => ({
      id: f.id,
      name: f.name,
      bus: f.bus,
      amps: Number(f.amps) || 0,
      mw: Number(f.mw) || 0,
      lsMW: Math.max(0, Number(f.lsMW) || 0),
      ringActive: f.ringActive === true,
    }));

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
      note: note != null ? String(note) : undefined,
      hasActiveRing: normalizedFeeders.some((f) => f.ringActive === true),
    };
    if (fields.note === undefined) delete fields.note;

    if (typeof body.hourSlot === "string" && body.hourSlot.trim()) {
      fields.hourSlot = body.hourSlot.trim();
      fields.isHourly = true;
    }
    if (body.calculatedAt) {
      const parsed = new Date(body.calculatedAt);
      if (!Number.isNaN(parsed.getTime())) fields.calculatedAt = parsed;
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      const idx = store.calculations.findIndex(
        (d) => String(d._id) === String(id) && !d.deletedAt
      );
      if (idx === -1) {
        return NextResponse.json(
          { success: false, message: "Not found or in trash" },
          { status: 404 }
        );
      }
      store.calculations[idx] = {
        ...store.calculations[idx],
        ...fields,
        calculatedAt: fields.calculatedAt
          ? fields.calculatedAt.toISOString()
          : store.calculations[idx].calculatedAt,
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({
        success: true,
        message: "Updated successfully",
        data: store.calculations[idx],
      });
    }

    const doc = await Calculation.findOneAndUpdate(
      {
        _id: id,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      { $set: fields },
      { new: true }
    );

    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Not found or in trash" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Updated successfully",
      data: doc,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to update" },
      { status: 500 }
    );
  }
}
