import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, STAGE_COUNT } from '../../src/sim/balance.ts';
import { firstClearCoins, isBoss, replayCoins, stageHp, stageLabel, stageTime, worldOf } from '../../src/sim/stages.ts';
import { STAGE_HP } from '../../src/sim/stageTable.ts';

test('stages', () => {
  assert.equal(stageLabel(10), '1-10');
  assert.equal(stageLabel(11), '2-1');
  assert.equal(worldOf(40), 4);
  assert.equal(worldOf(1), 1);
  assert.ok(isBoss(30) && !isBoss(31));
  assert.equal(stageTime(10), BALANCE.stage.timeBoss);
  assert.equal(stageTime(9), BALANCE.stage.timeNormal);
  assert.equal(firstClearCoins(3), stageHp(3) * BALANCE.stage.firstClearCoinMult);
  assert.equal(replayCoins(3), stageHp(3) * BALANCE.stage.replayCoinMult);
});

test('hp table from fitter', () => {
  assert.equal(STAGE_HP.length, STAGE_COUNT);
  // 1-1 = firstHp에서 ×firstRamp로 늘다가 표에 닿으면 표 (작은 쪽)
  for (let s = 1; s <= STAGE_COUNT; s++) assert.equal(stageHp(s), Math.min(STAGE_HP[s - 1]! * BALANCE.worldHpMult[worldOf(s) - 1]!, BALANCE.stage.firstHp * BALANCE.stage.firstRamp ** (s - 1)));
  for (let s = 2; s <= STAGE_COUNT; s++) assert.ok(stageHp(s) > stageHp(s - 1), `stage ${s} hp must grow`);
  for (const s of STAGE_HP) assert.ok(Number.isFinite(s) && s > 0);
});

test('1-1 is a fixed easy first win (300 hp), table starts at 1-2', () => {
  assert.equal(stageHp(1), 300);
  assert.ok(stageHp(2) > stageHp(1));
});
