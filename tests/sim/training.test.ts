import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import { damagePerShot, goldMult, shotsPerSec } from '../../src/sim/actions.ts';
import {
  buyGear, buyMachine, gainPerShot, GEAR, gearPrice, machineAffordable, machineCost, mentorCount, rebirthMult, spdMaxed, stationMult, train,
} from '../../src/sim/training.ts';

test('each station trains only its own stat, without a cap', () => {
  const s = newState(0);
  const a = train(s, 'atk', 100, 1);
  assert.equal(a.trAtk, 100 * BALANCE.train.gain.atk);
  assert.equal(a.trSpd, 0);
  assert.equal(a.trCoin, 0);
  assert.ok(damagePerShot(a) > damagePerShot(s));
  const big = train(s, 'atk', 1e12, 1);
  assert.ok(train(big, 'atk', 1e12, 1).trAtk > big.trAtk, 'no cap on attack');
  const sp = train(s, 'spd', 100, 1);
  assert.ok(shotsPerSec(sp) > shotsPerSec(s) && sp.trAtk === 0);
  const co = train(s, 'coin', 100, 1);
  assert.ok(goldMult(co, 0) > goldMult(s, 0) && co.trAtk === 0);
  assert.equal(train(s, 'atk', -5, 1), s);
  assert.equal(train(s, 'atk', NaN, 1), s);
});

test('fire-rate training stops at 12 shots per second', () => {
  const s = train(newState(0), 'spd', 1e9, 1);
  assert.ok(spdMaxed(s));
  assert.equal(s.trSpd, BALANCE.train.spdMax);
  assert.equal(shotsPerSec(s), 12);
});

test('better station, machines, gear, mentors and rebirths train faster', () => {
  const s = { ...newState(0), coins: 1e30 };
  const base = gainPerShot(s, 'atk', 1);
  assert.equal(gainPerShot(s, 'atk', 2), base * stationMult(2));
  const m = buyMachine(s, 'atk', 5)!;
  assert.equal(m.mAtk, 5);
  assert.equal(m.coins, s.coins - machineCost(0, 5));
  assert.ok(gainPerShot(m, 'atk', 1) > base);
  assert.equal(gainPerShot(m, 'spd', 1), gainPerShot(s, 'spd', 1), 'attack machine only');
  assert.equal(buyMachine({ ...s, coins: 0 }, 'atk', 1), null);
  const g = buyGear(s, 0)!;
  assert.equal(g.coins, s.coins - gearPrice(0));
  assert.ok(gainPerShot(g, GEAR[0]!.kind, 1) > gainPerShot(s, GEAR[0]!.kind, 1));
  assert.equal(buyGear(g, 0), null, 'once only');
  const locked = GEAR.findIndex((x) => x.needStage > 0);
  assert.equal(buyGear(s, locked), null, 'locked by stage');
  assert.equal(mentorCount(0), 0);
  assert.ok(gainPerShot({ ...s, bestStage: 40 }, 'atk', 1) > base);
  assert.equal(gainPerShot({ ...s, tokens: 2 }, 'atk', 1), base * rebirthMult(2));
  const af = machineAffordable(3, 1e6);
  assert.ok(machineCost(3, af.n) <= 1e6 && machineCost(3, af.n + 1) > 1e6);
});

test('topGearTier shows the best owned tier per kind', async () => {
  const { topGearTier } = await import('../../src/sim/training.ts');
  const s = newState(0);
  assert.deepEqual([topGearTier(s, 'atk'), topGearTier(s, 'spd'), topGearTier(s, 'coin')], [0, 0, 0]);
  const iGloves2 = GEAR.findIndex((g) => g.id === 'gloves2');
  const iPiggy = GEAR.findIndex((g) => g.id === 'piggy');
  const g = { ...s, gear: (1 << 0) | (1 << iGloves2) | (1 << iPiggy) };
  assert.equal(topGearTier(g, 'atk'), 2);
  assert.equal(topGearTier(g, 'spd'), 0);
  assert.equal(topGearTier(g, 'coin'), 1);
});

test('trainRate: attack follows fire rate, fire-rate and gold stations run at a fixed pace', async () => {
  const { trainRate } = await import('../../src/sim/actions.ts');
  const s = newState(0);
  const fast = train(s, 'spd', 1e9, 1);
  assert.equal(trainRate(s, 'atk'), shotsPerSec(s));
  assert.equal(trainRate(fast, 'atk'), 12);
  assert.equal(trainRate(s, 'spd'), BALANCE.train.actionsPerSec);
  assert.equal(trainRate(fast, 'coin'), BALANCE.train.actionsPerSec);
});
