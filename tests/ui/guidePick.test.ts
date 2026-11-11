import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeatNext, pickGuide } from '../../src/ui/guidePick.ts';
import { rebirthReqLevel } from '../../src/sim/actions.ts';
import { gunPrice } from '../../src/sim/guns.ts';
import { bulkCost } from '../../src/sim/stats.ts';
import { newState } from '../../src/sim/state.ts';

test('new player with no coins is sent to the range, nothing while training', () => {
  const s = newState(0);
  assert.equal(pickGuide(s, false), 'range');
  assert.equal(pickGuide(s, true), null);
});

test('enough coins for several attack levels → upgrade (not for a single level)', () => {
  const s = newState(0);
  assert.equal(pickGuide({ ...s, coins: bulkCost('atk', 0, 1) }, true), null);
  assert.equal(pickGuide({ ...s, coins: bulkCost('atk', 0, 5) }, true), 'upgrade');
});

test('affordable next gun beats upgrade', () => {
  const s = { ...newState(0), coins: gunPrice(1) };
  assert.equal(pickGuide(s, true), 'guns');
});

test('strong enough for the next stage → portal; rebirth comes first', () => {
  const strong = { ...newState(0), atkLv: 30 };
  assert.ok(canBeatNext(strong));
  assert.equal(pickGuide(strong, true), 'portal');
  const rebirthReady = { ...newState(0), atkLv: rebirthReqLevel(newState(0)) };
  assert.equal(pickGuide(rebirthReady, true), 'altar');
});

test('no portal hint after world 1 is cleared', () => {
  const done = { ...newState(0), bestStage: 10, atkLv: 40 };
  assert.ok(!canBeatNext(done));
});
