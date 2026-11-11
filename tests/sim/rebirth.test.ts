import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { CHAR_IDS, newState, type CharId } from '../../src/sim/state.ts';
import { canRebirth, charMult, damagePerShot, doRebirth, rebirthReqLevel } from '../../src/sim/actions.ts';
import { rebirthMult } from '../../src/sim/stats.ts';

// 키보드 탈출 방식 (사용자 2026-11-11): 공격력 레벨이 기준에 닿으면 환생, 기준은 환생할수록 오름, 보상은 환생마다 정해진 배율

test('rebirth unlocks at the required attack level (no coins, no stage needed)', () => {
  const need = rebirthReqLevel(newState(0));
  assert.ok(!canRebirth({ ...newState(0), atkLv: need - 1, coins: 1e30 }));
  assert.equal(doRebirth({ ...newState(0), atkLv: need - 1 }), null);
  assert.ok(canRebirth({ ...newState(0), atkLv: need }));
});

test('required level rises with each rebirth', () => {
  const lv = (n: number): number => rebirthReqLevel({ ...newState(0), rebirths: n });
  assert.equal(lv(0), BALANCE.rebirth.reqBase);
  assert.ok(lv(1) > lv(0) && lv(2) > lv(1));
});

test('each rebirth multiplies power by the same fixed factor', () => {
  let s = { ...newState(0), atkLv: 9999 };
  const mults: number[] = [rebirthMult(s.tokens)];
  for (let i = 0; i < 3; i++) {
    s = { ...doRebirth(s)!, atkLv: 9999 };
    mults.push(rebirthMult(s.tokens));
  }
  for (let i = 1; i < mults.length; i++) assert.ok(Math.abs(mults[i]! / mults[i - 1]! - BALANCE.rebirth.multGrowth) < 1e-9);
});

test('doRebirth resets and keeps', () => {
  const s = { ...newState(0), bestStage: 15, runBest: 15, gems: 70, coins: 5e6, atkLv: 500, gun: 5, passMult: 8, chars: ['blue', 'yellow'] as CharId[] };
  const r = doRebirth(s)!;
  assert.equal(r.bestStage, 15);
  assert.equal(r.gems, 70 + BALANCE.gems.perRebirth);
  assert.deepEqual(r.chars, ['blue', 'yellow']);
  assert.equal(r.passMult, 8);
  assert.equal(r.coins, 0);
  assert.equal(r.atkLv, 0);
  assert.equal(r.gun, 0);
  assert.equal(r.runBest, 0);
  assert.equal(r.tokens, 1);
  assert.equal(r.rebirths, 1);
  assert.ok(damagePerShot(r) > damagePerShot({ ...newState(0), passMult: 8 }));
});

test('heroes get stronger in unlock order', () => {
  assert.equal(charMult('blue'), 1);
  for (let i = 1; i < CHAR_IDS.length; i++) assert.ok(charMult(CHAR_IDS[i]!) > charMult(CHAR_IDS[i - 1]!), CHAR_IDS[i]);
  const s = newState(0);
  assert.equal(damagePerShot({ ...s, char: 'red', chars: ['blue', 'red'] }), damagePerShot(s) * charMult('red'));
});
