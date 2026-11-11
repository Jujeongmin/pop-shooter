import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { atkCost, atkValue, bulkCost, maxAffordable, spdMaxLevel, spdValue, rebirthMult } from '../../src/sim/stats.ts';
import { GUNS, gunMult, gunPrice } from '../../src/sim/guns.ts';

test('atk doubles every doubleEvery levels', () => {
  const d = BALANCE.atk.doubleEvery;
  assert.equal(atkValue(0), 1);
  assert.equal(atkValue(d), (1 + d) * 2);
});

test('spd capped', () => {
  assert.equal(spdValue(0), 1);
  assert.equal(spdValue(spdMaxLevel()), BALANCE.spd.cap);
  assert.equal(spdValue(spdMaxLevel() + 50), BALANCE.spd.cap);
});

test('bulkCost equals sum of single costs', () => {
  const sum = [0, 1, 2, 3, 4].reduce((a, i) => a + atkCost(7 + i), 0);
  assert.ok(Math.abs(bulkCost('atk', 7, 5) - sum) / sum < 1e-9);
});

test('maxAffordable', () => {
  const { n, cost } = maxAffordable('atk', 0, atkCost(0) + atkCost(1) + 0.5);
  assert.equal(n, 2);
  assert.ok(cost <= atkCost(0) + atkCost(1) + 0.5);
  assert.equal(maxAffordable('atk', 0, 0).n, 0);
});

test('maxAffordable huge coins', () => {
  const r = maxAffordable('atk', 3000, 1e300);
  assert.ok(Number.isFinite(r.cost) && r.cost <= 1e300 && r.n >= 0);
  const s = maxAffordable('spd', 0, 1e300);
  assert.equal(s.n, spdMaxLevel());
  assert.ok(Number.isFinite(s.cost));
});

test('rebirthMult', () => {
  assert.equal(rebirthMult(0), 1);
  assert.equal(rebirthMult(4), 1 + 4 * BALANCE.rebirth.multPerToken);
});

test('guns', () => {
  assert.equal(GUNS.length, 16);
  assert.equal(gunPrice(0), 0);
  assert.equal(gunPrice(1), BALANCE.gun.basePrice);
  assert.equal(GUNS[4]!.world, 2);
  assert.ok(gunMult(15) > gunMult(14));
  assert.equal(gunMult(0), 1);
});
