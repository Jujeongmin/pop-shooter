import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyAtk, rebirthReqLevel } from '../../src/sim/actions.ts';
import { checkSave, maxIncomePerSec, worth, type Premium } from '../../src/sim/econ.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { bulkCost } from '../../src/sim/stats.ts';

const P: Premium = { gems: 7, passMult: 1, boostUntil: 0, paid: [] };
const NOW = 1_000_000_000;

test('honest training + buying passes unchanged', () => {
  const prev: GameState = { ...newState(0), coins: 500, atkLv: 5 };
  const earned = maxIncomePerSec(prev, false) * 30 * 0.8;
  const next = buyAtk({ ...prev, coins: prev.coins + earned }, 3)!;
  const r = checkSave(prev, next, 30, P, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.clamped, false); assert.equal(r.state.coins, next.coins); }
});

test('too many coins for the time are clamped to the allowance', () => {
  const prev: GameState = { ...newState(0), coins: 100 };
  const r = checkSave(prev, { ...prev, coins: 1e15 }, 10, P, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.clamped, true); assert.ok(r.state.coins < 1e6); assert.ok(worth(r.state) >= worth(prev)); }
});

test('impossible levels are rejected; impossible stage rejected; rebirth skip rejected', () => {
  const prev = newState(0);
  const lv = checkSave(prev, { ...prev, atkLv: 500 }, 5, P, NOW);
  assert.equal(lv.ok, false);
  const st = checkSave(prev, { ...prev, bestStage: 15 }, 5, P, NOW);
  assert.equal(st.ok, false);
  const rb = checkSave(prev, { ...prev, rebirths: 3, tokens: 3 }, 5, P, NOW);
  assert.equal(rb.ok, false);
});

test('legit rebirth (level reached) passes, gems and tokens are server-computed', () => {
  const need = rebirthReqLevel(newState(0));
  const prev: GameState = { ...newState(0), atkLv: need, bestStage: 3 };
  const next: GameState = { ...newState(0), rebirths: 1, tokens: 99, bestStage: 3, gems: 99999 };
  const r = checkSave(prev, next, 5, P, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.state.tokens, 1); assert.equal(r.state.gems, P.gems + 10); assert.equal(r.prem.gems, P.gems + 10); }
  const early = checkSave({ ...prev, atkLv: 0, coins: 0 }, next, 1, P, NOW);
  assert.equal(early.ok, false);
  assert.ok(bulkCost('atk', 0, need) > 0);
});

test('premium values come from the server, paid chars only if owned', () => {
  const prev = newState(0);
  const r = checkSave(prev, { ...prev, passMult: 64, boostUntil: NOW * 2, char: 'black', chars: ['blue', 'black'] }, 5, { ...P, passMult: 2 }, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.state.passMult, 2); assert.equal(r.state.boostUntil, 0); assert.equal(r.state.char, 'blue'); assert.deepEqual(r.state.chars, ['blue']); }
  const owned = checkSave(prev, { ...prev, char: 'black' }, 5, { ...P, paid: ['black'] }, NOW);
  assert.ok(owned.ok && owned.state.char === 'black');
});
