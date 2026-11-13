import test from "node:test";
import assert from "node:assert/strict";
import {
  computeFeederMW,
  computeAmpsFromMW,
  buildCalculationResult,
  buildLoadShedPlan,
  suggestProportionalLs,
} from "./calculations";
import { POWER_FACTOR, feederAllowsRing } from "./constants";

test("computeFeederMW follows MW = (sqrt(3) * kV * PF * amps) / 1000", () => {
  const mw = computeFeederMW(100, 33);
  const expected = (Math.sqrt(3) * 33 * POWER_FACTOR * 100) / 1000;
  assert.ok(Math.abs(mw - expected) < 1e-9);
  assert.equal(computeFeederMW(0, 33), 0);
  assert.equal(computeFeederMW(100, 0), 0);
  assert.equal(computeFeederMW("", "33"), 0);
});

test("computeAmpsFromMW inverts computeFeederMW accurately", () => {
  const mw = computeFeederMW(145, 32.8);
  const amps = computeAmpsFromMW(mw, 32.8);
  assert.ok(Math.abs(amps - 145) < 1e-6);
  assert.equal(computeAmpsFromMW(0, 33), 0);
});

test("buildCalculationResult locks bus shutdown (0 kV) amps to 0 and computes Bottail 11kV + ring flags", () => {
  const amps = {
    1: "100", // BRB (bus 2)
    2: "100", // MRS (bus 1)
    3: "50",  // Mozompur (bus 2)
    8: "80",  // H-3 (bus 1)
    9: "70",  // T-3 (bus 2)
  };
  const res = buildCalculationResult(
    amps,
    { bus1: "0", bus2: "33" },
    { 1: true, 3: true } // feeder 1 (BRB) cannot ring; feeder 3 (Mozompur) can
  );

  const mrs = res.feeders.find((f) => f.id === 2);
  const brb = res.feeders.find((f) => f.id === 1);
  const moz = res.feeders.find((f) => f.id === 3);
  const h3 = res.feeders.find((f) => f.id === 8);
  const t3 = res.feeders.find((f) => f.id === 9);

  assert.equal(mrs?.amps, 0);
  assert.equal(mrs?.mw, 0);
  assert.equal(h3?.amps, 0);
  assert.equal(brb?.ringActive, false);
  assert.equal(feederAllowsRing(1), false);
  assert.equal(moz?.ringActive, true);
  assert.equal(res.hasActiveRing, true);
  assert.ok(Math.abs(res.bottail11kV - (t3?.mw || 0)) < 1e-9);
});

test("buildLoadShedPlan distributes shortage proportionally across non-protected feeders", () => {
  const amps = {
    1: "100", // BRB (bus 2)
    2: "100", // MRS (bus 1)
    3: "200", // Mozompur (bus 2)
  };
  const plan = buildLoadShedPlan(amps, { bus1: "33", bus2: "33" }, "10", {
    excludeIds: [1, 2],
    currentLsMW: { 3: "1.5" },
  });

  assert.equal(plan.valid, true);
  assert.equal(plan.needsShed, true);

  const brb = plan.feeders.find((f) => f.id === 1);
  const moz = plan.feeders.find((f) => f.id === 3);

  assert.equal(brb?.protected, true);
  assert.equal(brb?.moreLsMW, 0);
  assert.ok((moz?.moreLsMW || 0) > 0);
  assert.ok(Math.abs((moz?.totalLsMW || 0) - (1.5 + (moz?.moreLsMW || 0))) < 1e-9);
  assert.ok(Math.abs((moz?.targetMW || 0) + (moz?.moreLsMW || 0) - (moz?.mw || 0)) < 1e-9);
});

test("suggestProportionalLs sums rounded 0.1 MW steps to total shortage", () => {
  const feeders = [
    { id: 1, mw: 5 },
    { id: 3, mw: 10 },
    { id: 4, mw: 15 },
  ];
  const ls = suggestProportionalLs(feeders, 20, [1]);
  assert.equal(ls[1], 0);
  const sum = Math.round((ls[3] + ls[4]) * 10) / 10;
  assert.equal(sum, 10);
});
