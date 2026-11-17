import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { damagePerShot, goldMult, shotsPerSec } from '../../src/sim/actions.ts';
import {
  buyGear, buyMachine, gainPerShot, GEAR, gearPrice, machineAffordable, machineCost, mentorCount, rebirthMult, stationMult, train, trainSpeedMult,
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

test('fire-rate training has no cap (shots per second keep growing)', () => {
  const s = train(newState(0), 'spd', 1e6, 1);
  assert.ok(shotsPerSec(s) > 12);
  // 12발까지는 훈련 그대로, 넘으면 로그로만 (훈련치가 e배 될 때마다 +12발)
  const low = { ...newState(0), trSpd: 500 };
  assert.equal(shotsPerSec(low), 6);
  const raw = 1 + s.trSpd / 100;
  assert.ok(Math.abs(shotsPerSec(s) - 12 * (1 + Math.log(raw / 12))) < 1e-9);
  assert.ok(shotsPerSec(train(s, 'spd', 1e6, 1)) > shotsPerSec(s), 'still grows');
  assert.ok(shotsPerSec({ ...newState(0), trSpd: 1e18 }) < 1000, 'stays in the hundreds');
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
  assert.equal(trainRate(fast, 'atk'), shotsPerSec(fast));
  assert.equal(trainRate(s, 'spd'), BALANCE.train.actionsPerSec);
  assert.equal(trainRate(fast, 'coin'), BALANCE.train.actionsPerSec);
});

// 2026-11-17: 환생 창·HUD는 '훈련 속도 배율'에 공격력 패스를 곱해 ×8로, 환생 뒤 가운데 문구는 ×4로 보였음.
// 실제 훈련량은 환생 배율만 씀 (패스는 공격력) → 화면 배율은 trainSpeedMult 하나로
test('trainSpeedMult: what training actually gets; the attack pass does not change it', () => {
  const base: GameState = { ...newState(0), tokens: 4 };
  const passed: GameState = { ...base, passMult: 2 };
  assert.equal(trainSpeedMult(base), 4);
  assert.equal(trainSpeedMult(passed), 4);
  assert.equal(gainPerShot(passed, 'atk', 1), gainPerShot(base, 'atk', 1));
  const more: GameState = { ...base, tokens: 5 };
  assert.equal(gainPerShot(more, 'atk', 1) / gainPerShot(base, 'atk', 1), trainSpeedMult(more) / trainSpeedMult(base));
});
