import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInvestment,
  investmentSensitivity,
  type InvestmentInputs,
} from "../supabase/functions/_shared/investment.ts";
import {
  distanceKm,
  geographicMatch,
} from "../supabase/functions/_shared/geography.ts";
import { scoreProperty } from "../supabase/functions/_shared/matching.ts";
const x: InvestmentInputs = {
  purchase: 100000,
  acquisitionCosts: 10000,
  renovation: 20000,
  furnishing: 5000,
  loanAmount: 60000,
  annualRate: 0,
  loanYears: 10,
  monthlyRent: 1000,
  vacancyPct: 10,
  nonPaymentPct: 0,
  annualOperatingCosts: 1800,
  annualCapexReserve: 600,
};
test("investment waterfall matches independently calculated zero-interest and cash-only cases", () => {
  const r = calculateInvestment(x);
  assert.equal(r.totalInvestment, 135000);
  assert.equal(r.equity, 75000);
  assert.equal(r.monthlyDebt, 500);
  assert.equal(r.effectiveIncome, 10800);
  assert.equal(r.operatingIncome, 9000);
  assert.equal(r.cashflow, 2400);
  assert.equal(r.cashOnCash, 3.2);
  assert.equal(calculateInvestment({ ...x, loanAmount: 0 }).cashflow, 8400);
  // A separate month-by-month amortization ledger must retire the principal.
  const interest = { ...x, annualRate: 3.5, loanYears: 25 };
  const payment = calculateInvestment(interest).monthlyDebt;
  let balance = interest.loanAmount;
  for (let month = 0; month < 300; month++)
    balance = balance * (1 + interest.annualRate / 1200) - payment;
  assert.ok(Math.abs(balance) < 0.00001);
});
test("investment rejects missing/invalid assumptions and exposes undefined zero-equity ratios", () => {
  for (const change of [
    { monthlyRent: NaN },
    { purchase: 0 },
    { vacancyPct: 101 },
    { loanYears: 0 },
    { loanAmount: 999999 },
    { acquisitionCosts: undefined },
  ])
    assert.throws(() =>
      calculateInvestment({ ...x, ...change } as InvestmentInputs),
    );
  assert.equal(
    calculateInvestment({ ...x, loanAmount: 135000 }).cashOnCash,
    null,
  );
  assert.equal(
    calculateInvestment({ ...x, vacancyPct: 100 }).breakEvenMonthlyRent,
    null,
  );
  const s = investmentSensitivity(x);
  assert.ok(s[1].result.cashflow < s[0].result.cashflow);
  assert.ok(s[3].result.cashflow < s[0].result.cashflow);
});
test("geographic filters respect boundaries and reject missing or approximate locations", () => {
  assert.ok(Math.abs(distanceKm([0, 0], [1, 0]) - 111.195) < 0.001);
  const radius = { kind: "radius", center: [0, 0], km: 2 };
  assert.equal(
    geographicMatch(radius, {
      longitude: 0,
      latitude: 0,
      location_precision: "exact",
    }),
    true,
  );
  assert.equal(
    geographicMatch(radius, {
      longitude: 0,
      latitude: 0,
      location_precision: "approximate",
    }),
    null,
  );
  const polygon = {
    kind: "polygon",
    points: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  };
  assert.equal(
    geographicMatch(polygon, {
      longitude: 0.5,
      latitude: 0.5,
      location_precision: "exact",
    }),
    true,
  );
  assert.equal(
    geographicMatch(polygon, {
      longitude: 0,
      latitude: 0.5,
      location_precision: "exact",
    }),
    true,
  );
  assert.equal(
    geographicMatch(polygon, {
      longitude: 2,
      latitude: 0.5,
      location_precision: "exact",
    }),
    false,
  );
});
test("preferences rank compatible homes but cannot compensate a hard constraint", () => {
  const c = { presupuesto_max: 150000 },
    k = {
      ubicaciones: ["Madrid"],
      preferences: { tiene_ascensor: true, tiene_parking: true },
    },
    p = {
      precio: 140000,
      ciudad: "Madrid",
      tiene_ascensor: true,
      tiene_parking: false,
    };
  assert.equal(scoreProperty(c, k, p).score, 80);
  assert.equal(
    scoreProperty(c, k, { ...p, precio: 151000, tiene_parking: true }).score,
    0,
  );
  assert.equal(
    scoreProperty(c, k, { ...p, tiene_parking: null }).eligible,
    true,
  );
  assert.equal(
    scoreProperty(c, k, { ...p, tiene_parking: null }).preferences
      .tiene_parking,
    null,
  );
});
