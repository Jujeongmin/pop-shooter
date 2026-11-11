import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeatNext, pickGuide, TUTORIAL_DONE } from '../../src/ui/guidePick.ts';
import { rebirthReq } from '../../src/sim/actions.ts';
import { newState } from '../../src/sim/state.ts';

test('tutorial: range first, then portal when 1-1 is beatable', () => {
  const s = newState(0);
  assert.equal(pickGuide(s), 'range');
  const strong = { ...s, trAtk: 1000 };
  assert.ok(canBeatNext(strong));
  assert.equal(pickGuide(strong), 'portal');
});

test('tutorial: after the first clear, upgrade until something is bought', () => {
  const cleared = { ...newState(0), bestStage: 1, coins: 60 };
  assert.equal(pickGuide(cleared), 'upgrade');
  assert.equal(pickGuide({ ...cleared, mAtk: 1 }), null);
  assert.equal(pickGuide({ ...cleared, gear: 1 }), null);
});

test('after the tutorial: nothing, except rebirth when it is ready', () => {
  const done = { ...newState(0), tutorial: TUTORIAL_DONE, bestStage: 3, mAtk: 2 };
  assert.equal(pickGuide(done), null);
  assert.equal(pickGuide({ ...done, coins: 1e30, trAtk: 10 }), null, 'no shop hints');
  assert.equal(pickGuide({ ...done, trAtk: rebirthReq(done) }), 'altar');
});

test('no portal hint after world 1 is cleared', () => {
  assert.ok(!canBeatNext({ ...newState(0), bestStage: 10, trAtk: 1e30 }));
});
