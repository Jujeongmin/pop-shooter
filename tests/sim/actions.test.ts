import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import {
  buyNextGun, canAttempt, clearStage, goldMult, damagePerShot, maxDps, autoDps, shotsPerSec, worldUnlocked,
} from '../../src/sim/actions.ts';
import { firstClearCoins, replayCoins } from '../../src/sim/stages.ts';
import { TapLimiter } from '../../src/sim/tapLimiter.ts';

test('gun needs world unlocked', () => {
  const rich = { ...newState(0), coins: 1e30, gun: 3 };
  assert.equal(buyNextGun(rich), null);
  assert.equal(buyNextGun({ ...rich, bestStage: 10 })!.gun, 4);
  assert.equal(buyNextGun({ ...newState(0), coins: 1e300, gun: 31, bestStage: 80 }), null);
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
  assert.equal(damagePerShot(s), 4 * BALANCE.atkScale);
  assert.equal(autoDps(s), damagePerShot(s) * shotsPerSec(s));
  assert.equal(maxDps(s), damagePerShot(s) * (shotsPerSec(s) + BALANCE.tap.maxPerSec));
  assert.equal(goldMult(s, 0), 1);
  assert.equal(goldMult({ ...s, trCoin: 50 }, 0), 1.5);
  assert.equal(goldMult({ ...s, boostUntil: 100 }, 50), BALANCE.boost.coinMult);
  // 첫 클리어 골드에 코인 훈련 배율이 붙음
  assert.equal(clearStage({ ...s, trCoin: 100 }, 1).coins, firstClearCoins(1) * 2);
  assert.ok(worldUnlocked(s, 1) && !worldUnlocked(s, 2));
});

test('TapLimiter 8 per sec', () => {
  const t = new TapLimiter(8);
  let ok = 0;
  for (let i = 0; i < 30; i++) if (t.accept(i / 30)) ok++;
  assert.equal(ok, 8);
  assert.ok(t.accept(1.01));
});
