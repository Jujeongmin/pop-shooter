import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebirthReq, shotsPerSec } from '../../src/sim/actions.ts';
import { BALANCE } from '../../src/sim/balance.ts';
import { checkSave, worth, type Premium } from '../../src/sim/econ.ts';
import { replayCoins } from '../../src/sim/stages.ts';
import { newState, type GameState } from '../../src/sim/state.ts';
import { buyMachine, gainPerShot, train } from '../../src/sim/training.ts';

const P: Premium = { gems: 7, passMult: 1, boostUntil: 0, paid: [] };
const NOW = 1_000_000_000;

test('honest training, battle gold and buying pass unchanged', () => {
  const prev: GameState = { ...newState(0), coins: 500, bestStage: 3 };
  const trained = train(prev, 'atk', 30 * (shotsPerSec(prev) + 3), 1);
  const next = buyMachine({ ...trained, coins: prev.coins + replayCoins(3) * 4 }, 'atk', 1)!;
  const r = checkSave(prev, next, 30, P, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.clamped, false); assert.equal(r.state.coins, next.coins); assert.equal(r.state.trAtk, next.trAtk); }
});

test('too much training or gold for the time is clamped', () => {
  const prev: GameState = { ...newState(0), coins: 100 };
  const r = checkSave(prev, { ...prev, coins: 1e15, trAtk: 1e12 }, 10, P, NOW);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.clamped, true);
    assert.ok(r.state.coins < 1e6);
    assert.ok(worth(r.state) >= worth(prev));
    assert.ok(r.state.trAtk <= 1.5 * 10 * (shotsPerSec(prev) + BALANCE.tap.maxPerSec) * gainPerShot(prev, 'atk', 1) + 2 + 1e-9);
  }
});

test('impossible purchases, stages and rebirth skips are rejected', () => {
  const prev = newState(0);
  assert.equal(checkSave(prev, { ...prev, mAtk: 60 }, 5, P, NOW).ok, false);
  assert.equal(checkSave(prev, { ...prev, bestStage: 15 }, 5, P, NOW).ok, false);
  assert.equal(checkSave(prev, { ...prev, rebirths: 3, tokens: 3 }, 5, P, NOW).ok, false);
});

test('legit rebirth passes (training reached), gems and tokens server-computed; early rebirth rejected', () => {
  const need = rebirthReq(newState(0));
  const prev: GameState = { ...newState(0), trAtk: need, bestStage: 3 };
  const next: GameState = { ...newState(0), rebirths: 1, tokens: 99, bestStage: 3, gems: 99999 };
  const r = checkSave(prev, next, 5, P, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.state.tokens, 1); assert.equal(r.state.gems, P.gems + 10); assert.equal(r.prem.gems, P.gems + 10); }
  assert.equal(checkSave({ ...prev, trAtk: 0 }, next, 1, P, NOW).ok, false);
});

test('premium values come from the server, paid chars only if owned', () => {
  const prev = newState(0);
  const r = checkSave(prev, { ...prev, passMult: 64, boostUntil: NOW * 2, char: 'black', chars: ['blue', 'black'] }, 5, { ...P, passMult: 2 }, NOW);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.state.passMult, 2); assert.equal(r.state.boostUntil, 0); assert.equal(r.state.char, 'blue'); assert.deepEqual(r.state.chars, ['blue']); }
  const owned = checkSave(prev, { ...prev, char: 'black' }, 5, { ...P, paid: ['black'] }, NOW);
  assert.ok(owned.ok && owned.state.char === 'black');
});
