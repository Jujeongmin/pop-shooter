import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { normalizeState } from '../../src/sim/normalize.ts';

test('loadSave corrupt', () => {
  assert.deepEqual(normalizeState('not json', 5), newState(5));
  assert.deepEqual(normalizeState(null, 5), newState(5));
  assert.deepEqual(normalizeState([1, 2], 5), newState(5));
  const r = normalizeState({ v: 1, coins: -3, atkLv: 2.7, gun: 99, bestStage: 400, chars: ['blue', 'zzz'], char: 'zzz' }, 5);
  assert.equal(r.coins, 0);
  assert.equal(r.atkLv, 2);
  assert.equal(r.gun, 15);
  assert.equal(r.bestStage, 40);
  assert.deepEqual(r.chars, ['blue']);
  assert.equal(r.char, 'blue');
  assert.equal(normalizeState({ v: 1, coins: Infinity }, 5).coins, 0);
});

test('normalize keeps valid save', () => {
  const s = { ...newState(100), coins: 1234.5, gems: 9, atkLv: 30, spdLv: 4, gun: 2, bestStage: 7, runBest: 7, chars: ['blue', 'red'], char: 'red', passMult: 4, tutorial: 99 };
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s)), 100), s);
});

test('normalize clamps future lastSeen to now', () => {
  assert.equal(normalizeState({ v: 1, lastSeen: 9_999_999 }, 1000).lastSeen, 1000);
  assert.equal(normalizeState({ v: 1, lastSeen: 400 }, 1000).lastSeen, 400);
});

test('normalize fixes chars and pass', () => {
  const r = normalizeState({ v: 1, chars: ['red', 'red'], char: 'red', passMult: 3, runBest: 9, bestStage: 4, spdLv: 999 }, 5);
  assert.deepEqual(r.chars, ['blue', 'red']);
  assert.equal(r.passMult, 1);
  assert.equal(r.runBest, 4);
  assert.equal(r.spdLv, 44);
});
