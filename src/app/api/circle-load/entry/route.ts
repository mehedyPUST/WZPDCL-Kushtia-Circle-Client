import { NextResponse } from "next/server";
import { getMockStore } from "@/lib/mockStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const store = getMockStore();
    if (body?.day && body?.slot && body?.stationId) {
      const key = `${body.day}:${body.slot}:${body.stationId}`;
      const prev = store.circleEntries.get(key) || {};
      store.circleEntries.set(key, {
        ...prev,
        ...(body.actualLoad !== undefined ? { actualLoad: body.actualLoad } : {}),
        ...(body.loadshed !== undefined ? { loadshed: body.loadshed } : {}),
        ...(body.pgcbAllotment !== undefined
          ? { pgcbAllotment: body.pgcbAllotment }
          : {}),
        ...(body.pbsLoad !== undefined ? { pbsLoad: body.pbsLoad } : {}),
        ...(body.pbsLoadshed !== undefined
          ? { pbsLoadshed: body.pbsLoadshed }
          : {}),
        ...(body.pbsAllotment !== undefined
          ? { pbsAllotment: body.pbsAllotment }
          : {}),
      });
    }
    return NextResponse.json({
      success: true,
      message: "Circle entry recorded successfully",
      data: body,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message || "Failed to save circle entry" },
      { status: 500 }
    );
  }
}
