import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import {
  buyAtk, buyNextGun, buySpd, canAttempt, clearStage, coinPerShot, damagePerShot, maxDps, autoDps, shotsPerSec, worldUnlocked,
} from '../../src/sim/actions.ts';
import { firstClearCoins, replayCoins } from '../../src/sim/stages.ts';
import { TapLimiter } from '../../src/sim/tapLimiter.ts';
import { spdMaxLevel } from '../../src/sim/stats.ts';

test('buyAtk spends and levels', () => {
  const s = { ...newState(0), coins: 1000 };
  const r = buyAtk(s, 3)!;
  assert.equal(r.atkLv, 3);
  assert.ok(r.coins < 1000);
  assert.equal(s.atkLv, 0);
  assert.equal(buyAtk({ ...newState(0), coins: 0 }, 1), null);
});

test('buySpd stops at max level', () => {
  const s = { ...newState(0), coins: 1e300, spdLv: spdMaxLevel() };
  assert.equal(buySpd(s, 1), null);
});

test('gun needs world unlocked', () => {
  const rich = { ...newState(0), coins: 1e30, gun: 3 };
  assert.equal(buyNextGun(rich), null);
  assert.equal(buyNextGun({ ...rich, bestStage: 10 })!.gun, 4);
  assert.equal(buyNextGun({ ...newState(0), coins: 1e300, gun: 15, bestStage: 40 }), null);
});

test('clearStage first and replay', () => {
  const a = clearStage(newState(0), 1);
  assert.ok(a.firstClear);
  assert.equal(a.state.bestStage, 1);
  assert.equal(a.coins, firstClearCoins(1));
  assert.equal(a.state.coins, firstClearCoins(1));
  const b = clearStage(a.state, 1);
  assert.ok(!b.firstClear);
  assert.equal(b.coins, replayCoins(1));
  const boss = clearStage({ ...newState(0), bestStage: 9 }, 10);
  assert.equal(boss.unlockedChar, 'yellow');
  assert.equal(boss.state.gems, BALANCE.gems.worldBossFirst);
  assert.ok(boss.state.chars.includes('yellow'));
  assert.equal(boss.state.runBest, 10);
});

test('canAttempt', () => {
  const s = { ...newState(0), bestStage: 4 };
  assert.ok(canAttempt(s, 5) && canAttempt(s, 2));
  assert.ok(!canAttempt(s, 6) && !canAttempt(s, 41) && !canAttempt(s, 0));
});

test('damage and coins', () => {
  const s = { ...newState(0), passMult: 4 };
  assert.equal(damagePerShot(s), 4);
  assert.equal(autoDps(s), damagePerShot(s) * shotsPerSec(s));
  assert.equal(maxDps(s), damagePerShot(s) * (shotsPerSec(s) + BALANCE.tap.maxPerSec));
  assert.equal(coinPerShot(s, 2, 0), 4 * BALANCE.range.multByWorld[1]);
  assert.equal(coinPerShot({ ...s, boostUntil: 100 }, 1, 50), 4 * BALANCE.boost.coinMult);
  assert.ok(worldUnlocked(s, 1) && !worldUnlocked(s, 2));
});

test('TapLimiter 8 per sec', () => {
  const t = new TapLimiter(8);
  let ok = 0;
  for (let i = 0; i < 30; i++) if (t.accept(i / 30)) ok++;
  assert.equal(ok, 8);
  assert.ok(t.accept(1.01));
});
