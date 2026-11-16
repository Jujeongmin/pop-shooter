import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBeatNext, pickGuide, portalDps, TUT_SPD, TUTORIAL_DONE } from '../../src/ui/guidePick.ts';
import { autoDps, rebirthReq } from '../../src/sim/actions.ts';
import { newState } from '../../src/sim/state.ts';

test('tutorial: range until DPS clears 1-1 in about 10s, then portal', () => {
  const s = newState(0);
  assert.equal(pickGuide(s), 'range');
  assert.ok(autoDps(s) < portalDps());
  // 사격장 약 17초(한 발에 공격 훈련 +1, 초당 1발)면 포털
  const ready = { ...s, trAtk: 17 };
  assert.ok(autoDps(ready) >= portalDps());
  assert.equal(pickGuide(ready), 'portal');
  assert.ok(canBeatNext(ready), 'portal hint only when 1-1 is beatable');
});

test('tutorial: after the first clear, treadmill, then upgrade until something is bought', () => {
  const cleared = { ...newState(0), bestStage: 1, coins: 60 };
  assert.equal(pickGuide(cleared), 'treadmill');
  const ran = { ...cleared, trSpd: TUT_SPD };
  assert.equal(pickGuide(ran), 'upgrade');
  assert.equal(pickGuide({ ...ran, mAtk: 1 }), null);
  assert.equal(pickGuide({ ...ran, gear: 1 }), null);
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
