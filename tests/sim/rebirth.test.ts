import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState, type CharId } from '../../src/sim/state.ts';
import { canRebirth, damagePerShot, doRebirth } from '../../src/sim/actions.ts';

test('rebirth locked before unlockStage', () => {
  assert.ok(!canRebirth({ ...newState(0), bestStage: 9, runBest: 9 }));
  assert.equal(doRebirth({ ...newState(0), bestStage: 9, runBest: 9 }), null);
});

test('doRebirth keeps', () => {
  const s = { ...newState(0), bestStage: 15, runBest: 15, gems: 70, coins: 5e6, atkLv: 80, gun: 5, passMult: 8, chars: ['blue', 'yellow'] as CharId[] };
  const r = doRebirth(s)!;
  assert.equal(r.bestStage, 15);
  assert.equal(r.gems, 70 + BALANCE.gems.perRebirth);
  assert.deepEqual(r.chars, ['blue', 'yellow']);
  assert.equal(r.passMult, 8);
  assert.equal(r.coins, 0);
  assert.equal(r.atkLv, 0);
  assert.equal(r.gun, 0);
  assert.equal(r.runBest, 0);
  assert.equal(r.tokens, 5);
  assert.equal(r.rebirths, 1);
  assert.ok(damagePerShot(r) > damagePerShot({ ...newState(0), passMult: 8 }));
});
