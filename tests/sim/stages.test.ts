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
  for (let s = 1; s <= STAGE_COUNT; s++) assert.equal(stageHp(s), STAGE_HP[s - 1]);
  for (let s = 2; s <= STAGE_COUNT; s++) assert.ok(stageHp(s) > stageHp(s - 1), `stage ${s} hp must grow`);
  for (const s of STAGE_HP) assert.ok(Number.isFinite(s) && s > 0);
});
