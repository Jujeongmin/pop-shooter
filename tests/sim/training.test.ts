import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { damagePerShot, doRebirth, rebirthReqLevel, shotsPerSec } from '../../src/sim/actions.ts';
import { checkSave } from '../../src/sim/econ.ts';
import { normalizeState } from '../../src/sim/normalize.ts';
import { buyGear, buyMachine, gainPerShot, GEAR, machineAffordable, machineCost, mentorCount, train, trainCap } from '../../src/sim/training.ts';

const PREM = { gems: 0, passMult: 1, boostUntil: 0, paid: [] };

test('train fills up to the cap and boosts damage, shots, coins', () => {
  const s = newState(0);
  const a = train(s, 100);
  assert.ok(a.trAtk > 0 && a.trSpd > 0 && a.trCoin > 0);
  assert.ok(damagePerShot(a) > damagePerShot(s));
  assert.ok(shotsPerSec(a) > shotsPerSec(s));
  const full = train(s, 1e9);
  assert.equal(full.trAtk, trainCap(s, 'atk'));
  assert.equal(full.trSpd, trainCap(s, 'spd'));
  assert.equal(train(full, 1e9).trAtk, full.trAtk);
  assert.equal(train(s, -5), s);
  assert.equal(train(s, NaN), s);
});

test('machines raise speed and cap, gear multiplies, mentors from stage record', () => {
  const s = { ...newState(0), coins: 1e12 };
  const m = buyMachine(s, 'atk', 5)!;
  assert.equal(m.mAtk, 5);
  assert.equal(m.coins, s.coins - machineCost('atk', 0, 5));
  assert.ok(gainPerShot(m, 'atk') > gainPerShot(s, 'atk'));
  assert.ok(trainCap(m, 'atk') > trainCap(s, 'atk'));
  assert.equal(buyMachine({ ...s, coins: 0 }, 'atk', 1), null);
  const g = buyGear(s, 0)!;
  assert.ok(gainPerShot(g, GEAR[0]!.kind) > gainPerShot(s, GEAR[0]!.kind));
  assert.equal(buyGear(g, 0), null, 'once only');
  const locked = GEAR.findIndex((x) => x.needStage > 0);
  assert.equal(buyGear(s, locked), null, 'locked by stage');
  assert.equal(mentorCount(0), 0);
  assert.ok(mentorCount(40) >= 3);
  const af = machineAffordable('spd', 3, 1e6);
  assert.ok(machineCost('spd', 3, af.n) <= 1e6 && machineCost('spd', 3, af.n + 1) > 1e6);
});

test('rebirth resets training, machines and gear', () => {
  let s = { ...newState(0), coins: 1e15 };
  s = buyGear(buyMachine(s, 'coin', 3)!, 0)!;
  s = train({ ...s, atkLv: rebirthReqLevel(s) }, 1000);
  const r = doRebirth(s)!;
  assert.deepEqual([r.trAtk, r.trSpd, r.trCoin, r.mAtk, r.mSpd, r.mCoin, r.gear], [0, 0, 0, 0, 0, 0, 0]);
});

test('normalize keeps training fields in range', () => {
  const n = normalizeState({ trAtk: 50, trSpd: 1e9, trCoin: -3, mAtk: 4.7, gear: 1e9 }, 0);
  assert.equal(n.trAtk, 50);
  assert.ok(n.trSpd <= 100);
  assert.equal(n.trCoin, 0);
  assert.equal(n.mAtk, 4);
  assert.ok(n.gear < 2 ** GEAR.length);
});

test('server check clamps training beyond what the time allows', () => {
  const prev = { ...newState(0), coins: 1e6 };
  const honest = train(prev, 30 * 4);
  const ok = checkSave(prev, honest, 30, PREM, 0);
  assert.ok(ok.ok && !ok.clamped);
  const cheat = { ...prev, trAtk: 1e6 };
  const r = checkSave(prev, cheat, 30, PREM, 0);
  assert.ok(r.ok && r.clamped);
  if (r.ok) assert.ok(r.state.trAtk <= trainCap(prev, 'atk') * 1.001);
});
