import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import { shotsPerSec } from '../../src/sim/actions.ts';
import { offlineReward } from '../../src/sim/offline.ts';
import { replayCoins, stageTime } from '../../src/sim/stages.ts';

test('offlineReward clock', () => {
  const s = { ...newState(1_000_000) };
  assert.equal(offlineReward(s, 500_000).coins, 0);
  assert.equal(offlineReward(s, 500_000).seconds, 0);
  const day = offlineReward(s, 1_000_000 + 86_400_000);
  assert.equal(day.seconds, BALANCE.offline.capSec);
  const min = offlineReward(s, 1_000_000 + 60_000);
  assert.equal(min.shots, shotsPerSec(s) * BALANCE.offline.rate * 60);
  assert.equal(min.coins, 0, 'no gold before the first clear');
});

test('offline gold follows the record stage replay, no boost, training in highest world', () => {
  const s = { ...newState(0), bestStage: 12, trCoin: 100, boostUntil: 1e15 };
  const r = offlineReward(s, 10_000);
  const want = (replayCoins(12) * 2 / stageTime(12)) * BALANCE.offline.goldRate * 10;
  assert.ok(Math.abs(r.coins - want) / want < 1e-9);
  assert.equal(r.world, 2);
  assert.equal(offlineReward(s, 10_000, 5).seconds, 5);
});
