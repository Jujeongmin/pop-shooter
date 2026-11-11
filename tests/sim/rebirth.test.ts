import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { CHAR_IDS, newState, type CharId } from '../../src/sim/state.ts';
import { canRebirth, charMult, damagePerShot, doRebirth, rebirthReq } from '../../src/sim/actions.ts';
import { gainPerShot, rebirthMult } from '../../src/sim/training.ts';

// 키보드 탈출 방식 (사용자 2026-11-11): 공격 훈련치가 기준에 닿으면 환생, 훈련치만 0, 보상 = 훈련 속도 배율

test('rebirth unlocks at the required attack training', () => {
  const need = rebirthReq(newState(0));
  assert.ok(!canRebirth({ ...newState(0), trAtk: need - 1, coins: 1e30 }));
  assert.equal(doRebirth({ ...newState(0), trAtk: need - 1 }), null);
  assert.ok(canRebirth({ ...newState(0), trAtk: need }));
});

test('requirement rises with each rebirth', () => {
  const req = (n: number): number => rebirthReq({ ...newState(0), rebirths: n });
  assert.equal(req(0), BALANCE.rebirth.reqBase);
  assert.ok(req(1) > req(0) && req(2) > req(1));
});

test('each rebirth multiplies training speed by the same factor', () => {
  for (let i = 1; i < 4; i++) assert.ok(Math.abs(rebirthMult(i) / rebirthMult(i - 1) - BALANCE.rebirth.multGrowth) < 1e-9);
  const s = { ...newState(0), trAtk: 1e30 };
  const r = doRebirth(s)!;
  assert.ok(Math.abs(gainPerShot(r, 'atk', 1) / gainPerShot(s, 'atk', 1) - BALANCE.rebirth.multGrowth) < 1e-9);
});

test('doRebirth resets only training, keeps gold, guns, machines, gear', () => {
  const s = { ...newState(0), bestStage: 15, runBest: 15, gems: 70, coins: 5e6, trAtk: 1e30, trSpd: 500, trCoin: 300, gun: 5, mAtk: 7, mCoin: 2, gear: 5, passMult: 8, chars: ['blue', 'yellow'] as CharId[] };
  const r = doRebirth(s)!;
  assert.deepEqual([r.trAtk, r.trSpd, r.trCoin, r.runBest], [0, 0, 0, 0]);
  assert.deepEqual([r.coins, r.gun, r.mAtk, r.mCoin, r.gear, r.bestStage, r.passMult], [5e6, 5, 7, 2, 5, 15, 8]);
  assert.equal(r.gems, 70 + BALANCE.gems.perRebirth);
  assert.deepEqual(r.chars, ['blue', 'yellow']);
  assert.equal(r.tokens, 1);
  assert.equal(r.rebirths, 1);
});

test('heroes get stronger in unlock order', () => {
  assert.equal(charMult('blue'), 1);
  for (let i = 1; i < CHAR_IDS.length; i++) assert.ok(charMult(CHAR_IDS[i]!) > charMult(CHAR_IDS[i - 1]!), CHAR_IDS[i]);
  const s = newState(0);
  assert.equal(damagePerShot({ ...s, char: 'red', chars: ['blue', 'red'] }), damagePerShot(s) * charMult('red'));
});
