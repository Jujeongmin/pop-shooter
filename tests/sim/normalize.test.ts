import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import { normalizeState } from '../../src/sim/normalize.ts';

test('loadSave corrupt', () => {
  assert.deepEqual(normalizeState('not json', 5), newState(5));
  assert.deepEqual(normalizeState(null, 5), newState(5));
  assert.deepEqual(normalizeState([1, 2], 5), newState(5));
  const r = normalizeState({ v: 2, coins: -3, gun: 99, bestStage: 400, chars: ['blue', 'zzz'], char: 'zzz', mAtk: 2.7 }, 5);
  assert.equal(r.coins, 0);
  assert.equal(r.mAtk, 2);
  assert.equal(r.gun, 15);
  assert.equal(r.bestStage, 40);
  assert.deepEqual(r.chars, ['blue']);
  assert.equal(r.char, 'blue');
  assert.equal(normalizeState({ v: 2, coins: Infinity }, 5).coins, 0);
});

test('normalize keeps valid save', () => {
  const s = { ...newState(100), coins: 1234.5, gems: 9, gun: 2, bestStage: 7, runBest: 7, chars: ['blue', 'red'], char: 'red', passMult: 4, tutorial: 99, trAtk: 5e20, trSpd: 300, trCoin: 77, mAtk: 3, gear: 5, rebirths: 4, tokens: 4 };
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s)), 5000), s);
  assert.equal(normalizeState({ v: 2, lastSeen: 9_999_999 }, 1000).lastSeen, 1000);
  assert.equal(normalizeState({ v: 2, lastSeen: 400 }, 1000).lastSeen, 400);
});

test('normalize fixes chars, pass and caps fire-rate training', () => {
  const r = normalizeState({ v: 2, chars: ['red', 'red'], char: 'red', passMult: 3, runBest: 9, bestStage: 4, trSpd: 99999 }, 5);
  assert.deepEqual(r.chars, ['blue', 'red']);
  assert.equal(r.passMult, 1);
  assert.equal(r.runBest, 4);
  assert.equal(r.trSpd, BALANCE.train.spdMax);
});

test('v1 save migrates: keeps record, guns, gear, chars, gems; resets gold, training, machines, rebirths', () => {
  const r = normalizeState({ v: 1, coins: 9e9, atkLv: 80, spdLv: 20, gun: 4, bestStage: 12, runBest: 12, gems: 70, chars: ['blue', 'yellow'], char: 'yellow', trAtk: 300, mAtk: 9, gear: 3, rebirths: 5, tokens: 5 }, 5);
  assert.equal(r.v, 2);
  assert.equal(r.coins, 0);
  assert.equal(r.trAtk, 0);
  assert.equal(r.mAtk, 0);
  assert.equal(r.rebirths, 0);
  assert.equal(r.tokens, 0);
  assert.equal(r.gun, 4);
  assert.equal(r.bestStage, 12);
  assert.equal(r.gear, 3);
  assert.equal(r.gems, 70);
  assert.deepEqual(r.chars, ['blue', 'yellow']);
  assert.ok(!('atkLv' in r));
});
