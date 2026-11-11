import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import { coinPerShot, shotsPerSec } from '../../src/sim/actions.ts';
import { offlineReward } from '../../src/sim/offline.ts';

test('offlineReward clock', () => {
  const s = { ...newState(1_000_000) };
  assert.equal(offlineReward(s, 500_000).coins, 0);
  assert.equal(offlineReward(s, 500_000).seconds, 0);
  const day = offlineReward(s, 1_000_000 + 86_400_000);
  assert.equal(day.seconds, BALANCE.offline.capSec);
  const min = offlineReward(s, 1_000_000 + 60_000);
  assert.ok(Math.abs(min.coins - coinPerShot(s, 1, 0) * shotsPerSec(s) * BALANCE.offline.rate * 60) < 1e-9);
});

test('offlineReward ignores boost and uses highest world range', () => {
  const s = { ...newState(0), bestStage: 10, boostUntil: 1e15 };
  const r = offlineReward(s, 10_000);
  assert.ok(Math.abs(r.coins - coinPerShot({ ...s, boostUntil: 0 }, 2, 0) * shotsPerSec(s) * BALANCE.offline.rate * 10) < 1e-9);
  assert.equal(offlineReward(s, 10_000, 5).seconds, 5);
});
