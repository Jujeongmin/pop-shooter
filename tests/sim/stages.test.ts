import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, STAGE_COUNT } from '../../src/sim/balance.ts';
import { firstClearCoins, isBoss, replayCoins, stageHp, stageLabel, stageTime, worldOf } from '../../src/sim/stages.ts';

test('stages', () => {
  assert.equal(stageLabel(10), '1-10');
  assert.equal(stageLabel(11), '2-1');
  assert.equal(worldOf(40), 4);
  assert.equal(worldOf(1), 1);
  assert.ok(isBoss(30) && !isBoss(31));
  assert.equal(stageTime(10), BALANCE.stage.timeBoss);
  assert.equal(stageTime(9), BALANCE.stage.timeNormal);
  assert.equal(stageHp(1), BALANCE.stage.firstHp * BALANCE.atkScale);
});

test('hp grows inside a world and from world start to world start (a new world may start below the last boss)', () => {
  for (let s = 2; s <= STAGE_COUNT; s++) if (worldOf(s) === worldOf(s - 1)) assert.ok(stageHp(s) > stageHp(s - 1), `stage ${s} hp must grow`);
  for (let w = 2; w <= BALANCE.stage.worlds; w++) assert.ok(stageHp((w - 1) * 10 + 1) > stageHp((w - 2) * 10 + 1), `world ${w} start`);
  for (let s = 1; s <= STAGE_COUNT; s++) assert.ok(Number.isFinite(stageHp(s)) && stageHp(s) > 0);
});

test('gold grows slower than hp, replay smaller than first clear', () => {
  assert.equal(firstClearCoins(1), BALANCE.stage.goldBase);
  assert.equal(firstClearCoins(10), BALANCE.stage.goldBase * BALANCE.stage.goldGrowth ** 9 * BALANCE.stage.bossGold);
  assert.equal(replayCoins(3), firstClearCoins(3) * BALANCE.stage.replayMult);
  assert.ok(firstClearCoins(30) / firstClearCoins(20) < stageHp(30) / stageHp(20));
});
