import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { CHAR_IDS, newState, type CharId } from '../../src/sim/state.ts';
import { canRebirth, charMult, damagePerShot, doRebirth, rebirthCost } from '../../src/sim/actions.ts';

test('rebirth is bought with coins, any time', () => {
  const s = { ...newState(0), coins: rebirthCost(newState(0)) - 1 };
  assert.ok(!canRebirth(s));
  assert.equal(doRebirth(s), null);
  // 스테이지 조건 없음: 한 판도 안 깨도 코인만 있으면 됨
  const rich = { ...newState(0), coins: rebirthCost(newState(0)) };
  assert.ok(canRebirth(rich));
  assert.equal(doRebirth(rich)!.tokens, 1);
});

test('rebirth cost grows each rebirth', () => {
  const a = rebirthCost({ ...newState(0), rebirths: 0 });
  const b = rebirthCost({ ...newState(0), rebirths: 1 });
  const c = rebirthCost({ ...newState(0), rebirths: 2 });
  assert.equal(a, BALANCE.rebirth.costBase);
  assert.ok(b > a && c > b);
  assert.ok(Math.abs(b / a - BALANCE.rebirth.costGrowth) < 1e-9);
});

test('doRebirth keeps', () => {
  const s = { ...newState(0), bestStage: 15, runBest: 15, gems: 70, coins: 1e30, atkLv: 80, gun: 5, passMult: 8, chars: ['blue', 'yellow'] as CharId[] };
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

test('heroes get stronger in unlock order', () => {
  assert.equal(charMult('blue'), 1);
  for (let i = 1; i < CHAR_IDS.length; i++) assert.ok(charMult(CHAR_IDS[i]!) > charMult(CHAR_IDS[i - 1]!), CHAR_IDS[i]);
  const s = newState(0);
  assert.equal(damagePerShot({ ...s, char: 'red', chars: ['blue', 'red'] }), damagePerShot(s) * charMult('red'));
});
