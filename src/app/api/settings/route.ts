import { NextResponse } from "next/server";
import { connectDB, isDbConnected } from "@/lib/db";
import Settings from "@/lib/models/Settings";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

function normalizeRingMap(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  if (raw instanceof Map) {
    for (const [k, v] of raw.entries()) {
      if (v === true || v === "true" || v === 1) out[String(k)] = true;
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    if (v === true || v === "true" || v === 1) out[String(k)] = true;
  }
  return out;
}

async function getOrCreateSettings() {
  let doc = await Settings.findOne({ key: "app" });
  if (!doc) {
    doc = await Settings.create({
      key: "app",
      maxLoadRingMode: "with",
      calculatorRingActive: {},
    });
  }
  return doc;
}

function settingsPayload(doc) {
  const lean = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    ...lean,
    maxLoadRingMode: lean.maxLoadRingMode === "without" ? "without" : "with",
    calculatorRingActive: normalizeRingMap(lean.calculatorRingActive),
  };
}

/** GET /api/settings */
export async function GET() {
  try {
    await connectDB();
    if (!isDbConnected()) {
      const store = getMockStore();
      return NextResponse.json({
        success: true,
        data: settingsPayload(store.settings),
      });
    }
    const doc = await getOrCreateSettings();
    return NextResponse.json({
      success: true,
      data: settingsPayload(doc),
    });
  } catch (err) {
    console.warn("GET /api/settings fallback to mock:", err.message);
    const store = getMockStore();
    return NextResponse.json({
      success: true,
      data: settingsPayload(store.settings),
    });
  }
}

/**
 * PATCH /api/settings
 * Body may include maxLoadRingMode, calculatorRingActive, and station settings
 */
export async function PATCH(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const $set = {};

    if (body.maxLoadRingMode != null) {
      const mode = String(body.maxLoadRingMode || "").toLowerCase();
      if (mode !== "with" && mode !== "without") {
        return NextResponse.json(
          {
            success: false,
            message: 'maxLoadRingMode must be "with" or "without"',
          },
          { status: 400 }
        );
      }
      $set.maxLoadRingMode = mode;
    }

    if (body.calculatorRingActive != null) {
      if (
        typeof body.calculatorRingActive !== "object" ||
        Array.isArray(body.calculatorRingActive)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "calculatorRingActive must be an object map",
          },
          { status: 400 }
        );
      }
      $set.calculatorRingActive = normalizeRingMap(body.calculatorRingActive);
    }

    const extraStringKeys = [
      "stationName",
      "stationOrg",
      "circleRelaxUntil",
      "districtDayBoundary",
    ];
    for (const k of extraStringKeys) {
      if (body[k] != null) $set[k] = String(body[k]);
    }

    const extraNumberKeys = [
      "defaultBus1Kv",
      "defaultBus2Kv",
      "bus1MaxKv",
      "bus2MaxKv",
      "trashRetentionDays",
    ];
    for (const k of extraNumberKeys) {
      if (body[k] != null && Number.isFinite(Number(body[k]))) {
        $set[k] = Number(body[k]);
      }
    }

    if (Array.isArray(body.circleRelaxedSlots)) {
      $set.circleRelaxedSlots = body.circleRelaxedSlots.map(String);
    }

    if (Object.keys($set).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid settings fields to update",
        },
        { status: 400 }
      );
    }

    if (!isDbConnected()) {
      const store = getMockStore();
      store.settings = { ...store.settings, ...$set };
      return NextResponse.json({
        success: true,
        data: settingsPayload(store.settings),
      });
    }

    let doc = await Settings.findOne({ key: "app" });
    if (!doc) {
      doc = new Settings({
        key: "app",
        maxLoadRingMode: "with",
        calculatorRingActive: {},
      });
    }
    for (const [k, v] of Object.entries($set)) {
      doc.set(k, v);
      if (k === "calculatorRingActive" || k === "circleRelaxedSlots") {
        doc.markModified(k);
      }
    }
    await doc.save();

    return NextResponse.json({
      success: true,
      data: settingsPayload(doc),
    });
  } catch (err) {
    console.error("PATCH /api/settings:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Failed to save settings" },
      { status: 500 }
    );
  }
}
