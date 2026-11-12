import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../src/sim/state.ts';
import { HOPELESS_SPEED, hopeless, startBattle, stepBattle, tapBattle } from '../../src/sim/battle.ts';
import { stageHp } from '../../src/sim/stages.ts';

test('battle win and lose by dps', () => {
  const strong = { ...newState(0), trAtk: 1e30 };
  const b = startBattle(strong, 1);
  while (!b.done) stepBattle(b, 0.1);
  assert.equal(b.done, 'win');
  assert.equal(b.hp, 0);
  const weak = startBattle(newState(0), 9);
  while (!weak.done) stepBattle(weak, 0.1);
  assert.equal(weak.done, 'lose');
  assert.ok(weak.timeLeft <= 0);
});

test('a battle that cannot be won ends HOPELESS_SPEED times sooner; a winnable one keeps the full timer', () => {
  const weak = startBattle(newState(0), 9);
  assert.ok(hopeless(weak));
  let t = 0;
  while (!weak.done) { stepBattle(weak, 0.05); t += 0.05; }
  assert.equal(weak.done, 'lose');
  assert.ok(Math.abs(t - 20 / HOPELESS_SPEED) < 0.2, `lost after ${t}s`);
  // 딱 시간 안에 이기는 판: 끝까지 보통 속도
  const s = { ...newState(0) };
  const b = startBattle(s, 1);
  b.hp = b.maxHp = b.dmg * Math.floor(b.sps * 19);
  assert.ok(!hopeless(b));
  while (!b.done) stepBattle(b, 0.05);
  assert.equal(b.done, 'win');
});

test('auto shots follow shots per sec', () => {
  const b = startBattle(newState(0), 9);
  let shots = 0;
  for (let i = 0; i < 10; i++) shots += stepBattle(b, 0.1);
  assert.equal(shots, 1);
  assert.equal(b.hp, stageHp(9) - 1);
});

test('tap adds a shot and can finish', () => {
  const b = startBattle({ ...newState(0), trAtk: 40 }, 1);
  const need = Math.ceil(b.maxHp / b.dmg);
  for (let i = 0; i < need - 1; i++) tapBattle(b);
  assert.equal(b.done, null);
  tapBattle(b);
  assert.equal(b.done, 'win');
  tapBattle(b);
  assert.equal(b.hp, 0);
});
