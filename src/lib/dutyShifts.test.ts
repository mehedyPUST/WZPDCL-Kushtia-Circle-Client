import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthlyDutyRoster,
  classifyDuty,
  formatShiftCount,
  localPartsFromRecord,
  monthQueryBounds,
  normalizePersonName,
} from "./dutyShifts";

test("normalizePersonName unifies admin, Bottail SS Admin, mehedy variants and cleans station handles", () => {
  assert.equal(normalizePersonName("admin"), "Mehedy");
  assert.equal(normalizePersonName("Bottail SS Admin"), "Mehedy");
  assert.equal(normalizePersonName("bottail.mehedy"), "Mehedy");
  assert.equal(normalizePersonName("mehedy.bottail"), "Mehedy");
  assert.equal(normalizePersonName("bottail.mehedy/admin"), "Mehedy");
  assert.equal(normalizePersonName("bottail.dilip"), "Dilip");
  assert.equal(normalizePersonName("bottail.tareq"), "Tareq");
  assert.equal(normalizePersonName("bottail.karim"), "Karim");
  assert.equal(normalizePersonName(""), "Unknown");
  assert.equal(normalizePersonName(null), "Unknown");
  assert.equal(normalizePersonName("unknown"), "Unknown");
});

test("localPartsFromRecord and classifyDuty handle midnight 00:00 and 23:00 slot wraparounds in Asia/Dhaka", () => {
  // 23:55 Dhaka on 2026-10-31 = 17:55 UTC on 2026-10-31, logged for 00:00 slot
  // Should belong to 2026-10-31 Shift C (NOT 2026-10-30!)
  const preMidnight00Slot = {
    hourSlot: "00:00",
    calculatedAt: "2026-10-31T17:55:00.000Z",
  };
  const parts00 = localPartsFromRecord(preMidnight00Slot);
  assert.deepEqual(parts00, { hour: 0, minute: 0, ymd: "2026-11-01" });
  const duty00 = classifyDuty(preMidnight00Slot);
  assert.equal(duty00?.dutyDay, "2026-10-31");
  assert.equal(duty00?.shift, "C");

  // 00:05 Dhaka on 2026-11-02 = 18:05 UTC on 2026-11-01, logged late for 23:00 slot
  // Should belong to 2026-11-01 Shift C (NOT 2026-11-02!)
  const postMidnight23Slot = {
    hourSlot: "23:00",
    calculatedAt: "2026-11-01T18:05:00.000Z",
  };
  const parts23 = localPartsFromRecord(postMidnight23Slot);
  assert.deepEqual(parts23, { hour: 23, minute: 0, ymd: "2026-11-01" });
  const duty23 = classifyDuty(postMidnight23Slot);
  assert.equal(duty23?.dutyDay, "2026-11-01");
  assert.equal(duty23?.shift, "C");

  // Standard 03:00 morning C-shift rolls to previous duty day
  const earlyMorningC = {
    hourSlot: "03:00",
    calculatedAt: "2026-11-02T21:10:00.000Z", // 03:10 Dhaka on 2026-11-03
  };
  const dutyMorning = classifyDuty(earlyMorningC);
  assert.equal(dutyMorning?.dutyDay, "2026-11-02");
  assert.equal(dutyMorning?.shift, "C");
});

test("buildMonthlyDutyRoster excludes unattributed records from matrix, leaders, and leaderboard", () => {
  const records = [
    { hourSlot: "10:00", calculatedAt: "2026-10-10T04:10:00.000Z", createdByUsername: null },
    { hourSlot: "11:00", calculatedAt: "2026-10-10T05:10:00.000Z" },
    { hourSlot: "12:00", calculatedAt: "2026-10-10T06:10:00.000Z", createdByUsername: "unknown" },
    { hourSlot: "16:00", calculatedAt: "2026-10-10T10:10:00.000Z", createdByUsername: "bottail.dilip" },
    { hourSlot: "10:00", calculatedAt: "2026-10-11T04:10:00.000Z", createdByUsername: "Bottail SS Admin" },
    { hourSlot: "11:00", calculatedAt: "2026-10-11T05:10:00.000Z", createdByUsername: "mehedy.bottail" },
  ];

  const roster = buildMonthlyDutyRoster(records, 2026, 10, { todayYmd: "2026-10-31" });
  assert.equal(roster.unattributed, 3);
  assert.equal(roster.classified, 3);
  assert.deepEqual(
    roster.persons.map((p) => p.person),
    ["Mehedy", "Dilip"]
  );
  assert.equal(roster.shiftLeaders.A.person, "Mehedy");
  assert.equal(roster.shiftLeaders.B.person, "Dilip");
  const oct10 = roster.days.find((d) => d.ymd === "2026-10-10");
  assert.equal(oct10?.unattributedEntries, 3);
  assert.equal(oct10?.A.person, null);
  assert.equal(oct10?.B.person, "Dilip");
});

test("buildMonthlyDutyRoster splits tied shifts equally without alphabetical bias and flags sharedShifts", () => {
  const records = [
    // 2026-11-01 Shift A: Dilip (2) vs Tareq (2) -> 0.5 each!
    { hourSlot: "09:00", calculatedAt: "2026-11-01T03:05:00.000Z", createdByUsername: "bottail.dilip" },
    { hourSlot: "10:00", calculatedAt: "2026-11-01T04:05:00.000Z", createdByUsername: "bottail.dilip" },
    { hourSlot: "11:00", calculatedAt: "2026-11-01T05:05:00.000Z", createdByUsername: "bottail.tareq" },
    { hourSlot: "12:00", calculatedAt: "2026-11-01T06:05:00.000Z", createdByUsername: "bottail.tareq" },
    // 2026-11-01 Shift B: Mehedy solo (1)
    { hourSlot: "16:00", calculatedAt: "2026-11-01T10:05:00.000Z", createdByUsername: "admin" },
  ];

  const roster = buildMonthlyDutyRoster(records, 2026, 11, {
    todayYmd: "2026-11-02",
    todayHour: 22,
  });
  const nov1 = roster.days.find((d) => d.ymd === "2026-11-01");
  assert.ok(nov1);
  assert.equal(nov1.A.isTie, true);
  assert.deepEqual(nov1.A.winners, ["Dilip", "Tareq"]);
  assert.equal(nov1.A.person, "Dilip & Tareq");
  assert.deepEqual(nov1.byPerson.Dilip.shifts, ["A"]);
  assert.deepEqual(nov1.byPerson.Dilip.sharedShifts, ["A"]);
  assert.deepEqual(nov1.byPerson.Tareq.shifts, ["A"]);
  assert.deepEqual(nov1.byPerson.Tareq.sharedShifts, ["A"]);
  assert.deepEqual(nov1.coveredShifts, ["A", "B"]);
  assert.deepEqual(nov1.missingShifts, ["C"]);

  const dilipCol = roster.persons.find((p) => p.person === "Dilip");
  const tareqCol = roster.persons.find((p) => p.person === "Tareq");
  const mehedyCol = roster.persons.find((p) => p.person === "Mehedy");
  assert.equal(dilipCol?.shifts, 0.5);
  assert.equal(tareqCol?.shifts, 0.5);
  assert.equal(mehedyCol?.shifts, 1);

  assert.equal(roster.coverage.elapsedDays, 2);
  assert.equal(roster.coverage.filledShiftSlots, 2);
  assert.equal(roster.coverage.uncoveredShiftSlots, 4);
  assert.equal(roster.coverage.tiedShiftSlots, 1);
  assert.equal(formatShiftCount(0.5), "0.5");
  assert.equal(formatShiftCount(7), "7");

  // At 06:00 on 2026-11-02, none of Nov 2 shifts have started -> upcomingShifts, not missing
  const morningRoster = buildMonthlyDutyRoster(records, 2026, 11, {
    todayYmd: "2026-11-02",
    todayHour: 6,
  });
  const nov2Morning = morningRoster.days.find((d) => d.ymd === "2026-11-02");
  assert.deepEqual(nov2Morning?.upcomingShifts, ["A", "B", "C"]);
  assert.deepEqual(nov2Morning?.missingShifts, []);
  assert.equal(morningRoster.coverage.uncoveredShiftSlots, 1);
});

test("monthQueryBounds spans day before month start and day after month end", () => {
  assert.deepEqual(monthQueryBounds(2026, 11), {
    from: "2026-10-31",
    to: "2026-12-01",
  });
  assert.deepEqual(monthQueryBounds(2024, 2), {
    from: "2024-01-31",
    to: "2024-03-01",
  });
});
