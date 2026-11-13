import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSessionExpiry,
  formatDhakaCutoffHM,
  getNextShiftCutoffMs,
  isShiftAutoLogoutRole,
} from "./shiftSession";
import { signToken, verifyTokenString, ShiftCutoffError } from "./serverAuth";

function dhakaMs(ymd: string, hm: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  // Asia/Dhaka is UTC+6
  return Date.UTC(y, m - 1, d, hh - 6, mm, 0, 0);
}

test("isShiftAutoLogoutRole applies only to admin and duty roles", () => {
  assert.equal(isShiftAutoLogoutRole("admin"), true);
  assert.equal(isShiftAutoLogoutRole("superadmin"), true);
  assert.equal(isShiftAutoLogoutRole("duty"), true);
  assert.equal(isShiftAutoLogoutRole("duty-person"), true);
  assert.equal(isShiftAutoLogoutRole("operator"), true);

  assert.equal(isShiftAutoLogoutRole("circle-load-input"), false);
  assert.equal(isShiftAutoLogoutRole("circleloadinput"), false);
  assert.equal(isShiftAutoLogoutRole("circle-input"), false);
  assert.equal(isShiftAutoLogoutRole("viewer"), false);
  assert.equal(isShiftAutoLogoutRole(""), false);
});

test("getNextShiftCutoffMs picks 08:30, 14:30, and 20:30 Asia/Dhaka cutoffs", () => {
  const c1 = getNextShiftCutoffMs(dhakaMs("2026-11-13", "07:15"));
  assert.equal(formatDhakaCutoffHM(c1), "08:30");
  assert.equal(c1, dhakaMs("2026-11-13", "08:30"));

  // Exactly at 08:30 advances to 14:30
  const c2 = getNextShiftCutoffMs(dhakaMs("2026-11-13", "08:30"));
  assert.equal(formatDhakaCutoffHM(c2), "14:30");
  assert.equal(c2, dhakaMs("2026-11-13", "14:30"));

  const c3 = getNextShiftCutoffMs(dhakaMs("2026-11-13", "14:29"));
  assert.equal(formatDhakaCutoffHM(c3), "14:30");

  const c4 = getNextShiftCutoffMs(dhakaMs("2026-11-13", "15:05"));
  assert.equal(formatDhakaCutoffHM(c4), "20:30");
  assert.equal(c4, dhakaMs("2026-11-13", "20:30"));

  // After 20:30 wraps to next morning 08:30 BST
  const c5 = getNextShiftCutoffMs(dhakaMs("2026-11-13", "21:00"));
  assert.equal(formatDhakaCutoffHM(c5), "08:30");
  assert.equal(c5, dhakaMs("2026-11-14", "08:30"));
});

test("computeSessionExpiry sets shift cutoff for duty/admin and 7d for circle-load-input/viewer", () => {
  const now = dhakaMs("2026-11-13", "10:00");
  const dutyExp = computeSessionExpiry("duty", now);
  assert.equal(dutyExp.shiftLogoutAt, dhakaMs("2026-11-13", "14:30"));
  assert.equal(dutyExp.ttlSeconds, 4.5 * 3600);

  const circleExp = computeSessionExpiry("circle-load-input", now);
  assert.equal(circleExp.shiftLogoutAt, null);
  assert.equal(circleExp.ttlSeconds, 7 * 24 * 60 * 60);

  const viewerExp = computeSessionExpiry("viewer", now);
  assert.equal(viewerExp.shiftLogoutAt, null);
});

test("verifyTokenString rejects expired shift cutoff for duty/admin but allows circle-load-input", () => {
  const dutyToken = signToken({
    id: "u1",
    username: "bottail.dilip",
    role: "duty",
  });
  const decodedBefore = verifyTokenString(dutyToken);
  assert.ok(decodedBefore.shiftLogoutAt && decodedBefore.shiftLogoutAt > Date.now());

  // At exact shiftLogoutAt (and after), duty/admin tokens are rejected with ShiftCutoffError
  assert.throws(
    () => verifyTokenString(dutyToken, decodedBefore.shiftLogoutAt),
    (err: any) => err instanceof ShiftCutoffError
  );

  const circleToken = signToken({
    id: "u2",
    username: "bheramara.op",
    role: "circle-load-input",
  });
  const verified = verifyTokenString(circleToken, decodedBefore.shiftLogoutAt + 60_000);
  assert.equal(verified.role, "circle-load-input");
  assert.equal(verified.shiftLogoutAt, null);
});
