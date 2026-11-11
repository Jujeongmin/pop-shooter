import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../../src/sim/balance.ts';
import { firstClearCoins, isBoss, replayCoins, stageHp, stageLabel, stageTime, worldOf } from '../../src/sim/stages.ts';

test('stages', () => {
  assert.equal(stageLabel(10), '1-10');
  assert.equal(stageLabel(11), '2-1');
  assert.equal(worldOf(40), 4);
  assert.equal(worldOf(1), 1);
  assert.ok(isBoss(30) && !isBoss(31));
  assert.equal(stageHp(10), BALANCE.stage.baseHp * BALANCE.stage.hpGrowth ** 9 * BALANCE.stage.bossMult);
  assert.equal(stageHp(1), BALANCE.stage.baseHp);
  assert.equal(stageTime(10), BALANCE.stage.timeBoss);
  assert.equal(stageTime(9), BALANCE.stage.timeNormal);
  assert.equal(firstClearCoins(3), stageHp(3) * BALANCE.stage.firstClearCoinMult);
  assert.equal(replayCoins(3), stageHp(3) * BALANCE.stage.replayCoinMult);
});
