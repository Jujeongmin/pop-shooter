import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeatNext, pickGuide, portalDps, TUT_ATK, TUT_SPD, TUTORIAL_DONE } from '../../src/ui/guidePick.ts';
import { autoDps, rebirthReq } from '../../src/sim/actions.ts';
import { newState } from '../../src/sim/state.ts';

test('tutorial: attack at the range, then fire rate on the treadmill, then portal at DPS = 1-1 HP', () => {
  const s = newState(0);
  assert.equal(pickGuide(s), 'range');
  const atk = { ...s, trAtk: TUT_ATK };
  assert.equal(pickGuide(atk), 'treadmill');
  const both = { ...atk, trSpd: TUT_SPD };
  // 둘 다 했지만 DPS가 모자라면 다시 사격장
  assert.ok(autoDps(both) < portalDps());
  assert.equal(pickGuide(both), 'range');
  const ready = { ...both, trAtk: 1000 };
  assert.ok(autoDps(ready) >= portalDps());
  assert.equal(pickGuide(ready), 'portal');
  // 공격이 아무리 높아도 연사 훈련을 안 했으면 러닝머신 먼저
  assert.equal(pickGuide({ ...s, trAtk: 1000 }), 'treadmill');
  assert.ok(canBeatNext({ ...s, trAtk: 1000 }));
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
  assert.equal(pickGuide({ ...done, trAtk: rebirthReq(done) }), null);
});

test('no portal hint after world 1 is cleared', () => {
  assert.ok(!canBeatNext({ ...newState(0), bestStage: 10, trAtk: 1e30 }));
});
