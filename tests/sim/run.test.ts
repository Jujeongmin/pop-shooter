import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { newState } from '../../src/sim/state.ts';
import { damagePerShot, shotsPerSec } from '../../src/sim/actions.ts';
import { canStartRun, finishRun, startRun, stepRun, tapRun, RUN_GAP_SEC } from '../../src/sim/run.ts';
import { firstClearCoins, replayCoins, stageHp, stageTime } from '../../src/sim/stages.ts';

/** dps가 stage s까지는 깨고 s+1은 못 깨는 공격력 레벨 찾기 */
function stateBeating(maxStage: number) {
  for (let i = 0; i < 4000; i++) {
    const s = { ...newState(0), trAtk: 1.02 ** i - 1 };
    const d = damagePerShot(s) * shotsPerSec(s);
    const ok = (st: number) => d * stageTime(st) >= stageHp(st) + damagePerShot(s);
    if (ok(maxStage) && !ok(maxStage + 1)) return s;
  }
  throw new Error('no level');
}

function play(r: ReturnType<typeof startRun>, dt = 0.05) {
  let guard = 0;
  while (!r.done && guard++ < 1e6) stepRun(r, dt);
}

test('run continues stage to stage until it fails', () => {
  const s = stateBeating(3);
  const r = startRun(s, 1);
  assert.equal(r.stage, 1);
  play(r);
  assert.deepEqual(r.cleared, [1, 2, 3]);
  assert.equal(r.done, 'fail');
  assert.equal(r.stage, 4);
});

test('run ends with world clear after boss', () => {
  const r = startRun({ ...newState(0), trAtk: 1e40 }, 1);
  play(r);
  assert.equal(r.done, 'worldClear');
  assert.deepEqual(r.cleared, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('each stage gets a fresh timer and a short gap', () => {
  const r = startRun({ ...newState(0), trAtk: 1e40 }, 1);
  stepRun(r, 1);
  assert.equal(r.cleared.length, 1);
  assert.ok(r.gap > 0 && r.gap <= RUN_GAP_SEC);
  assert.equal(r.battle.timeLeft, stageTime(2));
  const hp = r.battle.hp;
  tapRun(r);
  assert.equal(r.battle.hp, hp, 'taps ignored during gap');
});

test('finishRun pays first clears and replays', () => {
  const s = { ...newState(0), bestStage: 1 };
  const r = finishRun(s, [1, 2, 3]);
  assert.equal(r.coins, replayCoins(1) + firstClearCoins(2) + firstClearCoins(3));
  assert.equal(r.state.bestStage, 3);
  assert.equal(r.state.coins, r.coins);
  assert.deepEqual(r.firstClears, [2, 3]);
  const boss = finishRun({ ...newState(0), bestStage: 9 }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(boss.unlockedChars, ['yellow']);
  assert.equal(boss.state.gems, BALANCE.gems.worldBossFirst);
  assert.equal(finishRun(s, []).coins, 0);
});

test('world runs start at world first stage and need unlock', () => {
  assert.ok(canStartRun(newState(0), 1));
  assert.ok(!canStartRun(newState(0), 2));
  const s = { ...newState(0), bestStage: 10, trAtk: 1e40 };
  assert.ok(canStartRun(s, 2));
  assert.equal(startRun(s, 2).stage, 11);
});
