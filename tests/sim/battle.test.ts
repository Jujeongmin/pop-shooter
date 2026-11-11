import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { startBattle, stepBattle, tapBattle } from '../../src/sim/battle.ts';
import { stageHp } from '../../src/sim/stages.ts';

test('battle win and lose by dps', () => {
  const strong = { ...newState(0), atkLv: 200 };
  const b = startBattle(strong, 1);
  while (!b.done) stepBattle(b, 0.1);
  assert.equal(b.done, 'win');
  assert.equal(b.hp, 0);
  const weak = startBattle(newState(0), 9);
  while (!weak.done) stepBattle(weak, 0.1);
  assert.equal(weak.done, 'lose');
  assert.ok(weak.timeLeft <= 0);
});

test('auto shots follow shots per sec', () => {
  const b = startBattle(newState(0), 9);
  let shots = 0;
  for (let i = 0; i < 10; i++) shots += stepBattle(b, 0.1);
  assert.equal(shots, 1);
  assert.equal(b.hp, stageHp(9) - 1);
});

test('tap adds a shot and can finish', () => {
  const b = startBattle({ ...newState(0), atkLv: 60 }, 1);
  const need = Math.ceil(b.maxHp / b.dmg);
  for (let i = 0; i < need - 1; i++) tapBattle(b);
  assert.equal(b.done, null);
  tapBattle(b);
  assert.equal(b.done, 'win');
  tapBattle(b);
  assert.equal(b.hp, 0);
});
